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

/* ────────────────────────────── Silence ──────────────────────────────
 *
 * The single definition of "quiet", shared by both passes.
 *
 * It lives here, once, because the scan and the reconcile ask the same
 * question from opposite ends — "should this appear" and "should this still
 * appear" — and two implementations of that would drift into a loop where one
 * raises what the other retires.
 *
 * A conversation has two sides and either can go quiet:
 *
 *   · WE are silent when our last message is older than the threshold, or when
 *     we have never written at all.
 *   · THEY are silent when their last message is, or when they never replied.
 *
 * A company appears when EITHER is true, and is invisible only when both sides
 * have spoken inside the window. That means cold outreach shows from the day it
 * is sent — they have never written, so they are silent — and stays until they
 * answer. On production that is 515 of 526 touched companies, which is the
 * intended reading: the list is "who is not talking to us", not "who did we
 * forget".
 * ──────────────────────────────────────────────────────────────────────── */

/** Who the conversation is waiting on, from who spoke last. */
export type WaitingOn = "us" | "them" | "unknown";

export interface SilenceInput {
  /** Our most recent message to them. */
  lastOutboundAt?: Date | string | null;
  /** Their most recent message to us. */
  lastInboundAt?: Date | string | null;
  /**
   * The CRM's own record of a touch, used only when there is no mail at all.
   *
   * 318 of 602 production companies have no linked message — their
   * correspondence predates the sync window or was never attributed — and
   * without this they could never be evaluated. It carries no direction, so it
   * counts for both sides equally.
   */
  lastActivityAt?: Date | string | null;
}

export interface Silence {
  /** False when nothing is known about this company at all. */
  known: boolean;
  weSilent: boolean;
  theySilent: boolean;
  waitingOn: WaitingOn;
  /** Days since our last message; null when we have never written. */
  ourQuietDays: number | null;
  /** Days since theirs; null when they have never written. */
  theirQuietDays: number | null;
  /** Days since the last message in either direction — the headline number. */
  quietDays: number;
  /** The instant `quietDays` was measured from. */
  lastTouchAt: Date | null;
}

const asTime = (value: Date | string | null | undefined): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

export function evaluateSilence(input: SilenceInput, now: Date = new Date()): Silence {
  const ours = asTime(input.lastOutboundAt);
  const theirs = asTime(input.lastInboundAt);
  const activity = asTime(input.lastActivityAt);

  const nothing: Silence = {
    known: false,
    weSilent: false,
    theySilent: false,
    waitingOn: "unknown",
    ourQuietDays: null,
    theirQuietDays: null,
    quietDays: 0,
    lastTouchAt: null,
  };

  // No mail either way: the activity date is all there is, and it says nothing
  // about direction, so it applies to both sides identically.
  if (ours === null && theirs === null) {
    if (activity === null) return nothing;
    const days = quietDaysSince(new Date(activity), now);
    const silent = days >= FOLLOW_UP_AFTER_DAYS;
    return {
      known: true,
      weSilent: silent,
      theySilent: silent,
      waitingOn: "unknown",
      ourQuietDays: null,
      theirQuietDays: null,
      quietDays: days,
      lastTouchAt: new Date(activity),
    };
  }

  const ourQuietDays = ours === null ? null : quietDaysSince(new Date(ours), now);
  const theirQuietDays = theirs === null ? null : quietDaysSince(new Date(theirs), now);

  // Never having written is the strongest form of silence, not an absence of
  // evidence: a prospect who has never replied is exactly who the list is for.
  const weSilent = ourQuietDays === null || ourQuietDays >= FOLLOW_UP_AFTER_DAYS;
  const theySilent = theirQuietDays === null || theirQuietDays >= FOLLOW_UP_AFTER_DAYS;

  const lastTouch = Math.max(ours ?? -Infinity, theirs ?? -Infinity, activity ?? -Infinity);
  const lastTouchAt = Number.isFinite(lastTouch) ? new Date(lastTouch) : null;

  return {
    known: true,
    weSilent,
    theySilent,
    // Whoever spoke last hands the turn to the other side.
    waitingOn: (theirs ?? -Infinity) > (ours ?? -Infinity) ? "us" : "them",
    ourQuietDays,
    theirQuietDays,
    quietDays: lastTouchAt ? quietDaysSince(lastTouchAt, now) : 0,
    lastTouchAt,
  };
}

/** The rule itself: either side quiet puts the company on the list. */
export function needsFollowUp(silence: Silence): boolean {
  return silence.known && (silence.weSilent || silence.theySilent);
}

/* ────────────────────────────── The sync pass ────────────────────────────── */

export interface QuietCompany {
  companyId: string;
  companyName: string;
  domain?: string | null;
  /** The two sides of the conversation, and the fallback. See evaluateSilence. */
  silence: SilenceInput;
  /**
   * How far follow-ups are already settled for this company — a contact
   * instant, not a clock reading. See Company.followUpClearedThrough.
   */
  clearedThrough?: Date | string | null;
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
  | "already_cleared"
  | "stage_closed"
  | "do_not_contact"
  | "settled_by_hand"
  | "not_ours_to_touch"
  | "unchanged";

export type QuietSyncAction =
  | { kind: "create"; companyId: string; quietDays: number; silence: Silence }
  | { kind: "refresh"; companyId: string; quietDays: number; silence: Silence }
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
  const silence = evaluateSilence(company.silence, now);
  const quietDays = silence.quietDays;

  // Both sides spoke inside the window — nobody is waiting on anybody.
  if (!needsFollowUp(silence)) return { kind: "skip", companyId, reason: "still_warm" };
  if (QUIET_CLOSED_STAGES.includes(company.relationshipStage)) {
    return { kind: "skip", companyId, reason: "stage_closed" };
  }
  if (company.doNotContact) return { kind: "skip", companyId, reason: "do_not_contact" };

  // Already dealt with, and nothing has happened since.
  //
  // Without this the two passes fight each other: reconcile retires a row
  // because we answered them 20 days ago, and the scan puts it straight back
  // because 20 days is still longer than the threshold. The company would
  // reappear on the list every single run, having been explicitly cleared.
  if (company.clearedThrough && silence.lastTouchAt) {
    const cleared = asTime(company.clearedThrough);
    if (cleared !== null && silence.lastTouchAt.getTime() <= cleared) {
      return { kind: "skip", companyId, reason: "already_cleared" };
    }
  }

  const existing = company.existing;
  if (!existing) return { kind: "create", companyId, quietDays, silence };

  if (existing.source !== "quiet_detection") {
    return { kind: "skip", companyId, reason: "not_ours_to_touch" };
  }
  if ((FOLLOW_UP_SETTLED_STATUSES as readonly string[]).includes(existing.status)) {
    return { kind: "skip", companyId, reason: "settled_by_hand" };
  }
  if (existing.quietDays === quietDays) return { kind: "skip", companyId, reason: "unchanged" };

  return { kind: "refresh", companyId, quietDays, silence };
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
}

export interface FollowUpCompanyState {
  relationshipStage: string;
  doNotContact: boolean;
  /** The two sides of the conversation as they stand now. */
  silence: SilenceInput;
}

export type FollowUpReconcileAction =
  | { kind: "resolve"; reason: FollowUpResolveReason }
  | { kind: "keep" };

/**
 * Should this row come off the list?
 *
 * The exact inverse of the scan, by construction: a row is retired when
 * `needsFollowUp` would no longer raise it. Sharing `evaluateSilence` is what
 * guarantees that — two hand-written versions of "quiet" would drift, and the
 * drift shows up as a row the reconcile deletes and the scan immediately
 * recreates, every run, forever.
 *
 * Under the either-side rule that means both sides must have spoken inside the
 * window. Us answering is not enough on its own: if they still have not
 * replied, the conversation is still one-sided and still worth chasing.
 *
 * Only `quiet_detection` rows are ever resolved. A suppression-list entry or a
 * hand-typed one carries a date somebody chose, and "they answered" is not a
 * reason to discard a decision that said leave them alone until October.
 */
export function planFollowUpReconcile(
  row: FollowUpRowState,
  company: FollowUpCompanyState,
  now: Date = new Date(),
): FollowUpReconcileAction {
  if (row.source !== "quiet_detection") return { kind: "keep" };

  // A human decision on one of our own rows still outranks the arithmetic.
  if (row.status === "closed") return { kind: "keep" };

  if (QUIET_CLOSED_STAGES.includes(company.relationshipStage)) {
    return { kind: "resolve", reason: "stage_closed" };
  }
  if (company.doNotContact) return { kind: "resolve", reason: "do_not_contact" };

  const silence = evaluateSilence(company.silence, now);
  // Nothing is known any more (mail unlinked, activity cleared) — keep the row
  // rather than deleting on an absence of evidence.
  if (!silence.known) return { kind: "keep" };
  if (!needsFollowUp(silence)) return { kind: "resolve", reason: "recontacted" };

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
