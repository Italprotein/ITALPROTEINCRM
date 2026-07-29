import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import { clientIpFromHeaders } from "@/lib/backend/rate-limit";
import {
  isObjectStorageConfigured,
  buildStorageKey,
  putObject,
  deleteObject,
} from "@/lib/backend/storage";
import { can, canEdit } from "@/lib/permissions";
import { documentToDTO } from "@/lib/services/document.mapper";
import type { DocumentCategory } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Real file upload. Bytes go to S3-compatible object storage when the
// OBJECT_STORAGE_* variables are configured (the production path), and fall back
// to Postgres (Attachment.bytes) otherwise — which is how Gmail-filed NDA
// attachments already work, so both resolve through the same download route.
//
// The bucket is private: no public or pre-signed URL is ever minted. Downloads
// go through /api/attachments/[id], which re-checks company + confidentiality.

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

  // Push the bytes to the bucket first. If the metadata write then fails we
  // delete the object below, so we never leave a row pointing at nothing (or an
  // orphan object billing storage forever).
  const toObjectStorage = isObjectStorageConfigured();
  let storageKey: string | null = null;
  if (toObjectStorage) {
    storageKey = buildStorageKey(companyId, file.name);
    try {
      await putObject(storageKey, bytes, mimeType);
    } catch {
      return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
    }
  }

  let document;
  try {
    document = await prisma.document.create({
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
        storageKey,
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
            storageKey,
            // Only inline the bytes when there is no bucket to hold them.
            bytes: toObjectStorage ? null : bytes,
            uploadedByUserId: user.id,
            uploadedAt: now,
            createdById: user.id,
          },
        },
      },
      include: { attachments: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
  } catch (error) {
    if (storageKey) await deleteObject(storageKey);
    throw error;
  }

  // Uploading a file is a sensitive write: record who put what where, so file
  // activity is reconstructable alongside the download events.
  await prisma.auditEvent
    .create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "document.upload",
        entityType: "document",
        entityId: document.id,
        summary: `Uploaded "${displayName}" (${Math.round(bytes.length / 1024)} KB) to ${
          toObjectStorage ? "object storage" : "database storage"
        }`,
        companyId,
        ip: clientIpFromHeaders(request.headers),
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ document: documentToDTO(document) }, { status: 201 });
}
