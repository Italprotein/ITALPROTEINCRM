"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireInternal } from "@/lib/backend/session";
import type { DocumentRecord, DocumentCategory, DocumentAccessLevel } from "@/lib/types";
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

// NOTE: `documents` is a PORTAL section only — `accessLevel(<internal role>,
// 'documents')` is 'hidden' for every internal role, so requireSection(Edit)
// ('documents') would lock staff out. Internal document management therefore
// guards with requireInternal(); portal surfaces use requireUser().

export async function listDocuments(): Promise<DocumentRecord[]> {
  // Unfiltered library (no confidentiality-class filter here) — internal only.
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: await scopeWhere(),
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
  await requireInternal();
  await prisma.document.delete({ where: { id } }).catch(() => undefined);
  // TODO: object storage not yet integrated — orphaned stored bytes (if any) are
  // not deleted here. Add storage cleanup once signed-storage is wired.
}

export async function documentsByCompany(companyId: string): Promise<DocumentRecord[]> {
  // Admin company/agency detail view. No class filter -> internal only; the
  // portal equivalent is documentsForPortal().
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(documentToDTO);
}

export async function documentsByCategory(category: DocumentCategory): Promise<DocumentRecord[]> {
  // No class filter -> internal only.
  await requireInternal();
  const rows = await prisma.document.findMany({
    where: { AND: [await scopeWhere(), { category }] },
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
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map(documentToDTO)
    .filter((d) => {
      if (PORTAL_OPEN.includes(d.accessLevel)) return !d.companyId || d.companyId === companyId;
      if (POST_NDA.includes(d.accessLevel))
        return ndaSigned && (!d.companyId || d.companyId === companyId);
      return false;
    });
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
