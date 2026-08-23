import { describe, it, expect, afterEach } from 'vitest';

import {
  applyDoNotContactUpsert,
  doNotContactReasonLabel,
  isDoNotContactReason,
  toDoNotContactReason,
} from '@/lib/do-not-contact';
import { DO_NOT_CONTACT_REASONS, type DoNotContactEntry } from '@/lib/types';
import { setLabelLocale } from '@/lib/labels';

/*
 * Pure logic behind the Do Not Contact list.
 *
 * Two rules matter enough to pin here. First, a reason arriving from a form, a
 * URL or an import must be validated before it reaches a Prisma enum column —
 * an unknown string is a 500, not a blank field. Second, a company is on this
 * list exactly once: adding a company that is already listed must UPDATE the
 * existing entry, never append a second one. A duplicate would split the reason
 * across two rows and let a "remove" leave the company still listed (or, worse,
 * let the header badge disagree with the list).
 *
 * Both run with no database — the mock service and the Prisma-backed service
 * share this module, so the rules cannot drift between data modes.
 */

afterEach(() => setLabelLocale('en'));

const entry = (over: Partial<DoNotContactEntry> = {}): DoNotContactEntry => ({
  id: 'dnc_1',
  companyId: 'c_venchi',
  reason: 'opt_out',
  notes: 'Asked to be removed at Fi Europe.',
  addedById: 'u_simone',
  createdAt: '2026-05-01T09:00:00.000Z',
  updatedAt: '2026-05-01T09:00:00.000Z',
  ...over,
});

const ctx = { id: 'dnc_new', addedById: 'u_marco', now: '2026-08-23T10:00:00.000Z' };

describe('reason validation', () => {
  it('accepts every declared reason', () => {
    for (const reason of DO_NOT_CONTACT_REASONS) {
      expect(isDoNotContactReason(reason), reason).toBe(true);
    }
  });

  it('rejects anything that is not a declared reason', () => {
    for (const value of ['', 'OPT_OUT', 'optOut', 'unsubscribed', null, undefined, 7, {}]) {
      expect(isDoNotContactReason(value), String(value)).toBe(false);
    }
  });

  it('coerces an unknown value to "other" rather than throwing', () => {
    expect(toDoNotContactReason('unsubscribed')).toBe('other');
    expect(toDoNotContactReason(null)).toBe('other');
    expect(toDoNotContactReason('gdpr_request')).toBe('gdpr_request');
  });

  /*
   * The six companies the real CRM already holds at relationshipStage 'lost'
   * (Chokay, SmartSweets, Ritter Sport, Wander AG, Conad FO, Rausch) are the
   * first rows this register will ever get, and four of them are plain "not
   * interested" refusals — not an opt-out, not a GDPR erasure, not a bounce.
   * Without this value those four would land on `other` and the list would lose
   * the single most common reason a company is on it. Pinned by name because
   * the enum shipped once without it.
   */
  it('recognises not_interested — the most common reason in the real data', () => {
    expect(DO_NOT_CONTACT_REASONS).toContain('not_interested');
    expect(isDoNotContactReason('not_interested')).toBe(true);
    expect(toDoNotContactReason('not_interested')).toBe('not_interested');
  });

  it('labels not_interested in both locales', () => {
    expect(doNotContactReasonLabel('not_interested')).toBe('Not interested');
    setLabelLocale('it');
    expect(doNotContactReasonLabel('not_interested')).toBe('Non interessato');
  });
});

describe('reason labels', () => {
  it('gives every reason a human label, never the raw code', () => {
    for (const reason of DO_NOT_CONTACT_REASONS) {
      const label = doNotContactReasonLabel(reason);
      expect(label.length, reason).toBeGreaterThan(0);
      expect(label, reason).not.toContain('_');
    }
  });

  it('follows the active label locale', () => {
    setLabelLocale('it');
    expect(doNotContactReasonLabel('gdpr_request')).toBe('Richiesta GDPR');
    setLabelLocale('en');
    expect(doNotContactReasonLabel('gdpr_request')).toBe('GDPR request');
  });
});

describe('adding a company that is already listed', () => {
  it('creates a new entry when the company is not on the list', () => {
    const result = applyDoNotContactUpsert([], { companyId: 'c_barilla', reason: 'competitor' }, ctx);

    expect(result.created).toBe(true);
    expect(result.entries).toHaveLength(1);
    expect(result.entry).toMatchObject({
      id: 'dnc_new',
      companyId: 'c_barilla',
      reason: 'competitor',
      addedById: 'u_marco',
      createdAt: ctx.now,
      updatedAt: ctx.now,
    });
  });

  it('updates the existing entry instead of appending a duplicate', () => {
    const existing = entry();
    const result = applyDoNotContactUpsert(
      [existing],
      { companyId: 'c_venchi', reason: 'gdpr_request', notes: 'Formal erasure request.' },
      ctx,
    );

    expect(result.created).toBe(false);
    expect(result.entries).toHaveLength(1);
    expect(result.entries.filter((e) => e.companyId === 'c_venchi')).toHaveLength(1);
    expect(result.entry.reason).toBe('gdpr_request');
    expect(result.entry.notes).toBe('Formal erasure request.');
  });

  it('keeps the identity of the existing entry — same id, first-listed date and author', () => {
    const existing = entry();
    const { entry: updated } = applyDoNotContactUpsert(
      [existing],
      { companyId: 'c_venchi', reason: 'complaint' },
      ctx,
    );

    expect(updated.id).toBe('dnc_1');
    expect(updated.createdAt).toBe('2026-05-01T09:00:00.000Z');
    expect(updated.addedById).toBe('u_simone');
    expect(updated.updatedAt).toBe(ctx.now);
  });

  it('leaves other companies untouched', () => {
    const others = [entry({ id: 'dnc_2', companyId: 'c_barilla', reason: 'competitor' })];
    const result = applyDoNotContactUpsert([...others, entry()], { companyId: 'c_venchi', reason: 'bounced' }, ctx);

    expect(result.entries).toHaveLength(2);
    expect(result.entries.find((e) => e.companyId === 'c_barilla')).toEqual(others[0]);
  });

  it('normalises notes: blank or whitespace-only clears the field', () => {
    const created = applyDoNotContactUpsert([], { companyId: 'c_barilla', reason: 'other', notes: '   ' }, ctx);
    expect(created.entry.notes).toBeUndefined();

    const cleared = applyDoNotContactUpsert([entry()], { companyId: 'c_venchi', reason: 'other', notes: '' }, ctx);
    expect(cleared.entry.notes).toBeUndefined();

    const trimmed = applyDoNotContactUpsert([], { companyId: 'c_barilla', reason: 'other', notes: '  spoke to CEO  ' }, ctx);
    expect(trimmed.entry.notes).toBe('spoke to CEO');
  });

  it('coerces an unknown incoming reason instead of writing it through', () => {
    const result = applyDoNotContactUpsert(
      [],
      { companyId: 'c_barilla', reason: 'unsubscribed' as never },
      ctx,
    );
    expect(result.entry.reason).toBe('other');
  });
});
