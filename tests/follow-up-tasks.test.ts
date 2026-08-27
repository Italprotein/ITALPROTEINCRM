import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect } from 'vitest';

import {
  FOLLOW_UP_AFTER_DAYS,
  FOLLOW_UP_CLOSED_STAGES,
  followUpTaskDecision,
  followUpTaskDescription,
  followUpTaskTitle,
  quietDaysSince,
  type FollowUpTaskContext,
} from '@/lib/follow-up';

/*
 * The deterministic half of Amina's follow-up pass.
 *
 * Everything the pass decides — is this company quiet enough, is it one we are
 * allowed to chase, and would a task be a duplicate — lives in these pure
 * functions so it can be tested without a database, a session or a model call.
 * The action around them only fetches rows and writes the one task this module
 * says to write.
 */

const NOW = new Date('2026-08-27T09:00:00.000Z');

/** `days` before NOW. */
function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 86_400_000);
}

function context(overrides: Partial<FollowUpTaskContext> = {}): FollowUpTaskContext {
  return {
    relationshipStage: 'negotiation',
    lastContactAt: daysAgo(11),
    doNotContact: false,
    hasOpenFollowUpTask: false,
    lastFollowUpCompletedAt: null,
    ...overrides,
  };
}

describe('quietDaysSince', () => {
  it('counts whole days of silence', () => {
    expect(quietDaysSince(daysAgo(11), NOW)).toBe(11);
    expect(quietDaysSince(daysAgo(0.5), NOW)).toBe(0);
  });

  it('never returns a negative count for a timestamp in the future', () => {
    expect(quietDaysSince(new Date(NOW.getTime() + 86_400_000), NOW)).toBe(0);
  });
});

describe('followUpTaskDecision — is the company a candidate?', () => {
  it('creates a task for a company quiet for 11 days', () => {
    expect(followUpTaskDecision(context({ lastContactAt: daysAgo(11) }), NOW)).toEqual({
      create: true,
      quietDays: 11,
    });
  });

  it('creates a task the day the threshold is reached', () => {
    const decision = followUpTaskDecision(
      context({ lastContactAt: daysAgo(FOLLOW_UP_AFTER_DAYS) }),
      NOW,
    );
    expect(decision).toEqual({ create: true, quietDays: FOLLOW_UP_AFTER_DAYS });
  });

  it('does not create a task for a company quiet for only 9 days', () => {
    expect(followUpTaskDecision(context({ lastContactAt: daysAgo(9) }), NOW)).toEqual({
      create: false,
      reason: 'still_warm',
    });
  });

  it.each(FOLLOW_UP_CLOSED_STAGES)('skips a %s company however quiet it is', (stage) => {
    expect(
      followUpTaskDecision(context({ relationshipStage: stage, lastContactAt: daysAgo(90) }), NOW),
    ).toEqual({ create: false, reason: 'stage_closed' });
  });

  it('skips a company on the do-not-contact register', () => {
    expect(followUpTaskDecision(context({ doNotContact: true }), NOW)).toEqual({
      create: false,
      reason: 'do_not_contact',
    });
  });
});

describe('followUpTaskDecision — dedupe', () => {
  it('never creates a second task while an open follow-up exists', () => {
    expect(followUpTaskDecision(context({ hasOpenFollowUpTask: true }), NOW)).toEqual({
      create: false,
      reason: 'open_task_exists',
    });
  });

  it('holds off while the last follow-up was completed recently', () => {
    expect(
      followUpTaskDecision(
        context({ lastContactAt: daysAgo(40), lastFollowUpCompletedAt: daysAgo(3) }),
        NOW,
      ),
    ).toEqual({ create: false, reason: 'recently_followed_up' });
  });

  it('allows a new task when the completed follow-up is itself older than the threshold', () => {
    expect(
      followUpTaskDecision(
        context({ lastContactAt: daysAgo(40), lastFollowUpCompletedAt: daysAgo(12) }),
        NOW,
      ),
    ).toEqual({ create: true, quietDays: 40 });
  });

  it('an open task outranks an old completion — one open follow-up at a time', () => {
    expect(
      followUpTaskDecision(
        context({ hasOpenFollowUpTask: true, lastFollowUpCompletedAt: daysAgo(60) }),
        NOW,
      ),
    ).toEqual({ create: false, reason: 'open_task_exists' });
  });

  it('creates exactly one task when the pass runs twice over the same company', () => {
    // The property the whole feature rests on: the second pass sees the task the
    // first one wrote and declines. Modelled the way the action works — decide,
    // write, re-read.
    const written: { companyId: string; open: boolean }[] = [];
    const company = { id: 'c_bulla', lastContactAt: daysAgo(21) };

    function pass() {
      const decision = followUpTaskDecision(
        {
          relationshipStage: 'negotiation',
          lastContactAt: company.lastContactAt,
          doNotContact: false,
          hasOpenFollowUpTask: written.some((t) => t.companyId === company.id && t.open),
          lastFollowUpCompletedAt: null,
        },
        NOW,
      );
      if (decision.create) written.push({ companyId: company.id, open: true });
      return decision;
    }

    expect(pass().create).toBe(true);
    expect(pass()).toEqual({ create: false, reason: 'open_task_exists' });
    expect(pass()).toEqual({ create: false, reason: 'open_task_exists' });
    expect(written).toHaveLength(1);
  });
});

describe('the stored strings are Italian', () => {
  /*
   * A task title is written once and read by whoever opens the task later, in
   * whatever locale their browser happens to be in. It cannot follow the viewer,
   * so it follows the team — same rule as the meeting notifications.
   */
  it('names the company and the silence', () => {
    expect(followUpTaskTitle('Bulla Dairy Foods', 21)).toBe(
      'Follow-up Bulla Dairy Foods: nessuna risposta da 21 giorni',
    );
  });

  it('attributes the task to Amina in the description', () => {
    const description = followUpTaskDescription({
      companyName: 'Bulla Dairy Foods',
      quietDays: 21,
      lastInboundSubject: 'RE: Proamina',
    });
    expect(description).toContain('Amina');
    expect(description).toContain('21 giorni');
    expect(description).toContain('RE: Proamina');
  });

  it('copes with a thread that has no subject', () => {
    const description = followUpTaskDescription({
      companyName: 'Bulla Dairy Foods',
      quietDays: 21,
      lastInboundSubject: null,
    });
    expect(description).toContain('Amina');
    expect(description).not.toContain('null');
  });
});

/*
 * The pass itself needs a database, so it cannot be unit-tested here. What CAN
 * be checked without one — and is exactly what would rot silently — is that the
 * action still delegates to the rule above, still looks at every follow-up task
 * whoever made it, and still runs before the AI early-returns. Each assertion
 * below was confirmed to fail when the property it names was removed.
 */
describe('the pass wires the rule up (structural)', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'lib', 'services', 'ai-task.actions.ts'),
    'utf8',
  );

  it('decides with the tested rule instead of an inline predicate', () => {
    expect(source).toContain('followUpTaskDecision(');
    expect(source).toContain('followUpTaskTitle(');
  });

  it('writes a system-sourced follow_up task', () => {
    expect(source).toMatch(/type:\s*"follow_up"/);
    expect(source).toMatch(/source:\s*"system"/);
  });

  it('dedupes across the whole company, not just this member', () => {
    const pass = source.slice(
      source.indexOf('async function createQuietCompanyFollowUpTasks'),
      source.indexOf('export async function generateAiTasksFromInbox'),
    );
    // The DEDUPE query specifically — the one that reads completedAt so the
    // "wait out the threshold again" rule can see closed follow-ups. The pass
    // also runs a separate, deliberately status-filtered query to exclude
    // companies before the batch cap; that one is asserted below.
    const dedupeSelect = pass.indexOf('completedAt: true');
    expect(dedupeSelect, 'the pass must read the existing follow-up tasks').toBeGreaterThan(-1);
    const queryStart = pass.lastIndexOf('prisma.task.findMany(', dedupeSelect);
    expect(queryStart).toBeGreaterThan(-1);
    const where = pass.slice(queryStart, pass.indexOf('select:', queryStart));

    expect(where, 'the dedupe query must be company + type scoped').toContain('type: "follow_up"');
    expect(where, 'a follow-up someone else created must still block a new one').not.toContain(
      'ownerUserId',
    );
    expect(where, 'a follow-up someone else created must still block a new one').not.toContain(
      'createdById',
    );
    // Status is filtered in code, not in SQL, precisely so a COMPLETED follow-up
    // is still visible to the "wait out the threshold again" rule.
    expect(where).not.toContain('status:');
  });

  it('excludes open follow-ups BEFORE the batch cap, not after it', () => {
    const pass = source.slice(
      source.indexOf('async function createQuietCompanyFollowUpTasks'),
      source.indexOf('export async function generateAiTasksFromInbox'),
    );
    const exclusion = pass.indexOf('prisma.task.findMany(');
    const capped = pass.indexOf('followUpCandidates(');
    expect(exclusion, 'the pass must read which companies already hold one').toBeGreaterThan(-1);
    // Order is the whole fix: filtering after the cap let the quietest companies
    // hold every slot with tasks that already existed, so nothing behind them
    // could ever be reached.
    expect(exclusion).toBeLessThan(capped);
    const where = pass.slice(exclusion, pass.indexOf('select:', exclusion));
    expect(where).toContain('type: "follow_up"');
    expect(where, 'only OPEN tasks exclude a company from the batch').toContain('notIn');
    expect(pass, 'the exclusion must reach the candidate query').toMatch(
      /followUpCandidates\(\s*FOLLOW_UP_TASK_BATCH,/,
    );
  });

  it('runs before the AI configuration and rate-limit early returns', () => {
    const deterministic = source.indexOf('createQuietCompanyFollowUpTasks(user)');
    const aiConfigured = source.indexOf('if (!isCrmTaskAiConfigured())');
    const dailyLimit = source.indexOf('peekRateLimit(');
    expect(deterministic).toBeGreaterThan(-1);
    expect(deterministic).toBeLessThan(aiConfigured);
    expect(deterministic).toBeLessThan(dailyLimit);
  });

  it('reports the tasks it created even when the AI half fails', () => {
    // Running first is only safe if failing says so. `tasks` is REQUIRED on the
    // failure variant, so the compiler refuses any new early return that would
    // tell the operator nothing happened while rows sat in their list — make
    // that field optional and this test is the thing that notices.
    expect(source).toMatch(
      /ok:\s*false;\s*error:\s*AiTaskError;\s*retryAfterSeconds\?:\s*number;\s*tasks:\s*Task\[\]/,
    );
    // Bounded to THIS function: createAiReplyDraft below it returns a different
    // result type that has no tasks to report.
    const pass = source.slice(
      source.indexOf('export async function generateAiTasksFromInbox'),
      source.indexOf('function replySubject('),
    );
    const failures = [...pass.matchAll(/return\s*\{[^}]*ok:\s*false[^}]*\}/g)].map((m) => m[0]);
    expect(failures.length).toBeGreaterThan(3);
    for (const failure of failures) {
      expect(failure, `this failure hides the follow-ups it created: ${failure}`).toContain('tasks:');
    }
  });
});
