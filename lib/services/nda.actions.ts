"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import {
  requireUser,
  requireInternal,
  requireAction,
  requireSectionEdit,
} from "@/lib/backend/session";
import type { NDA, NDAStatus } from "@/lib/types";
import { syncCompanyNdaStatus } from "@/lib/backend/nda-status-sync";
import { currentNdaByCompany, ndaScopeWhere } from "@/lib/backend/nda-current-status";
import { selectCurrentNdasWithFile } from "@/lib/nda-current";
import { ndaStatusTallies } from "@/lib/nda-stats";
import { ndaToDTO, ndaWriteData } from "./nda.mapper";

// NDAs are read with their version history and the single signed-file document so
// the DTO can present `versions` and `signedFiles`.
const INCLUDE = {
  versions: { orderBy: { versionDate: "asc" } },
  signedFile: {
    include: {
      attachments: {
        where: { OR: [{ bytes: { not: null } }, { storageKey: { not: null } }] },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  },
} satisfies Prisma.NDAInclude;

// Statuses whose entry would fire an external email / e-signature request. Not yet
// integrated — the data change is persisted and the side effect is stubbed.
const NOTIFY_STATUSES: NDAStatus[] = [
  "sent",
  "awaiting_italprotein_signature",
  "awaiting_counterparty_signature",
  "fully_signed",
];

// Recording a signature is the transition the permissions matrix reserves for
// `nda.mark_signed` (business_dev may prepare/send but never mark signed).
const SIGNATURE_STATUSES: NDAStatus[] = ["partially_signed", "fully_signed"];

export async function listNdas(): Promise<NDA[]> {
  // Internal NDA register — no portal surface reads the unscoped list.
  await requireInternal();
  const rows = await prisma.nDA.findMany({
    where: await ndaScopeWhere(),
    include: INCLUDE,
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
  });
  return selectCurrentNdasWithFile(
    rows,
    (row) => row.companyId,
    (row) => Boolean(row.signedFile?.attachments[0]),
    (row) => (row.signedFile?.uploadedAt ?? row.signedFile?.createdAt)?.getTime() ?? 0,
  ).map(({ current, fileSource }) =>
    ndaToDTO({ ...current, signedFile: fileSource?.signedFile ?? null }),
  );
}

export async function getNda(id: string): Promise<NDA | undefined> {
  // Scoped read: `scopeWhere()` already limits external users to their company.
  await requireUser();
  const rows = await prisma.nDA.findMany({
    where: { AND: [await ndaScopeWhere(), { id }] },
    include: INCLUDE,
    take: 1,
  });
  return rows[0] ? ndaToDTO(rows[0]) : undefined;
}

export async function createNda(input: NDA): Promise<NDA> {
  const user = await requireAction("nda.prepare");
  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.nDA.create({
      data: { ...ndaWriteData(input, user.id), id: input.id, createdById: user.id },
      include: INCLUDE,
    });
    await syncCompanyNdaStatus(tx, input.companyId);
    return created;
  });
  // TODO: if input.status is in NOTIFY_STATUSES, dispatch the e-signature / email
  // request once that integration lands. Persisted now; side effect stubbed.
  return ndaToDTO(row);
}

export async function updateNda(id: string, patch: Partial<NDA>): Promise<NDA | undefined> {
  // Baseline: only internal roles with edit rights on the NDA register may write.
  const user = await requireSectionEdit("ndas");
  const existing = await prisma.nDA.findUnique({ where: { id }, include: INCLUDE });
  if (!existing) return undefined;
  const previousStatus = existing.status;
  const merged: NDA = { ...ndaToDTO(existing), ...patch };
  // Lifecycle transitions carry their own action rights on top of the baseline.
  if (merged.status !== previousStatus) {
    if (merged.status === "sent") await requireAction("nda.send");
    if (SIGNATURE_STATUSES.includes(merged.status)) await requireAction("nda.mark_signed");
  }
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.nDA.update({
      where: { id },
      data: ndaWriteData(merged, user.id),
      include: INCLUDE,
    });
    await syncCompanyNdaStatus(tx, updated.companyId);
    if (existing.companyId !== updated.companyId) {
      await syncCompanyNdaStatus(tx, existing.companyId);
    }
    return updated;
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
  await requireSectionEdit("ndas");
  const existing = await prisma.nDA.findUnique({ where: { id }, select: { companyId: true } });
  if (!existing) return;
  await prisma.$transaction(async (tx) => {
    await tx.nDA.delete({ where: { id } });
    await syncCompanyNdaStatus(tx, existing.companyId);
  });
}

export async function ndasByCompany(companyId: string): Promise<NDA[]> {
  // Portal-facing (dashboard + profile show the company's own NDA state);
  // `scopeWhere()` keeps external users inside their own company.
  await requireUser();
  const rows = await prisma.nDA.findMany({
    where: { AND: [await ndaScopeWhere(), { companyId }] },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(ndaToDTO);
}

export async function ndaStatistics() {
  // Every count comes from the register, reduced to one current row per company.
  // Company.ndaStatus is a cache and is deliberately not counted here — counting
  // it separately is what let this page disagree with its own table.
  await requireUser();
  const now = new Date();
  const current = await currentNdaByCompany(await ndaScopeWhere());
  const rows = [...current.values()];
  const tallies = ndaStatusTallies(rows.map((row) => row.status));
  const expiringSoon = rows.filter((row) => {
    if (!row.expiryDate || row.status !== "fully_signed") return false;
    const days = (row.expiryDate.getTime() - now.getTime()) / 86400000;
    return days >= 0 && days <= 60;
  }).length;
  return { ...tallies, expiringSoon };
}
