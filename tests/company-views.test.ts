import { describe, it, expect } from 'vitest';

import { COMPANY_VIEWS, type CompanyView, type CompanyViewContext } from '@/lib/company-views';
import { FOLLOW_UP_AFTER_DAYS } from '@/lib/follow-up';
import type { Company } from '@/lib/types';

/*
 * Saved views are the Zoho-style entry point to the companies list: pick a view,
 * the table narrows. Every predicate is pure and synchronous so it can be run
 * client-side over the already-loaded rows (no extra fetch) — which also makes
 * it exhaustively testable here without a database or a browser.
 *
 * The two date-driven views have deliberately chosen inclusive boundaries:
 *   recent7  → diffDays <= 7
 *   quiet10  → diffDays >= FOLLOW_UP_AFTER_DAYS (10)
 * so the 8th and 9th day belong to neither view. Both edges are pinned below.
 */

const NOW = new Date('2026-08-14T12:00:00.000Z');
const CTX: CompanyViewContext = { accountId: 'u-owner', now: NOW };

/** Minimal Company fixture. Only the fields a predicate reads matter. */
function company(patch: Partial<Company> = {}): Company {
  return {
    id: 'c-1',
    legalName: 'Fixture Srl',
    type: 'food_manufacturer',
    initials: 'FS',
    country: 'Italy',
    countryCode: 'IT',
    city: 'Milano',
    accountOwnerId: 'u-owner',
    relationshipStage: 'lead',
    priority: 'medium',
    ndaStatus: 'not_required',
    createdAt: NOW.toISOString(),
    ...patch,
  } as Company;
}

/** ISO string for a company whose last activity was `days` days before NOW. */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

function view(key: string): CompanyView {
  const found = COMPANY_VIEWS.find((v) => v.key === key);
  if (!found) throw new Error(`view "${key}" is missing from COMPANY_VIEWS`);
  return found;
}

function matches(key: string, patch: Partial<Company>, ctx: CompanyViewContext = CTX): boolean {
  return view(key).predicate(company(patch), ctx);
}

describe('COMPANY_VIEWS shape', () => {
  it('exposes exactly the thirteen planned view keys, in order, with "all" first', () => {
    expect(COMPANY_VIEWS.map((v) => v.key)).toEqual([
      'all', 'mine', 'recent7', 'quiet10', 'ndaPending', 'ndaSigned', 'samplesSent',
      'customers', 'distributors', 'europe', 'middleEast', 'anz',
    ]);
  });

  it('gives every view a distinct labelKey namespaced under CompanyViews', () => {
    const labelKeys = COMPANY_VIEWS.map((v) => v.labelKey);
    expect(new Set(labelKeys).size).toBe(COMPANY_VIEWS.length);
    for (const v of COMPANY_VIEWS) expect(v.labelKey).toBe(v.key);
  });
});

describe('all', () => {
  it('matches every company', () => {
    expect(matches('all', {})).toBe(true);
    expect(matches('all', { relationshipStage: 'lost', countryCode: 'ZZ' })).toBe(true);
  });
});

describe('mine', () => {
  it('matches when the account owner is the signed-in account', () => {
    expect(matches('mine', { accountOwnerId: 'u-owner' })).toBe(true);
  });

  it('does not match another owner', () => {
    expect(matches('mine', { accountOwnerId: 'u-other' })).toBe(false);
  });

  it('matches nothing when there is no signed-in account', () => {
    expect(matches('mine', { accountOwnerId: 'u-owner' }, { accountId: null, now: NOW })).toBe(false);
  });

  it('does not treat an empty owner id as a match for a null account', () => {
    expect(matches('mine', { accountOwnerId: '' }, { accountId: null, now: NOW })).toBe(false);
  });
});

describe('recent7', () => {
  it('matches activity from today', () => {
    expect(matches('recent7', { lastActivityAt: daysAgo(0) })).toBe(true);
  });

  it('matches at exactly 7 days (inclusive upper edge)', () => {
    expect(matches('recent7', { lastActivityAt: daysAgo(7) })).toBe(true);
  });

  it('does not match just past 7 days', () => {
    expect(matches('recent7', { lastActivityAt: daysAgo(7.001) })).toBe(false);
  });

  it('does not match 8 days', () => {
    expect(matches('recent7', { lastActivityAt: daysAgo(8) })).toBe(false);
  });

  it('does not match a company that has no recorded activity', () => {
    expect(matches('recent7', { lastActivityAt: undefined })).toBe(false);
  });
});

describe('quiet10', () => {
  it('mirrors the follow-up threshold', () => {
    expect(FOLLOW_UP_AFTER_DAYS).toBe(10);
  });

  it('does not match just under 10 days', () => {
    expect(matches('quiet10', { lastActivityAt: daysAgo(9.999) })).toBe(false);
  });

  it('matches at exactly 10 days (inclusive lower edge)', () => {
    expect(matches('quiet10', { lastActivityAt: daysAgo(FOLLOW_UP_AFTER_DAYS) })).toBe(true);
  });

  it('matches well past the threshold', () => {
    expect(matches('quiet10', { lastActivityAt: daysAgo(60) })).toBe(true);
  });

  it('excludes lost companies however quiet they are', () => {
    expect(matches('quiet10', { lastActivityAt: daysAgo(60), relationshipStage: 'lost' })).toBe(false);
  });

  it('excludes dormant companies however quiet they are', () => {
    expect(matches('quiet10', { lastActivityAt: daysAgo(60), relationshipStage: 'dormant' })).toBe(false);
  });

  it('falls back to createdAt when no activity was ever recorded', () => {
    expect(matches('quiet10', { lastActivityAt: undefined, createdAt: daysAgo(30) })).toBe(true);
    expect(matches('quiet10', { lastActivityAt: undefined, createdAt: daysAgo(2) })).toBe(false);
  });
});

describe('ndaPending', () => {
  const pending = [
    'to_prepare', 'sent', 'under_review', 'awaiting_counterparty_signature',
    'awaiting_italprotein_signature', 'partially_signed', 'changes_requested',
  ] as const;

  for (const status of pending) {
    it(`matches ndaStatus "${status}"`, () => {
      expect(matches('ndaPending', { ndaStatus: status })).toBe(true);
    });
  }

  for (const status of ['not_required', 'fully_signed', 'approved', 'expired', 'terminated'] as const) {
    it(`does not match ndaStatus "${status}"`, () => {
      expect(matches('ndaPending', { ndaStatus: status })).toBe(false);
    });
  }
});

describe('ndaSigned', () => {
  it('matches approved and fully_signed', () => {
    expect(matches('ndaSigned', { ndaStatus: 'approved' })).toBe(true);
    expect(matches('ndaSigned', { ndaStatus: 'fully_signed' })).toBe(true);
  });

  it('does not match an NDA still in flight or absent', () => {
    expect(matches('ndaSigned', { ndaStatus: 'sent' })).toBe(false);
    expect(matches('ndaSigned', { ndaStatus: 'not_required' })).toBe(false);
  });
});

describe('samplesSent', () => {
  for (const status of ['shipped', 'in_transit', 'delivered', 'testing', 'feedback_requested'] as const) {
    it(`matches latestSampleStatus "${status}"`, () => {
      expect(matches('samplesSent', { latestSampleStatus: status })).toBe(true);
    });
  }

  it('does not match a request that never left the building', () => {
    expect(matches('samplesSent', { latestSampleStatus: 'draft' })).toBe(false);
    expect(matches('samplesSent', { latestSampleStatus: 'preparing' })).toBe(false);
  });

  it('does not match a company with no sample at all', () => {
    expect(matches('samplesSent', { latestSampleStatus: undefined })).toBe(false);
  });
});

describe('customers', () => {
  it('matches the customer stage', () => {
    expect(matches('customers', { relationshipStage: 'customer' })).toBe(true);
  });

  it('does not match a lead or a lost account', () => {
    expect(matches('customers', { relationshipStage: 'lead' })).toBe(false);
    expect(matches('customers', { relationshipStage: 'lost' })).toBe(false);
  });
});

describe('distributors', () => {
  it('matches the distributor company type', () => {
    expect(matches('distributors', { type: 'distributor' })).toBe(true);
  });

  it('does not match another company type', () => {
    expect(matches('distributors', { type: 'retailer' })).toBe(false);
  });
});

describe('region views', () => {
  it('europe matches an EU/EEA/UK country code and rejects others', () => {
    for (const code of ['IT', 'DE', 'CH', 'GB', 'FR', 'ES', 'NL', 'BE', 'AT', 'DK', 'FI', 'SE', 'AL', 'PT', 'IE', 'PL', 'CZ', 'GR', 'NO']) {
      expect(matches('europe', { countryCode: code })).toBe(true);
    }
    expect(matches('europe', { countryCode: 'US' })).toBe(false);
    expect(matches('europe', { countryCode: 'AU' })).toBe(false);
  });

  it('middleEast matches its country codes and rejects others', () => {
    for (const code of ['SA', 'AE', 'TR', 'QA', 'KW', 'BH', 'OM', 'JO', 'EG', 'IL']) {
      expect(matches('middleEast', { countryCode: code })).toBe(true);
    }
    expect(matches('middleEast', { countryCode: 'IT' })).toBe(false);
  });

  it('anz matches AU and NZ only', () => {
    expect(matches('anz', { countryCode: 'AU' })).toBe(true);
    expect(matches('anz', { countryCode: 'NZ' })).toBe(true);
    expect(matches('anz', { countryCode: 'ZA' })).toBe(false);
  });

  it('is case-insensitive about the stored country code', () => {
    expect(matches('europe', { countryCode: 'it' })).toBe(true);
    expect(matches('anz', { countryCode: 'nz' })).toBe(true);
  });

  it('the three regions do not overlap', () => {
    const regions = ['europe', 'middleEast', 'anz'];
    for (const code of ['IT', 'SA', 'AU', 'US']) {
      const hits = regions.filter((key) => matches(key, { countryCode: code }));
      expect(hits.length).toBeLessThanOrEqual(1);
    }
  });
});
