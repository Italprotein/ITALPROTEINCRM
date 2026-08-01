import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { canEdit, canView } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/backend/session";
import { readAttachmentBody } from "@/lib/backend/attachment-content";

export const dynamic = "force-dynamic";

// Streams attachment bytes stored in the database (e.g. NDA files auto-filed
// from Gmail). Internal users see everything; external users only files that
// belong to their own company.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { document: { select: { id: true, companyId: true, confidentialityClass: true } } },
  });
  // Bytes live either in the object-storage bucket (storageKey) or inline in
  // Postgres (bytes) — a row with neither has nothing to serve.
  if (!attachment || (!attachment.bytes && !attachment.storageKey)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (user.kind === "internal") {
    // Being internal is not by itself entitlement. Honour the permission matrix
    // here too: the document library lives under the `ndas` section, and
    // internal-classified files (signed NDAs, investor/financial material)
    // additionally require edit-or-full — view-only roles are refused.
    if (!canView(user.role, "ndas")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      attachment.document?.confidentialityClass === "internal" &&
      !canEdit(user.role, "ndas")
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  } else {
    const allowed =
      attachment.document?.companyId != null &&
      attachment.document.companyId === user.companyId &&
      attachment.document.confidentialityClass !== "internal";
    if (!allowed) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Resolve the bytes only after authorization has passed, so an unauthorized
  // caller never triggers a bucket read.
  let body: Uint8Array | null;
  try {
    body = await readAttachmentBody(attachment);
  } catch {
    return NextResponse.json({ error: "storage_unavailable" }, { status: 503 });
  }
  if (!body) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (attachment.documentId) {
    await Promise.all([
      prisma.document
        .update({ where: { id: attachment.documentId }, data: { downloadCount: { increment: 1 } } })
        .catch(() => undefined),
      prisma.documentAccessEvent
        .create({
          data: {
            documentId: attachment.documentId,
            action: "downloaded",
            confidentialityClassAtAccess: attachment.document?.confidentialityClass,
            actorUserId: user.id,
            result: "success",
          },
        })
        .catch(() => undefined),
    ]);
  }

  const filename = encodeURIComponent(attachment.name).replace(/'/g, "%27");
  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": attachment.mimeType ?? "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}
