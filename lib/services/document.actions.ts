"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireInternal, requireAction } from "@/lib/backend/session";
import { deleteObject } from "@/lib/backend/storage";
import type { DocumentRecord, DocumentCategory, DocumentAccessLevel } from "@/lib/types";
import { TECHNICAL_CATEGORIES } from "@/lib/technical-docs";
import { documentToDTO, documentWriteData } from "./document.mapper";

// Server-side document scope: external users see only their own company's docs
// (plus org-wide docs with no companyId); internal users see all. The server is
// the authority — client-supplied ids are ignored.
async function scopeWhere(): Promise<Prisma.DocumentWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") {
    return { OR: [{ companyId: user.companyId ?? "__no_company__" }, { companyId: null }] };
  }
  return {};
}

const PORTAL_OPEN: DocumentAccessLevel[] = ["public", "portal_general", "pre_nda"];
const POST_NDA: DocumentAccessLevel[] = ["post_nda", "company_specific"];

// Pull the newest stored attachment id (if any) so the DTO can offer a download
// link. Light: selects a single id, never the bytes.
const withDownload = {
  attachments: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
} satisfies Prisma.DocumentInclude;

// NOTE: `documents` is a PORTAL section only — `accessLevel(<internal role>,
// 'documents')` is 'hidden' for every internal role, so requireSection(Edit)
// ('documents') would lock staff out. Internal document management therefore
// guards with requireInternal(); portal surfaces use requireUser().

export async function listDocuments(): Promise<DocumentRecord[]> {
  // Unfiltered library (no confidentiality-class filter here) — internal only.
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: await scopeWhere(),
    include: withDownload,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(documentToDTO);
}

export async function getDocument(id: string): Promise<DocumentRecord | undefined> {
  // Fetch-by-id applies company scope but NOT the confidentiality-class filter,
  // so an org-wide `internal` document would be readable — internal only.
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include: withDownload,
    take: 1,
  });
  return rows[0] ? documentToDTO(rows[0]) : undefined;
}

export async function createDocument(input: DocumentRecord): Promise<DocumentRecord> {
  // Portal-originated write: clients upload their own files from
  // /portal/documents, so this stays at the authenticated bar.
  const user = await requireUser();
  const row = await prisma.document.create({
    data: {
      ...documentWriteData(input, user.id),
      id: input.id,
      createdById: user.id,
    },
  });
  // TODO: object storage not yet integrated — file bytes are not uploaded here;
  // only the metadata row is persisted. Wire a signed-upload + storageKey later.
  return documentToDTO(row);
}

export async function updateDocument(
  id: string,
  patch: Partial<DocumentRecord>,
): Promise<DocumentRecord | undefined> {
  // No portal caller; the lookup is by raw id (no company scope), so an
  // external caller could otherwise re-class any document. Internal only.
  const user = await requireInternal();
  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: DocumentRecord = { ...documentToDTO(existing), ...patch };
  const row = await prisma.document.update({
    where: { id },
    data: documentWriteData(merged, user.id),
  });
  return documentToDTO(row);
}

export async function removeDocument(id: string): Promise<void> {
  // Deletes by raw id with no company scope — internal only.
  const user = await requireInternal();
  const existing = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      companyId: true,
      storageKey: true,
      attachments: { select: { id: true, storageKey: true } },
    },
  });
  if (!existing) return;

  // Drop the attachment rows explicitly. The relation is optional, so Prisma
  // would otherwise null out documentId and leave the files reachable by id.
  await prisma.attachment.deleteMany({ where: { documentId: id } }).catch(() => undefined);
  await prisma.document.delete({ where: { id } }).catch(() => undefined);

  // Then remove the stored objects so deleted files do not linger in the bucket.
  const keys = [existing.storageKey, ...existing.attachments.map((a) => a.storageKey)].filter(
    (k): k is string => Boolean(k),
  );
  await Promise.all(keys.map((k) => deleteObject(k)));

  await prisma.auditEvent
    .create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "document.delete",
        entityType: "document",
        entityId: id,
        summary: `Deleted "${existing.title}"${keys.length ? ` and ${keys.length} stored file(s)` : ""}`,
        companyId: existing.companyId,
      },
    })
    .catch(() => undefined);
}

export async function documentsByCompany(companyId: string): Promise<DocumentRecord[]> {
  // Admin company/agency detail view. No class filter -> internal only; the
  // portal equivalent is documentsForPortal().
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include: withDownload,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(documentToDTO);
}

export async function documentsByCategory(category: DocumentCategory): Promise<DocumentRecord[]> {
  // No class filter -> internal only.
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: { AND: [await scopeWhere(), { category }] },
    include: withDownload,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(documentToDTO);
}

/** Documents a portal company may see, gated by NDA signed state. */
export async function documentsForPortal(
  companyId: string,
  ndaSigned: boolean,
): Promise<DocumentRecord[]> {
  // Client-facing portal list — authenticated bar only; the company scope and
  // confidentiality-class gating below are unchanged and remain the authority.
  await requireUser();
  // Scope still applies (the server is the authority); 'internal' is never exposed.
  const rows = await prisma.document.findMany({
    where: {
      AND: [
        await scopeWhere(),
        { OR: [{ companyId }, { companyId: null }] },
        { confidentialityClass: { not: "internal" } },
      ],
    },
    include: withDownload,
    orderBy: { createdAt: "desc" },
  });
  // A company's OWN uploads must never vanish behind their NDA state — they
  // provided the file. Portal uploads land as company_specific (POST_NDA), so
  // without this a client uploads a document and immediately loses sight of it.
  const ownUploaderIds = new Set(
    (
      await prisma.user.findMany({
        where: { kind: "external", companyId },
        select: { id: true },
      })
    ).map((u) => u.id),
  );
  return rows
    .map(documentToDTO)
    .filter((d) => {
      const ownUpload =
        d.companyId === companyId && !!d.uploadedByUserId && ownUploaderIds.has(d.uploadedByUserId);
      if (ownUpload) return true;
      if (PORTAL_OPEN.includes(d.accessLevel)) return !d.companyId || d.companyId === companyId;
      if (POST_NDA.includes(d.accessLevel))
        return ndaSigned && (!d.companyId || d.companyId === companyId);
      return false;
    });
}

/**
 * The shared technical library: everything imported from the Drive folder
 * "Documenti Tecnici" plus anything staff added on that page. Membership is
 * defined in lib/technical-docs.ts and shared with the mock service.
 */
export async function technicalDocuments(): Promise<DocumentRecord[]> {
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: {
      AND: [
        await scopeWhere(),
        { companyId: null },
        { category: { in: TECHNICAL_CATEGORIES } },
      ],
    },
    include: withDownload,
    orderBy: { uploadedAt: "desc" },
  });
  return rows.map(documentToDTO);
}

/**
 * Publish or withdraw one library document.
 *
 * Deliberately two levels only, not a general access-level editor: everything
 * synced from Drive is client-visible by default, and this is the way to pull a
 * draft back without deleting it from Drive.
 */
export async function setTechnicalDocumentVisibility(
  id: string,
  level: "post_nda" | "internal",
): Promise<DocumentRecord | undefined> {
  const user = await requireAction("technical_docs.manage");
  const existing = await prisma.document.findUnique({ where: { id } });
  // Guard the scope: this action must never retarget a company-specific file
  // or an NDA, whose visibility is owned by the register.
  if (!existing || existing.companyId || !TECHNICAL_CATEGORIES.includes(existing.category)) {
    return undefined;
  }
  const row = await prisma.document.update({
    where: { id },
    data: { confidentialityClass: level, updatedById: user.id },
    include: withDownload,
  });
  return documentToDTO(row);
}

export async function documentStatistics() {
  // Reports internal-vs-shared document counts — internal only.
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: await scopeWhere(),
    select: { category: true, confidentialityClass: true, sizeBytes: true },
  });
  const byCategory = {} as Record<DocumentCategory, number>;
  for (const r of rows) byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
  return {
    total: rows.length,
    byCategory,
    internal: rows.filter((r) => r.confidentialityClass === "internal").length,
    shared: rows.filter((r) => r.confidentialityClass !== "internal").length,
    totalSizeKb: rows.reduce((s, r) => s + (r.sizeBytes == null ? 0 : Math.round(r.sizeBytes / 1024)), 0),
  };
}
