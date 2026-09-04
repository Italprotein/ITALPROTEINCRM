"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireSection, requireSectionEdit } from "@/lib/backend/session";
import {
  followUpStatistics,
  isFollowUpStatus,
  parseDateKey,
  type FollowUpStats,
  type FollowUpStatus,
} from "@/lib/follow-ups";
import {
  runFollowUpReconcile,
  runFollowUpSync,
  type FollowUpReconcileReport,
} from "@/lib/backend/follow-up-register";
import type { FollowUp } from "@/lib/types";
import {
  followUpToDTO,
  followUpWriteData,
  type FollowUpFormInput,
} from "./follow-up-register.mapper";

// Follow-up register actions.
//
// Reads are gated on requireSection('follow_ups') — internal roles only; the
// section does not exist for portal roles, so an external user is refused
// before any query runs. Writes take requireSectionEdit('follow_ups'), which
// super_admin, crm_admin and business_dev hold. R&D and finance have the
// section hidden entirely: chasing commercial conversations is not their work.

/** The company columns the table needs for the flag and the logo tile. */
const COMPANY_JOIN = { select: { countryCode: true, logoUpdatedAt: true } } as const;

/**
 * Ordering, and why it is this way: rows that need doing come first, oldest
 * date at the top, and everything undated falls to the bottom. `nulls: "last"`
 * matters — without it Postgres sorts NULL dates first on ASC and the page
 * opens on the rows with no deadline at all.
 */
const ORDER = [
  { followUpOn: { sort: "asc", nulls: "last" } },
  { quietDays: { sort: "desc", nulls: "last" } },
  { companyName: "asc" },
] as const;

export type FollowUpSaveResult =
  | { ok: true; followUp: FollowUp; created: boolean }
  // Returned, never thrown: Next redacts thrown server-action messages in
  // production, so a business refusal must travel as a result.
  | { ok: false; reason: "duplicate_company" | "missing_name" };

export async function listFollowUps(): Promise<FollowUp[]> {
  await requireSection("follow_ups");
  const rows = await prisma.followUp.findMany({
    orderBy: [...ORDER],
    include: { company: COMPANY_JOIN },
  });
  return rows.map(followUpToDTO);
}

export async function getFollowUp(id: string): Promise<FollowUp | undefined> {
  await requireSection("follow_ups");
  const row = await prisma.followUp.findUnique({
    where: { id },
    include: { company: COMPANY_JOIN },
  });
  return row ? followUpToDTO(row) : undefined;
}

export async function followUpStats(): Promise<FollowUpStats> {
  await requireSection("follow_ups");
  const rows = await prisma.followUp.findMany({
    select: { status: true, source: true, followUpOn: true },
  });
  return followUpStatistics(rows);
}

/** Duplicate guard: one open row per company, and one per name when unlinked. */
async function findClash(
  companyId: string | null,
  normalizedName: string,
): Promise<{ id: string } | null> {
  if (companyId) {
    return prisma.followUp.findUnique({ where: { companyId }, select: { id: true } });
  }
  // Unlinked rows have no unique key in the database (two production companies
  // normalize to the same name, so a constraint would reject one of them). The
  // check therefore lives here, and only ever compares unlinked against
  // unlinked — a hand-typed name must not collide with a linked company's row.
  return prisma.followUp.findFirst({
    where: { companyId: null, normalizedName },
    select: { id: true },
  });
}

export async function createFollowUp(input: FollowUpFormInput): Promise<FollowUpSaveResult> {
  const user = await requireSectionEdit("follow_ups");
  const data = followUpWriteData(input);
  if (!data.companyName) return { ok: false, reason: "missing_name" };

  const clash = await findClash(data.companyId, data.normalizedName);
  if (clash) return { ok: false, reason: "duplicate_company" };

  try {
    const row = await prisma.followUp.create({
      data: {
        ...data,
        createdById: user.id,
        statusChangedById: user.id,
        statusChangedAt: new Date(),
      },
      include: { company: COMPANY_JOIN },
    });
    return { ok: true, followUp: followUpToDTO(row), created: true };
  } catch {
    // Concurrent create for the same company between the check and the insert.
    return { ok: false, reason: "duplicate_company" };
  }
}

export async function updateFollowUp(
  id: string,
  input: FollowUpFormInput,
): Promise<FollowUpSaveResult | undefined> {
  const user = await requireSectionEdit("follow_ups");
  const existing = await prisma.followUp.findUnique({ where: { id } });
  if (!existing) return undefined;

  const data = followUpWriteData(input);
  if (!data.companyName) return { ok: false, reason: "missing_name" };

  const clash = await findClash(data.companyId, data.normalizedName);
  if (clash && clash.id !== id) return { ok: false, reason: "duplicate_company" };

  const statusChanged = data.status !== existing.status;
  try {
    const row = await prisma.followUp.update({
      where: { id },
      data: {
        ...data,
        // Editing the notes must not rewrite the audit trail on the status.
        ...(statusChanged ? { statusChangedById: user.id, statusChangedAt: new Date() } : {}),
      },
      include: { company: COMPANY_JOIN },
    });
    return { ok: true, followUp: followUpToDTO(row), created: false };
  } catch {
    return { ok: false, reason: "duplicate_company" };
  }
}

/**
 * Change one row's status from the table, without touching anything else.
 *
 * Separate from `updateFollowUp` on purpose. The inline control sends only what
 * it changed, so a stale row in a browser tab cannot silently revert a date or
 * a note somebody else edited in the meantime.
 */
export async function setFollowUpStatus(
  id: string,
  status: FollowUpStatus,
  followUpOn?: string | null,
): Promise<FollowUp | undefined> {
  const user = await requireSectionEdit("follow_ups");
  if (!isFollowUpStatus(status)) return undefined;

  const existing = await prisma.followUp.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return undefined;

  const row = await prisma.followUp.update({
    where: { id },
    data: {
      status,
      // `undefined` leaves the column alone; an explicit null clears it.
      ...(followUpOn === undefined
        ? {}
        : { followUpOn: followUpOn === null ? null : parseDateKey(followUpOn) }),
      statusChangedById: user.id,
      statusChangedAt: new Date(),
    },
    include: { company: COMPANY_JOIN },
  });
  return followUpToDTO(row);
}

/** The one destructive direction; the UI puts a named confirmation before it. */
export async function removeFollowUp(id: string): Promise<void> {
  await requireSectionEdit("follow_ups");
  await prisma.followUp.delete({ where: { id } }).catch(() => undefined);
}

/**
 * Companies with no register row yet — what the "add" sheet offers.
 *
 * Excludes anything already listed so the picker cannot produce a duplicate the
 * save would then have to refuse.
 */
export async function followUpCompanyOptions(): Promise<
  { id: string; name: string; countryCode: string }[]
> {
  await requireSection("follow_ups");
  const rows = await prisma.company.findMany({
    where: { followUp: { is: null } },
    select: { id: true, legalName: true, tradingName: true, countryCode: true },
    orderBy: { legalName: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.tradingName || row.legalName,
    countryCode: row.countryCode,
  }));
}

/** Re-scan the mailbox for newly quiet companies. Safe to run repeatedly. */
export async function syncFollowUps() {
  const user = await requireSectionEdit("follow_ups");
  return runFollowUpSync({ actorId: user.id });
}

/**
 * Drop the rows that no longer need chasing.
 *
 * Gated on section *edit* rather than read, even though the page calls it on
 * open: it deletes rows, and a viewer who may only read the register must not
 * be able to change it by navigating to it.
 */
export async function reconcileFollowUps(): Promise<FollowUpReconcileReport> {
  await requireSectionEdit("follow_ups");
  return runFollowUpReconcile();
}

/*
 * No `export type { FollowUpSyncReport }` here, however convenient it looks.
 *
 * A "use server" file may only export async functions, and the server-action
 * transform enforces that by emitting a runtime binding for every export it
 * sees — including a type-only re-export, whose binding TypeScript has already
 * erased. The result is `ReferenceError: FollowUpSyncReport is not defined`
 * thrown at *module evaluation*, which takes down every page that reaches this
 * module through lib/mock-services — the companies list included. It is a
 * runtime-only failure, so typecheck, lint and the build all pass.
 *
 * Consumers import the type straight from @/lib/backend/follow-up-register.
 * A type-only import is erased, so that costs a client bundle nothing.
 */
