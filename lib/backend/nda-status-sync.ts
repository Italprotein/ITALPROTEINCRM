import { randomUUID } from "node:crypto";

import type { Prisma, NDAStatus } from "@/lib/generated/prisma/client";

const CURRENT_ORDER = [
  { updatedAt: "desc" as const },
  { createdAt: "desc" as const },
  { id: "desc" as const },
];

/** Materialise the current register row on Company for fast lists and portal gates. */
export async function syncCompanyNdaStatus(
  tx: Prisma.TransactionClient,
  companyId: string,
): Promise<NDAStatus> {
  const current = await tx.nDA.findFirst({
    where: { companyId },
    orderBy: CURRENT_ORDER,
    select: { status: true },
  });
  const status = current?.status ?? "not_required";
  await tx.company.update({ where: { id: companyId }, data: { ndaStatus: status } });
  return status;
}

/**
 * Company-list edits are redirected to the canonical current NDA row.  This
 * exists for server compatibility; the company UI now presents the field as
 * read-only and sends users to the NDA register for lifecycle changes.
 */
export async function setCurrentNdaStatus(
  tx: Prisma.TransactionClient,
  companyId: string,
  status: NDAStatus,
  actorId: string | null,
): Promise<void> {
  const current = await tx.nDA.findFirst({
    where: { companyId },
    orderBy: CURRENT_ORDER,
    select: { id: true },
  });

  if (current) {
    await tx.nDA.update({
      where: { id: current.id },
      data: { status, updatedById: actorId },
    });
  } else if (status !== "not_required") {
    await tx.nDA.create({
      data: {
        reference: `NDA-CRM-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        companyId,
        status,
        reminderDates: [],
        createdById: actorId,
        updatedById: actorId,
      },
    });
  }

  await tx.company.update({ where: { id: companyId }, data: { ndaStatus: status } });
}

