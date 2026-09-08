/**
 * The follow-up sync: which companies have gone quiet, and what to do about it.
 *
 * Deliberately NOT a `"use server"` module — it is the implementation the
 * guarded action and the cron route both call, and putting the guard here would
 * mean the cron route needed a session it does not have. Same split as
 * lib/backend/shipment-tracking.ts.
 *
 * Every decision it makes is delegated to `planQuietSync` in lib/follow-ups.ts,
 * which has no database import and is unit-tested without one. What is left
 * here is reading, writing, and nothing else.
 */

import { prisma } from "@/lib/backend/prisma";
import { FOLLOW_UP_AFTER_DAYS } from "@/lib/follow-up";
import {
  evaluateSilence,
  normalizeFollowUpName,
  planFollowUpReconcile,
  planQuietSync,
  type FollowUpResolveReason,
  type QuietCompany,
  type QuietSyncSkipReason,
  type Silence,
  type SilenceInput,
} from "@/lib/follow-ups";
import { registrableDomainOf } from "@/lib/email-entity";

export interface FollowUpSyncReport {
  ok: true;
  /** Companies with at least one message in the mailbox. */
  scanned: number;
  /** Quiet longer than the threshold. */
  quiet: number;
  created: number;
  refreshed: number;
  skipped: Record<QuietSyncSkipReason, number>;
}

/**
 * The stored reason, in Italian, naming the side that went quiet.
 *
 * Written once at creation and read later by whoever opens the row, in
 * whatever locale their browser is in — it cannot follow the viewer, so it
 * follows the team. Same rule the follow-up task titles already apply.
 */
function reasonFor(silence: Silence): string {
  if (silence.waitingOn === "unknown") {
    return `Nessuna attività da ${silence.quietDays} giorni`;
  }
  if (silence.theirQuietDays === null) return "Mai risposto";
  if (silence.waitingOn === "us") {
    return `Non rispondiamo da ${silence.ourQuietDays ?? silence.quietDays} giorni`;
  }
  return `Non rispondono da ${silence.theirQuietDays} giorni`;
}

const emptySkips = (): Record<QuietSyncSkipReason, number> => ({
  still_warm: 0,
  already_cleared: 0,
  stage_closed: 0,
  do_not_contact: 0,
  settled_by_hand: 0,
  not_ours_to_touch: 0,
  unchanged: 0,
});

/**
 * Scan the synced mailbox and bring the register up to date.
 *
 * "Reached out to" is read as *any* message in either direction attached to the
 * company, not just ours. A company that wrote to us first and never heard back
 * is exactly the follow-up worth surfacing, and requiring an outbound message
 * would hide it.
 *
 * The pass only ever creates or refreshes its own `quiet_detection` rows, and
 * never deletes: taking a row off the list is `runFollowUpReconcile` below,
 * which is a separate question with separate rules. The status a person set is
 * never contradicted by arithmetic in either direction.
 */
export async function runFollowUpSync(
  options: { actorId?: string | null; now?: Date } = {},
): Promise<FollowUpSyncReport> {
  const now = options.now ?? new Date();
  const actorId = options.actorId ?? null;

  // Each side separately. A conversation can be quiet because we stopped
  // writing or because they did, and the rule treats those as independent
  // reasons to appear — so a single "last message" figure cannot answer it.
  const sides = await prisma.emailMessage.groupBy({
    by: ["companyId", "direction"],
    where: { companyId: { not: null } },
    _max: { internalDate: true },
  });

  const lastOutbound = new Map<string, Date>();
  const lastInbound = new Map<string, Date>();
  for (const row of sides) {
    const at = row._max.internalDate;
    if (!row.companyId || !at) continue;
    (row.direction === "outbound" ? lastOutbound : lastInbound).set(row.companyId, at);
  }

  // Every company, not just the ones with mail.
  //
  // Starting from the mailbox was the original mistake: on production 318 of
  // 602 companies have no linked message at all — Nestlé, Ferrero, Sammontana,
  // a fully-signed NDA at Grezzo Raw Chocolate — because their correspondence
  // predates the sync window or was never attributed. None of them could ever
  // appear on the follow-up list, however long they had been silent. For those
  // the CRM's own lastActivityAt is the only record of a touch there is.
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      legalName: true,
      tradingName: true,
      website: true,
      relationshipStage: true,
      lastActivityAt: true,
      followUpClearedThrough: true,
      doNotContact: { select: { id: true } },
      followUp: {
        select: { id: true, status: true, source: true, quietDays: true, waitingOn: true },
      },
      contacts: { select: { email: true }, take: 1, orderBy: { isPrimary: "desc" } },
    },
  });

  /** Everything evaluateSilence needs about one company. */
  const silenceOf = (companyId: string, lastActivityAt: Date | null): SilenceInput => ({
    lastOutboundAt: lastOutbound.get(companyId) ?? null,
    lastInboundAt: lastInbound.get(companyId) ?? null,
    lastActivityAt,
  });

  const report: FollowUpSyncReport = {
    ok: true,
    scanned: companies.length,
    quiet: 0,
    created: 0,
    refreshed: 0,
    skipped: emptySkips(),
  };

  for (const company of companies) {
    const name = company.tradingName || company.legalName;
    const input: QuietCompany = {
      companyId: company.id,
      companyName: name,
      // The website column is empty for almost every row, so a contact address
      // is the practical source of a domain. Same finding as the logo importer.
      domain: registrableDomainOf(company.website || company.contacts[0]?.email) || null,
      silence: silenceOf(company.id, company.lastActivityAt),
      clearedThrough: company.followUpClearedThrough,
      relationshipStage: company.relationshipStage,
      doNotContact: company.doNotContact != null,
      existing: company.followUp
        ? {
            status: company.followUp.status,
            source: company.followUp.source,
            quietDays: company.followUp.quietDays,
            waitingOn: company.followUp.waitingOn,
          }
        : null,
    };

    const action = planQuietSync(input, now);
    if (action.kind === "skip") {
      report.skipped[action.reason] += 1;
      if (action.reason !== "still_warm") report.quiet += 1;
      continue;
    }

    report.quiet += 1;

    if (action.kind === "create") {
      await prisma.followUp.create({
        data: {
          companyId: company.id,
          companyName: name,
          normalizedName: normalizeFollowUpName(name),
          domain: input.domain,
          status: "pending",
          source: "quiet_detection",
          reason: reasonFor(action.silence),
          lastContactAt: action.silence.lastTouchAt,
          quietDays: action.quietDays,
          ourQuietDays: action.silence.ourQuietDays,
          theirQuietDays: action.silence.theirQuietDays,
          waitingOn: action.silence.waitingOn,
          createdById: actorId,
        },
      });
      report.created += 1;
      continue;
    }

    // refresh: the counters only. Status, date, reason and notes are whatever
    // the last person to look at this row decided they should be.
    await prisma.followUp.update({
      where: { companyId: company.id },
      data: {
        lastContactAt: action.silence.lastTouchAt,
        quietDays: action.quietDays,
        ourQuietDays: action.silence.ourQuietDays,
        theirQuietDays: action.silence.theirQuietDays,
        waitingOn: action.silence.waitingOn,
      },
    });
    report.refreshed += 1;
  }

  return report;
}

/* ────────────────────────────── Reconcile ────────────────────────────── */

export interface FollowUpReconcileReport {
  ok: true;
  /** Quiet-detection rows examined. */
  checked: number;
  /** Rows taken off the list, by why. */
  resolved: Record<FollowUpResolveReason, number>;
  /** Total removed. */
  removed: number;
}

const emptyResolved = (): Record<FollowUpResolveReason, number> => ({
  recontacted: 0,
  stage_closed: 0,
  do_not_contact: 0,
});

/**
 * Take off the list everything that no longer needs to be on it.
 *
 * Rows are deleted rather than parked in a `contacted` state. They are
 * generated, not authored: the mailbox is the record of what happened, and the
 * row was only ever a reminder pointing at it. Keeping resolved reminders
 * around is what turns a working list into one people stop reading — and if the
 * company goes quiet again, the sync raises a fresh row on its next pass, with
 * a correct day count rather than a stale one.
 *
 * Nothing outside `quiet_detection` is touched. The outreach freeze and
 * hand-typed rows carry decisions, and "they replied" is not grounds to discard
 * a decision that said leave them alone until October.
 */
export async function runFollowUpReconcile(
  options: { now?: Date } = {},
): Promise<FollowUpReconcileReport> {
  const now = options.now ?? new Date();
  const report: FollowUpReconcileReport = {
    ok: true,
    checked: 0,
    resolved: emptyResolved(),
    removed: 0,
  };

  const rows = await prisma.followUp.findMany({
    where: { source: "quiet_detection", companyId: { not: null } },
    select: {
      id: true,
      companyId: true,
      source: true,
      status: true,
      company: {
        select: {
          relationshipStage: true,
          lastActivityAt: true,
          doNotContact: { select: { id: true } },
        },
      },
    },
  });
  report.checked = rows.length;
  if (rows.length === 0) return report;

  // One grouped query rather than one per row, split by direction because the
  // rule this reverses needs each side separately.
  const sides = await prisma.emailMessage.groupBy({
    by: ["companyId", "direction"],
    where: { companyId: { in: rows.map((row) => row.companyId!) } },
    _max: { internalDate: true },
  });
  const lastOutbound = new Map<string, Date>();
  const lastInbound = new Map<string, Date>();
  for (const row of sides) {
    const at = row._max.internalDate;
    if (!row.companyId || !at) continue;
    (row.direction === "outbound" ? lastOutbound : lastInbound).set(row.companyId, at);
  }

  const doomed: string[] = [];
  const clearedThrough = new Map<string, Date>();
  for (const row of rows) {
    if (!row.company) continue;
    const silence: SilenceInput = {
      lastOutboundAt: lastOutbound.get(row.companyId!) ?? null,
      lastInboundAt: lastInbound.get(row.companyId!) ?? null,
      lastActivityAt: row.company.lastActivityAt,
    };
    const action = planFollowUpReconcile(
      { source: row.source, status: row.status },
      {
        relationshipStage: row.company.relationshipStage,
        doNotContact: row.company.doNotContact != null,
        silence,
      },
      now,
    );
    if (action.kind === "resolve") {
      doomed.push(row.id);
      report.resolved[action.reason] += 1;
      const at = evaluateSilence(silence, now).lastTouchAt;
      if (at) clearedThrough.set(row.companyId!, at);
    }
  }

  if (doomed.length > 0) {
    // Record how far each company is cleared BEFORE dropping the rows, so a
    // scan running immediately after cannot raise them again. The stamp is
    // the contact instant, not the clock: a later conversation moves past it
    // and the company becomes eligible again, which is the point.
    for (const [companyId, at] of clearedThrough) {
      await prisma.company
        .update({ where: { id: companyId }, data: { followUpClearedThrough: at } })
        .catch(() => undefined);
    }
    const deleted = await prisma.followUp.deleteMany({ where: { id: { in: doomed } } });
    report.removed = deleted.count;
  }
  return report;
}

/** Exposed for the route's log line, so the threshold is stated where it acts. */
export { FOLLOW_UP_AFTER_DAYS };
