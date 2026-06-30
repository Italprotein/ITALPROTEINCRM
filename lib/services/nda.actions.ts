"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import type { NDA, NDAStatus } from "@/lib/types";
import { ndaToDTO, ndaWriteData } from "./nda.mapper";

// External users see only their own company's NDAs; internal users see all.
async function scopeWhere(): Promise<Prisma.NDAWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

// NDAs are read with their version history and the single signed-file document so
// the DTO can present `versions` and `signedFiles`.
const INCLUDE = {
  versions: { orderBy: { versionDate: "asc" } },
  signedFile: true,
} satisfies Prisma.NDAInclude;

// Statuses whose entry would fire an external email / e-signature request. Not yet
// integrated — the data change is persisted and the side effect is stubbed.
const NOTIFY_STATUSES: NDAStatus[] = [
  "sent",
  "awaiting_italprotein_signature",
  "awaiting_counterparty_signature",
  "fully_signed",
];

export async function listNdas(): Promise<NDA[]> {
  const rows = await prisma.nDA.findMany({
    where: await scopeWhere(),
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(ndaToDTO);
}

export async function getNda(id: string): Promise<NDA | undefined> {
  const rows = await prisma.nDA.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include: INCLUDE,
    take: 1,
  });
  return rows[0] ? ndaToDTO(rows[0]) : undefined;
}

export async function createNda(input: NDA): Promise<NDA> {
  const user = await getCurrentUser();
  const row = await prisma.nDA.create({
    data: { ...ndaWriteData(input, user?.id ?? null), id: input.id, createdById: user?.id ?? null },
    include: INCLUDE,
  });
  // TODO: if input.status is in NOTIFY_STATUSES, dispatch the e-signature / email
  // request once that integration lands. Persisted now; side effect stubbed.
  return ndaToDTO(row);
}

export async function updateNda(id: string, patch: Partial<NDA>): Promise<NDA | undefined> {
  const user = await getCurrentUser();
  const existing = await prisma.nDA.findUnique({ where: { id }, include: INCLUDE });
  if (!existing) return undefined;
  const previousStatus = existing.status;
  const merged: NDA = { ...ndaToDTO(existing), ...patch };
  const row = await prisma.nDA.update({
    where: { id },
    data: ndaWriteData(merged, user?.id ?? null),
    include: INCLUDE,
  });
  // TODO: a transition into a NOTIFY_STATUSES status (e.g. `sent`, `fully_signed`)
  // should trigger the e-signature provider / notification email. Not yet
  // integrated — the status change is persisted and the side effect is stubbed.
  if (merged.status !== previousStatus && NOTIFY_STATUSES.includes(merged.status)) {
    // intentionally no-op until the e-signature integration is wired
  }
  return ndaToDTO(row);
}

export async function removeNda(id: string): Promise<void> {
  await prisma.nDA.delete({ where: { id } }).catch(() => undefined);
}

export async function ndasByCompany(companyId: string): Promise<NDA[]> {
  const rows = await prisma.nDA.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(ndaToDTO);
}

export async function ndaStatistics() {
  const NOW = new Date();
  const AWAITING: NDAStatus[] = [
    "sent",
    "under_review",
    "changes_requested",
    "approved",
    "awaiting_italprotein_signature",
    "awaiting_counterparty_signature",
    "partially_signed",
  ];
  const rows = await prisma.nDA.findMany({
    where: await scopeWhere(),
    select: { status: true, expiryDate: true },
  });
  const byStatus = {} as Record<NDAStatus, number>;
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const expiringSoon = rows.filter((r) => {
    if (!r.expiryDate || r.status !== "fully_signed") return false;
    const days = (r.expiryDate.getTime() - NOW.getTime()) / 86400000;
    return days >= 0 && days <= 60;
  }).length;
  return {
    total: rows.length,
    byStatus,
    awaitingSignature: rows.filter((r) => AWAITING.includes(r.status)).length,
    signed: rows.filter((r) => r.status === "fully_signed").length,
    toPrepare: rows.filter((r) => r.status === "to_prepare" || r.status === "draft").length,
    expiringSoon,
  };
}
