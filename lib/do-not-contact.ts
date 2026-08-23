/**
 * ITALPROTEIN CRM — do-not-contact rules (pure, no React, no Prisma, no I/O).
 *
 * Shared by the mock service (lib/mock-services/doNotContactService.ts), the
 * Prisma-backed service (lib/services/do-not-contact.ts) and the UI, so the two
 * data modes cannot disagree about what "already listed" means.
 *
 * The one rule that matters: a company appears on this list at most ONCE.
 * `companyId` is unique in the database, and `applyDoNotContactUpsert` is the
 * in-memory equivalent — adding a company that is already listed updates the
 * existing entry rather than appending a second one, which is what lets the
 * page say "already on the list, updated" instead of throwing a unique-key
 * error at whoever tried to protect a company.
 */
import { getLabel } from './labels';
import { DO_NOT_CONTACT_REASONS, type DoNotContactEntry, type DoNotContactReason } from './types';

/** What the Add / Edit dialogs and the server actions submit. */
export interface DoNotContactInput {
  companyId: string;
  reason: DoNotContactReason;
  notes?: string;
}

/** Patch accepted by the edit dialog. An entry's company never moves. */
export interface DoNotContactPatch {
  reason?: DoNotContactReason;
  notes?: string;
}

const REASONS = new Set<string>(DO_NOT_CONTACT_REASONS);

/** Type guard for a value arriving from a form, a URL or an import. */
export function isDoNotContactReason(value: unknown): value is DoNotContactReason {
  return typeof value === 'string' && REASONS.has(value);
}

/**
 * Coerce an untrusted value to a valid reason. Unknown input becomes `other`
 * rather than throwing: the record still needs to exist — refusing to list a
 * company because an importer sent an unmapped code is the dangerous failure.
 */
export function toDoNotContactReason(value: unknown): DoNotContactReason {
  return isDoNotContactReason(value) ? value : 'other';
}

/** Localised human label for a reason (follows `setLabelLocale`). */
export function doNotContactReasonLabel(reason: string | undefined | null): string {
  return getLabel('doNotContactReason', reason);
}

/** Trim notes, treating blank/whitespace-only as "no notes". */
export function normalizeNotes(notes: string | undefined | null): string | undefined {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : undefined;
}

/** True when this company is on the list. */
export function isListed(entries: DoNotContactEntry[], companyId: string): boolean {
  return entries.some((e) => e.companyId === companyId);
}

/** The entry for a company, if any. */
export function findByCompany(
  entries: DoNotContactEntry[],
  companyId: string,
): DoNotContactEntry | undefined {
  return entries.find((e) => e.companyId === companyId);
}

export interface DoNotContactUpsertContext {
  /** Id to use when a new entry is created. Ignored on update. */
  id: string;
  /** Who is doing this. Recorded only on create — see below. */
  addedById?: string;
  /** ISO timestamp for createdAt/updatedAt. */
  now: string;
}

/**
 * What both services return from `add()`. `created: false` is not an error —
 * it is how the page knows to say "already on the list, entry updated".
 */
export interface DoNotContactSaveResult {
  entry: DoNotContactEntry;
  /** False when an existing entry was updated instead of a new one created. */
  created: boolean;
}

export interface DoNotContactUpsertResult extends DoNotContactSaveResult {
  entries: DoNotContactEntry[];
}

/**
 * Add a company to the list, or update it if it is already there.
 *
 * On update the entry keeps its `id`, `createdAt` and `addedById`: those record
 * when the company was FIRST protected and by whom, which is the fact anyone
 * auditing the list wants. Only `reason`, `notes` and `updatedAt` move.
 */
export function applyDoNotContactUpsert(
  entries: DoNotContactEntry[],
  input: DoNotContactInput,
  ctx: DoNotContactUpsertContext,
): DoNotContactUpsertResult {
  const reason = toDoNotContactReason(input.reason);
  const notes = normalizeNotes(input.notes);
  const existing = findByCompany(entries, input.companyId);

  if (existing) {
    const entry: DoNotContactEntry = { ...existing, reason, notes, updatedAt: ctx.now };
    return {
      entries: entries.map((e) => (e.id === existing.id ? entry : e)),
      entry,
      created: false,
    };
  }

  const entry: DoNotContactEntry = {
    id: ctx.id,
    companyId: input.companyId,
    reason,
    notes,
    addedById: ctx.addedById,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  };
  return { entries: [entry, ...entries], entry, created: true };
}
