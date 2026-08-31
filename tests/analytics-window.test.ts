import { describe, it, expect } from 'vitest';

import { monthKeyOf, monthsWindow, windowFor } from '@/lib/services/analytics.mapper';

const NOW = new Date('2026-08-31T10:00:00Z');

describe('monthsWindow', () => {
  it('ends at the current month and spans backwards', () => {
    expect(monthsWindow(3, NOW)).toEqual(['2026-06', '2026-07', '2026-08']);
  });
  it('crosses year boundaries', () => {
    expect(monthsWindow(12, NOW)[0]).toBe('2025-09');
    expect(monthsWindow(12, NOW)).toHaveLength(12);
  });
});

describe('windowFor', () => {
  it('uses a fixed window when months > 0, regardless of the data', () => {
    expect(windowFor(['2020-01-15T00:00:00Z'], 3, NOW)).toEqual(['2026-06', '2026-07', '2026-08']);
  });
  it('spans from the earliest date to now for all-time (months <= 0)', () => {
    const window = windowFor(['2026-02-10T00:00:00Z', '2026-05-01T00:00:00Z'], 0, NOW);
    expect(window[0]).toBe('2026-02');
    expect(window[window.length - 1]).toBe('2026-08');
    expect(window).toHaveLength(7);
  });
  it('caps a pathological all-time span instead of rendering hundreds of buckets', () => {
    const window = windowFor(['1970-01-01T00:00:00Z'], 0, NOW);
    expect(window.length).toBeLessThanOrEqual(60);
    expect(window[window.length - 1]).toBe('2026-08');
  });
  it('falls back to 12 months when there is no data at all', () => {
    expect(windowFor([], 0, NOW)).toHaveLength(12);
  });
});

describe('monthKeyOf', () => {
  it('zero-pads the month', () => {
    expect(monthKeyOf(new Date('2026-03-05T00:00:00Z'))).toBe('2026-03');
  });
});

/*
 * REGRESSION — the bug this module replaced: the old hardcoded demo window
 * ended at 2026-06, so anything created in July or August 2026 fell out of
 * every trend chart. The current month must always be the last bucket.
 */
describe('current month is always in the window', () => {
  it('for fixed ranges', () => {
    for (const n of [3, 6, 12]) {
      const window = monthsWindow(n, NOW);
      expect(window[window.length - 1]).toBe('2026-08');
    }
  });
});
