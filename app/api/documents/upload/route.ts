import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import { can, canEdit } from "@/lib/permissions";
import { documentToDTO } from "@/lib/services/document.mapper";
import type { DocumentCategory } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Real file upload: persists the bytes into an Attachment row (streamed back by
// /api/attachments/[id]) plus a Document metadata row. This is the write half of
// the object-storage seam — previously uploads dropped their bytes and kept only
// metadata. Bytes live in Postgres, consistent with Gmail-filed NDA attachments;
// swap Attachment.bytes for an S3 storageKey later without touching callers.

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB — a hard ceiling on a single upload.

// Client-uploadable categories (mirrors the portal Upload dialog). Anything else
// is coerced to "other" rather than trusting the client blindly.
const UPLOADABLE: DocumentCategory[] = [
  "other",
  "technical_data_sheet",
  "regulatory",
  "certificate",
  "presentation",
];

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "text/plain",
]);

function extOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "bin";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Who may upload: portal clients via portal.request_docs, or internal staff who
  // can edit the document library (which lives under the `ndas` section).
  const allowed =
    can(user.role, "portal.request_docs") || canEdit(user.role, "ndas");
  if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  }

  // Company scope is the security boundary: an external uploader is pinned to
  // their OWN company — the client-supplied companyId is ignored for them.
  const requestedCompanyId = (form.get("companyId") as string | null)?.trim() || null;
  const companyId =
    user.kind === "external" ? user.companyId : requestedCompanyId;

  const rawCategory = (form.get("category") as string | null)?.trim() as DocumentCategory;
  const category: DocumentCategory = UPLOADABLE.includes(rawCategory) ? rawCategory : "other";
  const description = (form.get("description") as string | null)?.trim() || null;

  const displayName = ((form.get("name") as string | null)?.trim() || file.name).slice(0, 200);
  const fileType = extOf(file.name);
  const mimeType = file.type || "application/octet-stream";
  const bytes = Buffer.from(await file.arrayBuffer());
  const now = new Date();

  const document = await prisma.document.create({
    data: {
      title: displayName,
      category,
      // Client uploads are visible to their company + our staff, never public.
      confidentialityClass: "company_specific",
      companyId,
      fileType,
      mimeType,
      sizeBytes: bytes.length,
      description,
      uploadedByUserId: user.id,
      uploadedAt: now,
      createdById: user.id,
      attachments: {
        create: {
          name: displayName,
          fileType,
          mimeType,
          sizeBytes: bytes.length,
          sizeKb: Math.round(bytes.length / 1024),
          bytes,
          uploadedByUserId: user.id,
          uploadedAt: now,
          createdById: user.id,
        },
      },
    },
    include: { attachments: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return NextResponse.json({ document: documentToDTO(document) }, { status: 201 });
}
