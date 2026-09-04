/**
 * The follow-up register — the pure half.
 *
 * `lib/follow-up.ts` beside this one answers a narrower question ("which
 * companies should Amina raise a task about right now"). This module owns the
 * persistent register behind /admin/follow-ups: the rows a person can edit, the
 * dated outreach freeze, and the rules the sync pass follows when it decides
 * whether a quiet company deserves a row of its own.
 *
 * No Prisma import, so every rule below is unit-testable without a database —
 * the same split as lib/shipment-tracking.ts and lib/company-logo.ts.
 */

import { normalizeEntityName } from "@/lib/email-entity";
import { FOLLOW_UP_AFTER_DAYS, quietDaysSince } from "@/lib/follow-up";
import type { FollowUpSource, FollowUpStatus } from "@/lib/types";

export type { FollowUpSource, FollowUpStatus };

export const FOLLOW_UP_STATUSES: readonly FollowUpStatus[] = [
  "pending",
  "scheduled",
  "waiting",
  "contacted",
  "closed",
];

export const FOLLOW_UP_SOURCES: readonly FollowUpSource[] = [
  "quiet_detection",
  "suppression_list",
  "manual",
];

/**
 * Statuses the sync pass treats as "already handled".
 *
 * A row in any of these states represents a decision somebody made, so the
 * arithmetic must not reopen it. `pending` and `scheduled` are absent because
 * those are the states the sync itself maintains.
 */
export const FOLLOW_UP_SETTLED_STATUSES: readonly FollowUpStatus[] = [
  "waiting",
  "contacted",
  "closed",
];

export function isFollowUpStatus(value: unknown): value is FollowUpStatus {
  return typeof value === "string" && (FOLLOW_UP_STATUSES as readonly string[]).includes(value);
}

export function isFollowUpSource(value: unknown): value is FollowUpSource {
  return typeof value === "string" && (FOLLOW_UP_SOURCES as readonly string[]).includes(value);
}

/** Matchable form of a company name. Shared with the alias register. */
export function normalizeFollowUpName(name: string | null | undefined): string {
  return normalizeEntityName(name);
}

/* ────────────────────────────── Dates ──────────────────────────────
 *
 * `followUpOn` is a calendar date, never an instant. "Do not contact until 11
 * October" is a statement about a day in the office, and storing it as a
 * timestamp makes it arrive on the 10th for anyone west of UTC. Everything
 * below therefore works in whole UTC days on `YYYY-MM-DD` strings.
 * ──────────────────────────────────────────────────────────────────── */

/** `YYYY-MM-DD` for a date or ISO string, in UTC. Empty string when unusable. */
export function toDateKey(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Parse `YYYY-MM-DD` as UTC midnight. Null when the string is not a real date. */
export function parseDateKey(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Rejects 2026-02-31 and friends, which Date would silently roll over.
  return toDateKey(date) === value.trim() ? date : null;
}

/**
 * Whole days from today until `followUpOn`. Negative once the date has passed.
 * Null when there is no date to count towards.
 */
export function daysUntil(
  followUpOn: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  const target = parseDateKey(toDateKey(followUpOn));
  if (!target) return null;
  const today = parseDateKey(toDateKey(now));
  if (!today) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export interface FollowUpRowLike {
  status: FollowUpStatus;
  followUpOn?: Date | string | null;
}

/**
 * Is this row actionable today?
 *
 * `waiting` and `scheduled` both carry a date, and both mean "not yet" until it
 * arrives. A `waiting` row with no date at all is indefinite — someone is
 * holding it deliberately — so it never becomes due on its own.
 */
export function isDue(row: FollowUpRowLike, now: Date = new Date()): boolean {
  if (row.status === "closed" || row.status === "contacted") return false;
  if (row.status === "pending") return true;
  const remaining = daysUntil(row.followUpOn, now);
  if (remaining === null) return false;
  return remaining <= 0;
}

/* ────────────────────────────── The sync pass ────────────────────────────── */

export interface QuietCompany {
  companyId: string;
  companyName: string;
  domain?: string | null;
  /** Last message in EITHER direction — a reply of ours restarts the clock. */
  lastContactAt: Date | string;
  relationshipStage: string;
  /** True when the company sits on the permanent do-not-contact register. */
  doNotContact: boolean;
  /** The existing register row for this company, if it already has one. */
  existing?: {
    status: FollowUpStatus;
    source: FollowUpSource;
    quietDays: number | null;
  } | null;
}

export type QuietSyncSkipReason =
  | "still_warm"
  | "stage_closed"
  | "do_not_contact"
  | "settled_by_hand"
  | "not_ours_to_touch"
  | "unchanged";

export type QuietSyncAction =
  | { kind: "create"; companyId: string; quietDays: number }
  | { kind: "refresh"; companyId: string; quietDays: number }
  | { kind: "skip"; companyId: string; reason: QuietSyncSkipReason };

/**
 * Stages where silence is a decision rather than an oversight. Same pair the
 * dashboard panel and Amina's task pass already exclude.
 */
export const QUIET_CLOSED_STAGES: readonly string[] = ["lost", "dormant"];

/**
 * What the sync should do about one quiet company.
 *
 * The order of the checks is the order of their authority, and the last two are
 * what make the pass safe to run hourly forever:
 *
 *  - A row somebody set to `waiting`, `contacted` or `closed` is a human
 *    decision. The pass may refresh the *numbers* on it but must never move it
 *    back to `pending`, or every Monday would undo Friday's triage.
 *  - A row the pass does not own — one typed in by hand, or imported from the
 *    suppression list — is never touched at all, not even its counters. Those
 *    rows carry dates a person chose, and arithmetic has no business editing
 *    them.
 */
export function planQuietSync(company: QuietCompany, now: Date = new Date()): QuietSyncAction {
  const { companyId } = company;
  const quietDays = quietDaysSince(company.lastContactAt, now);

  if (quietDays < FOLLOW_UP_AFTER_DAYS) return { kind: "skip", companyId, reason: "still_warm" };
  if (QUIET_CLOSED_STAGES.includes(company.relationshipStage)) {
    return { kind: "skip", companyId, reason: "stage_closed" };
  }
  if (company.doNotContact) return { kind: "skip", companyId, reason: "do_not_contact" };

  const existing = company.existing;
  if (!existing) return { kind: "create", companyId, quietDays };

  if (existing.source !== "quiet_detection") {
    return { kind: "skip", companyId, reason: "not_ours_to_touch" };
  }
  if ((FOLLOW_UP_SETTLED_STATUSES as readonly string[]).includes(existing.status)) {
    return { kind: "skip", companyId, reason: "settled_by_hand" };
  }
  if (existing.quietDays === quietDays) return { kind: "skip", companyId, reason: "unchanged" };

  return { kind: "refresh", companyId, quietDays };
}

/* ────────────────────────────── The reconcile pass ──────────────────────────────
 *
 * The sync pass answers "who has gone quiet". This one answers the opposite
 * question, which nothing asked before: who is on the list who should not be.
 *
 * A follow-up row is a reminder, and a reminder that outlives its reason is
 * worse than no reminder — it trains people to ignore the list. Three things
 * end a quiet-detection row's reason for existing:
 *
 *   1. We wrote to them. That is the whole point of the reminder, and the
 *      mailbox already records it; nobody should have to tick it off by hand.
 *   2. The company was marked lost or dormant. `planQuietSync` already refuses
 *      to CREATE a row for one, but a company can be closed after its row
 *      exists and nothing went back for it.
 *   3. The company went onto the permanent do-not-contact register.
 * ──────────────────────────────────────────────────────────────────────────── */

export type FollowUpResolveReason = "recontacted" | "stage_closed" | "do_not_contact";

export interface FollowUpRowState {
  source: FollowUpSource;
  status: FollowUpStatus;
  /** What the row recorded as the last contact when it was raised. */
  lastContactAt?: Date | string | null;
}

export interface FollowUpCompanyState {
  relationshipStage: string;
  doNotContact: boolean;
  /** Last message in EITHER direction, as the mailbox stands now. */
  lastContactAt?: Date | string | null;
}

export type FollowUpReconcileAction =
  | { kind: "resolve"; reason: FollowUpResolveReason }
  | { kind: "keep" };

/**
 * Should this row come off the list?
 *
 * Only `quiet_detection` rows are ever resolved. A suppression-list entry or a
 * hand-typed one carries a date somebody chose, and "they answered" is not a
 * reason to discard a decision that said "leave them alone until October".
 * That is the same ownership rule the sync pass follows, from the other side.
 *
 * "We wrote to them" is measured against the row's own snapshot rather than a
 * fresh silence count, because the two answer different questions: a company
 * can be contacted today and still show ten quiet days if the reply came
 * later. Movement since the row was raised is the honest test.
 */
export function planFollowUpReconcile(
  row: FollowUpRowState,
  company: FollowUpCompanyState,
  now: Date = new Date(),
): FollowUpReconcileAction {
  if (row.source !== "quiet_detection") return { kind: "keep" };

  // A human decision on one of our own rows still outranks the arithmetic;
  // `closed` and `contacted` are already off the actionable list anyway.
  if (row.status === "closed") return { kind: "keep" };

  if (QUIET_CLOSED_STAGES.includes(company.relationshipStage)) {
    return { kind: "resolve", reason: "stage_closed" };
  }
  if (company.doNotContact) return { kind: "resolve", reason: "do_not_contact" };

  const before = row.lastContactAt ? new Date(row.lastContactAt).getTime() : null;
  const after = company.lastContactAt ? new Date(company.lastContactAt).getTime() : null;
  if (before !== null && after !== null && Number.isFinite(before) && Number.isFinite(after)) {
    // Any movement at all means the conversation resumed after we flagged it.
    if (after > before) return { kind: "resolve", reason: "recontacted" };
    // Belt and braces: a row whose company is warm again, even if the snapshot
    // was never written, has no reminder left to give.
    if (quietDaysSince(new Date(after), now) < FOLLOW_UP_AFTER_DAYS) {
      return { kind: "resolve", reason: "recontacted" };
    }
  }

  return { kind: "keep" };
}

/* ────────────────────────────── Statistics ────────────────────────────── */

export interface FollowUpStats {
  total: number;
  /** Actionable today. */
  due: number;
  /** Held until a date that has not arrived yet. */
  waiting: number;
  /** Quiet-detection rows still awaiting a first touch. */
  pending: number;
  contacted: number;
  closed: number;
  byStatus: Record<FollowUpStatus, number>;
  bySource: Record<FollowUpSource, number>;
}

export function followUpStatistics(
  rows: readonly (FollowUpRowLike & { source: FollowUpSource })[],
  now: Date = new Date(),
): FollowUpStats {
  const byStatus = Object.fromEntries(
    FOLLOW_UP_STATUSES.map((s) => [s, 0]),
  ) as Record<FollowUpStatus, number>;
  const bySource = Object.fromEntries(
    FOLLOW_UP_SOURCES.map((s) => [s, 0]),
  ) as Record<FollowUpSource, number>;

  let due = 0;
  let held = 0;
  for (const row of rows) {
    byStatus[row.status] += 1;
    bySource[row.source] += 1;
    if (isDue(row, now)) {
      due += 1;
    } else if (row.status === "waiting" || row.status === "scheduled") {
      // Dated, but the date has not arrived — the "leave alone until" count.
      held += 1;
    }
  }

  return {
    total: rows.length,
    due,
    waiting: held,
    pending: byStatus.pending,
    contacted: byStatus.contacted,
    closed: byStatus.closed,
    byStatus,
    bySource,
  };
}

/* ────────────────────────────── Suppression list ────────────────────────────── */

/**
 * One line of the outreach freeze.
 *
 * Some entries have no domain: the PDF lists counterparties (Pathway
 * International, Verve, Biota Ingredients, …) that exist as conversations but
 * not yet as company records. `followUpOn` overrides the campaign-wide date for
 * the companies that asked for a later one.
 */
export interface SuppressionEntry {
  name: string;
  domain?: string;
  reason: string;
  /** `YYYY-MM-DD`; defaults to the campaign date when absent. */
  followUpOn?: string;
}

export interface SuppressionPlanRow {
  companyName: string;
  normalizedName: string;
  domain: string | null;
  reason: string;
  followUpOn: string;
  status: FollowUpStatus;
  source: FollowUpSource;
}

/**
 * Turn the freeze into rows, applying the campaign date to everyone who did not
 * ask for a later one.
 *
 * Every row lands as `waiting`, which is the whole instruction: the date is
 * when it stops being true, and until then the page must say "leave alone".
 */
export function planSuppressionRows(
  entries: readonly SuppressionEntry[],
  campaignDate: string,
): SuppressionPlanRow[] {
  if (!parseDateKey(campaignDate)) {
    throw new Error(`campaignDate must be YYYY-MM-DD, got ${campaignDate}`);
  }
  return entries.map((entry) => {
    const override = entry.followUpOn ? parseDateKey(entry.followUpOn) : null;
    if (entry.followUpOn && !override) {
      throw new Error(`${entry.name}: followUpOn must be YYYY-MM-DD, got ${entry.followUpOn}`);
    }
    // A date earlier than the campaign date does not shorten the freeze — the
    // rule is a floor. IceDog asked for "end of September", which is inside the
    // window, so it still waits until the 11th.
    const chosen = override && entry.followUpOn! > campaignDate ? entry.followUpOn! : campaignDate;
    return {
      companyName: entry.name,
      normalizedName: normalizeFollowUpName(entry.name),
      domain: entry.domain?.trim().toLowerCase() || null,
      reason: entry.reason,
      followUpOn: chosen,
      status: "waiting",
      source: "suppression_list",
    };
  });
}
