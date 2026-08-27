/**
 * Shape and threshold for the follow-up list. A plain module, not the
 * `"use server"` one beside it: a server-action file may only export async
 * functions, so the constant and the type live here.
 */

/** Days of silence before a conversation counts as stalled. */
export const FOLLOW_UP_AFTER_DAYS = 10;

export interface FollowUpCandidate {
  companyId: string;
  companyName: string;
  countryCode: string;
  /** Days since the last message in either direction. */
  quietDays: number;
  /** How many times they have written to us. */
  inboundCount: number;
  /** Subject of their most recent reply — the thread to pick back up. */
  lastInboundSubject: string | null;
  lastInboundAt: string;
  /**
   * Last message in EITHER direction — the timestamp `quietDays` is measured
   * from. The panel shows the day count; the follow-up task pass needs the
   * instant it was floored from, so it is carried here rather than
   * reconstructed from a rounded number of days.
   */
  lastContactAt: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * Amina's automatic follow-up tasks.
 *
 * The pass that writes them (lib/services/ai-task.actions.ts) is deliberately
 * NOT a model call: silence is arithmetic, and a task that appears because a
 * language model felt like it would be impossible to explain. Everything it
 * decides lives here as pure functions, so the rules are testable without a
 * database and readable without following a prompt.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Stages where silence is a decision rather than an oversight. Same pair the
 * follow-up panel excludes (lib/services/follow-up.actions.ts) — chasing a
 * company someone marked lost is exactly the noise that makes people stop
 * trusting an assistant.
 */
export const FOLLOW_UP_CLOSED_STAGES = ['lost', 'dormant'] as const;

export interface FollowUpTaskContext {
  /** `Company.relationshipStage`. */
  relationshipStage: string;
  /** Last message in EITHER direction — a reply of ours restarts the clock. */
  lastContactAt: Date | string;
  /** True when the company sits on the do-not-contact register. */
  doNotContact: boolean;
  /** A follow_up task that is neither done nor cancelled already exists. */
  hasOpenFollowUpTask: boolean;
  /** When the most recent follow_up task for this company was completed. */
  lastFollowUpCompletedAt?: Date | string | null;
}

export type FollowUpTaskSkipReason =
  | 'stage_closed'
  | 'do_not_contact'
  | 'still_warm'
  | 'open_task_exists'
  | 'recently_followed_up';

export type FollowUpTaskDecision =
  | { create: true; quietDays: number }
  | { create: false; reason: FollowUpTaskSkipReason };

/** Whole days between `since` and `now`, floored, never negative. */
export function quietDaysSince(since: Date | string, now: Date): number {
  const at = since instanceof Date ? since : new Date(since);
  return Math.max(0, Math.floor((now.getTime() - at.getTime()) / 86_400_000));
}

/**
 * Should the pass write a follow-up task for this company right now?
 *
 * The order of the checks is the order of their authority. "Do not contact" and
 * a closed stage are human decisions and outrank everything; the silence
 * threshold decides whether there is anything to chase at all; the last two are
 * the dedupe, and they are what makes the pass safe to run on every trigger:
 *
 *  - `hasOpenFollowUpTask` — one open follow-up per company, whoever made it.
 *  - `lastFollowUpCompletedAt` — once someone closes the task, we wait out the
 *    same threshold again before raising another. That is why the dedupe
 *    expires on its own instead of needing anything to be auto-completed: a
 *    company that answers restarts the silence clock, and a company that stays
 *    quiet earns a fresh task ten days after the last one was ticked off.
 */
export function followUpTaskDecision(
  context: FollowUpTaskContext,
  now: Date = new Date(),
): FollowUpTaskDecision {
  if ((FOLLOW_UP_CLOSED_STAGES as readonly string[]).includes(context.relationshipStage)) {
    return { create: false, reason: 'stage_closed' };
  }
  if (context.doNotContact) return { create: false, reason: 'do_not_contact' };

  const quietDays = quietDaysSince(context.lastContactAt, now);
  if (quietDays < FOLLOW_UP_AFTER_DAYS) return { create: false, reason: 'still_warm' };

  if (context.hasOpenFollowUpTask) return { create: false, reason: 'open_task_exists' };

  if (context.lastFollowUpCompletedAt) {
    const sinceCompletion = quietDaysSince(context.lastFollowUpCompletedAt, now);
    if (sinceCompletion < FOLLOW_UP_AFTER_DAYS) {
      return { create: false, reason: 'recently_followed_up' };
    }
  }

  return { create: true, quietDays };
}

/*
 * Italian, always. A task title is stored once and read later by whoever opens
 * the task, in whatever locale their browser is in — it cannot follow the
 * viewer, so it follows the team. Same rule the meeting notifications already
 * apply to their stored copy.
 */

export function followUpTaskTitle(companyName: string, quietDays: number): string {
  return `Follow-up ${companyName}: nessuna risposta da ${quietDays} giorni`;
}

export function followUpTaskDescription(input: {
  companyName: string;
  quietDays: number;
  lastInboundSubject: string | null;
}): string {
  const subject = input.lastInboundSubject?.trim();
  const thread = subject ? `Ultimo scambio: "${subject}".` : 'Ultimo scambio senza oggetto.';
  return [
    `${input.companyName} non scrive e non riceve nostri messaggi da ${input.quietDays} giorni.`,
    thread,
    'Riprendi il filo o chiudi la conversazione.',
    '',
    'Attività creata automaticamente da Amina: silenzio rilevato dalle email, nessuna AI coinvolta.',
  ].join('\n');
}
