"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireAction, requireSection } from "@/lib/backend/session";
import { normalizeNotes, toDoNotContactReason } from "@/lib/do-not-contact";
import type {
  DoNotContactInput,
  DoNotContactPatch,
  DoNotContactSaveResult,
} from "@/lib/do-not-contact";
import type { DoNotContactEntry } from "@/lib/types";
import { doNotContactToDTO, doNotContactWriteData } from "./do-not-contact.mapper";

// Do-not-contact register actions. The register is not company-scoped: it lists
// companies staff must NOT approach, so there is no scopeWhere() here.
//
// Reads are gated on requireSection('do_not_contact'), which every internal role
// holds at least at 'view' — the whole point is that anyone about to email a
// company can check first. External portal roles have no such section and are
// refused, as they should be: this is an internal suppression list.
//
// Writes are gated on the narrower requireAction('do_not_contact.manage').
// Removing an entry re-opens a company to outreach it asked to be spared, so
// that right is granted by name (super_admin, crm_admin, business_dev) rather
// than inherited from a section's edit level.

export async function listDoNotContactEntries(): Promise<DoNotContactEntry[]> {
  await requireSection("do_not_contact");
  const rows = await prisma.doNotContactEntry.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(doNotContactToDTO);
}

export async function getDoNotContactEntry(id: string): Promise<DoNotContactEntry | undefined> {
  await requireSection("do_not_contact");
  const row = await prisma.doNotContactEntry.findUnique({ where: { id } });
  return row ? doNotContactToDTO(row) : undefined;
}

export async function doNotContactForCompany(
  companyId: string,
): Promise<DoNotContactEntry | undefined> {
  await requireSection("do_not_contact");
  const row = await prisma.doNotContactEntry.findUnique({ where: { companyId } });
  return row ? doNotContactToDTO(row) : undefined;
}

/**
 * Cheap "may we contact them?" check, for the company header badge today and
 * any send path that wants to ask before dispatching. Selects one column.
 */
export async function isCompanyDoNotContact(companyId: string): Promise<boolean> {
  await requireSection("do_not_contact");
  const row = await prisma.doNotContactEntry.findUnique({
    where: { companyId },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Add a company to the register, or update the entry it already has.
 *
 * `companyId` is unique, so a second add is an update by construction — the
 * caller learns which happened from `created` and tells the user, instead of
 * seeing a unique-constraint error for doing the safe thing twice. The
 * concurrent-create race falls through to the same update path.
 */
export async function addToDoNotContact(input: DoNotContactInput): Promise<DoNotContactSaveResult> {
  const user = await requireAction("do_not_contact.manage");
  const data = doNotContactWriteData(input);

  const existing = await prisma.doNotContactEntry.findUnique({
    where: { companyId: input.companyId },
    select: { id: true },
  });
  if (existing) {
    const row = await prisma.doNotContactEntry.update({
      where: { companyId: input.companyId },
      data,
    });
    return { entry: doNotContactToDTO(row), created: false };
  }

  try {
    const row = await prisma.doNotContactEntry.create({
      data: {
        companyId: input.companyId,
        reason: toDoNotContactReason(input.reason),
        notes: normalizeNotes(input.notes) ?? null,
        addedById: user.id,
      },
    });
    return { entry: doNotContactToDTO(row), created: true };
  } catch {
    // Someone listed the same company between the check and the insert. The
    // outcome they both wanted is "this company is suppressed" — honour it.
    const row = await prisma.doNotContactEntry.update({
      where: { companyId: input.companyId },
      data,
    });
    return { entry: doNotContactToDTO(row), created: false };
  }
}

export async function updateDoNotContactEntry(
  id: string,
  patch: DoNotContactPatch,
): Promise<DoNotContactEntry | undefined> {
  await requireAction("do_not_contact.manage");
  const existing = await prisma.doNotContactEntry.findUnique({ where: { id } });
  if (!existing) return undefined;
  const row = await prisma.doNotContactEntry.update({
    where: { id },
    data: doNotContactWriteData({
      reason: patch.reason ?? existing.reason,
      notes: "notes" in patch ? patch.notes : existing.notes,
    }),
  });
  return doNotContactToDTO(row);
}

/**
 * Remove a company from the register — the one destructive direction here.
 * Adding a company is safe; removing one means someone may email a company that
 * asked not to be contacted, so the UI puts a named confirmation in front of it.
 */
export async function removeFromDoNotContact(id: string): Promise<void> {
  await requireAction("do_not_contact.manage");
  await prisma.doNotContactEntry.delete({ where: { id } }).catch(() => undefined);
}
