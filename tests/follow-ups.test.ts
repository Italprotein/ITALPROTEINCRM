import { describe, expect, it } from 'vitest';

import {
  FOLLOW_UP_SOURCES,
  FOLLOW_UP_STATUSES,
  daysUntil,
  followUpStatistics,
  isDue,
  normalizeFollowUpName,
  parseDateKey,
  planFollowUpReconcile,
  planQuietSync,
  planSuppressionRows,
  toDateKey,
  type QuietCompany,
  type FollowUpRowState,
  type FollowUpCompanyState,
} from '@/lib/follow-ups';
import { FOLLOW_UP_AFTER_DAYS } from '@/lib/follow-up';

const NOW = new Date('2026-09-01T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function quiet(overrides: Partial<QuietCompany> = {}): QuietCompany {
  return {
    companyId: 'c1',
    companyName: 'Acme',
    lastContactAt: daysAgo(30),
    relationshipStage: 'contacted',
    doNotContact: false,
    existing: null,
    ...overrides,
  };
}

describe('dates', () => {
  it('keeps a calendar date on the calendar day it was written', () => {
    // The whole reason followUpOn is a DATE and not a timestamp: 11 October
    // must read as 11 October regardless of where the reader sits.
    expect(toDateKey('2026-10-11')).toBe('2026-10-11');
    expect(toDateKey(new Date('2026-10-11T00:00:00.000Z'))).toBe('2026-10-11');
  });

  it('rejects dates that do not exist instead of rolling them over', () => {
    expect(parseDateKey('2026-02-31')).toBeNull();
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('not a date')).toBeNull();
    expect(parseDateKey('')).toBeNull();
    expect(parseDateKey('2026-10-11')?.toISOString()).toBe('2026-10-11T00:00:00.000Z');
  });

  it('counts whole days to the target, negative once it has passed', () => {
    expect(daysUntil('2026-09-11', NOW)).toBe(10);
    expect(daysUntil('2026-09-01', NOW)).toBe(0);
    expect(daysUntil('2026-08-25', NOW)).toBe(-7);
    expect(daysUntil(null, NOW)).toBeNull();
  });
});

describe('isDue', () => {
  it('treats pending as actionable immediately', () => {
    expect(isDue({ status: 'pending' }, NOW)).toBe(true);
  });

  it('holds a dated row until its date arrives, then releases it', () => {
    expect(isDue({ status: 'waiting', followUpOn: '2026-10-11' }, NOW)).toBe(false);
    expect(isDue({ status: 'waiting', followUpOn: '2026-09-01' }, NOW)).toBe(true);
    expect(isDue({ status: 'scheduled', followUpOn: '2026-08-20' }, NOW)).toBe(true);
  });

  it('never resurfaces a row somebody closed or already answered', () => {
    expect(isDue({ status: 'closed', followUpOn: '2026-01-01' }, NOW)).toBe(false);
    expect(isDue({ status: 'contacted', followUpOn: '2026-01-01' }, NOW)).toBe(false);
  });

  it('leaves an undated hold alone forever — someone is holding it on purpose', () => {
    expect(isDue({ status: 'waiting' }, NOW)).toBe(false);
  });
});

describe('planQuietSync', () => {
  it('creates a row once a company passes the silence threshold', () => {
    const action = planQuietSync(quiet({ lastContactAt: daysAgo(30) }), NOW);
    expect(action).toEqual({ kind: 'create', companyId: 'c1', quietDays: 30 });
  });

  it('leaves a company alone until the threshold is actually reached', () => {
    const justUnder = planQuietSync(
      quiet({ lastContactAt: daysAgo(FOLLOW_UP_AFTER_DAYS - 1) }),
      NOW,
    );
    expect(justUnder).toEqual({ kind: 'skip', companyId: 'c1', reason: 'still_warm' });

    const exactly = planQuietSync(quiet({ lastContactAt: daysAgo(FOLLOW_UP_AFTER_DAYS) }), NOW);
    expect(exactly.kind).toBe('create');
  });

  it('respects the two human decisions that outrank arithmetic', () => {
    expect(planQuietSync(quiet({ relationshipStage: 'lost' }), NOW)).toEqual({
      kind: 'skip', companyId: 'c1', reason: 'stage_closed',
    });
    expect(planQuietSync(quiet({ relationshipStage: 'dormant' }), NOW).kind).toBe('skip');
    expect(planQuietSync(quiet({ doNotContact: true }), NOW)).toEqual({
      kind: 'skip', companyId: 'c1', reason: 'do_not_contact',
    });
  });

  it('refreshes only the counters on a row it created itself', () => {
    const action = planQuietSync(
      quiet({ existing: { status: 'pending', source: 'quiet_detection', quietDays: 12 } }),
      NOW,
    );
    expect(action).toEqual({ kind: 'refresh', companyId: 'c1', quietDays: 30 });
  });

  it('does not rewrite a row whose counters are already right', () => {
    const action = planQuietSync(
      quiet({ existing: { status: 'pending', source: 'quiet_detection', quietDays: 30 } }),
      NOW,
    );
    expect(action).toEqual({ kind: 'skip', companyId: 'c1', reason: 'unchanged' });
  });

  it('never drags a row somebody triaged back to pending', () => {
    // The regression this guards: the pass runs hourly, so a row marked
    // "contacted" on Friday would be reopened every hour until Monday.
    for (const status of ['waiting', 'contacted', 'closed'] as const) {
      expect(
        planQuietSync(
          quiet({ existing: { status, source: 'quiet_detection', quietDays: 1 } }),
          NOW,
        ),
      ).toEqual({ kind: 'skip', companyId: 'c1', reason: 'settled_by_hand' });
    }
  });

  it('does not touch a row it does not own, not even its counters', () => {
    for (const source of ['suppression_list', 'manual'] as const) {
      expect(
        planQuietSync(
          quiet({ existing: { status: 'pending', source, quietDays: 1 } }),
          NOW,
        ),
      ).toEqual({ kind: 'skip', companyId: 'c1', reason: 'not_ours_to_touch' });
    }
  });
});

describe('planSuppressionRows', () => {
  const campaign = '2026-10-11';

  it('puts every entry on the campaign date, held and unactionable', () => {
    const [row] = planSuppressionRows(
      [{ name: 'Bulla Dairy Foods', domain: 'bulla.com.au', reason: 'Active sample' }],
      campaign,
    );
    expect(row).toMatchObject({
      companyName: 'Bulla Dairy Foods',
      normalizedName: 'bulla dairy foods',
      domain: 'bulla.com.au',
      followUpOn: campaign,
      status: 'waiting',
      source: 'suppression_list',
    });
    expect(isDue(row, NOW)).toBe(false);
  });

  it('lets a company that asked for a later date keep it', () => {
    const [row] = planSuppressionRows(
      [{ name: 'Ristora', reason: 'Nov-Dec 2026', followUpOn: '2026-11-01' }],
      campaign,
    );
    expect(row.followUpOn).toBe('2026-11-01');
  });

  it('treats the campaign date as a floor, not a suggestion', () => {
    // IceDog asked to reconnect "end of September", which is INSIDE the freeze.
    // The campaign rule only lets a later date override, so it still waits.
    const [row] = planSuppressionRows(
      [{ name: 'IceDog', reason: 'end of September', followUpOn: '2026-09-30' }],
      campaign,
    );
    expect(row.followUpOn).toBe(campaign);
  });

  it('keeps entries that have no company record and no domain', () => {
    const rows = planSuppressionRows(
      [{ name: 'Pathway International', reason: 'ANZ distribution' }],
      campaign,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].domain).toBeNull();
  });

  it('refuses a malformed campaign or entry date rather than guessing', () => {
    expect(() => planSuppressionRows([], '11/10/2026')).toThrow(/YYYY-MM-DD/);
    expect(() =>
      planSuppressionRows([{ name: 'X', reason: 'y', followUpOn: '2026-02-31' }], campaign),
    ).toThrow(/YYYY-MM-DD/);
  });
});

describe('followUpStatistics', () => {
  it('separates what needs doing from what is deliberately held', () => {
    const stats = followUpStatistics(
      [
        { status: 'pending', source: 'quiet_detection' },
        { status: 'pending', source: 'quiet_detection' },
        { status: 'waiting', source: 'suppression_list', followUpOn: '2026-10-11' },
        { status: 'waiting', source: 'suppression_list', followUpOn: '2026-08-01' },
        { status: 'contacted', source: 'manual' },
        { status: 'closed', source: 'manual' },
      ],
      NOW,
    );
    expect(stats.total).toBe(6);
    // 2 pending + 1 waiting whose date has passed.
    expect(stats.due).toBe(3);
    // The one freeze still running.
    expect(stats.waiting).toBe(1);
    expect(stats.contacted).toBe(1);
    expect(stats.closed).toBe(1);
    expect(stats.bySource.suppression_list).toBe(2);
  });

  it('starts every status and source at zero so the cards never render blank', () => {
    const stats = followUpStatistics([], NOW);
    for (const status of FOLLOW_UP_STATUSES) expect(stats.byStatus[status]).toBe(0);
    for (const source of FOLLOW_UP_SOURCES) expect(stats.bySource[source]).toBe(0);
    expect(stats.total).toBe(0);
  });
});

describe('normalizeFollowUpName', () => {
  it('matches the same organisation written two ways', () => {
    expect(normalizeFollowUpName('Charles & Alice')).toBe(normalizeFollowUpName('charles alice'));
    expect(normalizeFollowUpName('EcorNaturaSì')).toBe('ecornaturasi');
  });
});


describe('planFollowUpReconcile', () => {
  const RAISED = daysAgo(30).toISOString();

  const row = (over: Partial<FollowUpRowState> = {}): FollowUpRowState => ({
    source: 'quiet_detection',
    status: 'pending',
    lastContactAt: RAISED,
    ...over,
  });

  const company = (over: Partial<FollowUpCompanyState> = {}): FollowUpCompanyState => ({
    relationshipStage: 'contacted',
    doNotContact: false,
    lastContactAt: RAISED,
    ...over,
  });

  it('keeps a row nothing has happened on', () => {
    expect(planFollowUpReconcile(row(), company(), NOW)).toEqual({ kind: 'keep' });
  });

  it('drops a row once we have written to them again', () => {
    // The reminder's whole purpose, discharged. The mailbox already knows;
    // nobody should have to tick it off by hand.
    expect(
      planFollowUpReconcile(row(), company({ lastContactAt: daysAgo(2).toISOString() }), NOW),
    ).toEqual({ kind: 'resolve', reason: 'recontacted' });
  });

  it('drops a row whose company has since been marked lost or dormant', () => {
    // planQuietSync already refuses to CREATE one of these. Nothing went back
    // for the rows that existed before the stage changed.
    for (const relationshipStage of ['lost', 'dormant']) {
      expect(planFollowUpReconcile(row(), company({ relationshipStage }), NOW)).toEqual({
        kind: 'resolve',
        reason: 'stage_closed',
      });
    }
  });

  it('drops a row whose company went onto the do-not-contact register', () => {
    expect(planFollowUpReconcile(row(), company({ doNotContact: true }), NOW)).toEqual({
      kind: 'resolve',
      reason: 'do_not_contact',
    });
  });

  it('measures contact against the row, not against a fresh silence count', () => {
    // Contacted 20 days ago is still "quiet" by the 10-day threshold, but it is
    // movement since the row was raised 30 days ago, so the reminder is spent.
    expect(
      planFollowUpReconcile(row(), company({ lastContactAt: daysAgo(20).toISOString() }), NOW),
    ).toEqual({ kind: 'resolve', reason: 'recontacted' });
  });

  it('never touches a row it does not own', () => {
    // A freeze entry saying "leave them alone until October" is not undone by
    // them happening to reply.
    for (const source of ['suppression_list', 'manual'] as const) {
      expect(
        planFollowUpReconcile(
          row({ source }),
          company({ relationshipStage: 'lost', doNotContact: true, lastContactAt: NOW.toISOString() }),
          NOW,
        ),
      ).toEqual({ kind: 'keep' });
    }
  });

  it('leaves a row somebody deliberately closed alone', () => {
    expect(
      planFollowUpReconcile(
        row({ status: 'closed' }),
        company({ lastContactAt: daysAgo(1).toISOString() }),
        NOW,
      ),
    ).toEqual({ kind: 'keep' });
  });

  it('keeps a row it cannot judge rather than guessing', () => {
    expect(planFollowUpReconcile(row({ lastContactAt: null }), company(), NOW)).toEqual({
      kind: 'keep',
    });
    expect(planFollowUpReconcile(row(), company({ lastContactAt: null }), NOW)).toEqual({
      kind: 'keep',
    });
  });
});
