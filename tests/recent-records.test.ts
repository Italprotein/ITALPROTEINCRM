import { describe, it, expect, beforeEach } from 'vitest';

import { pushRecent, readRecents, type RecentRecord } from '@/lib/recent-records';

/*
 * vitest.config.ts runs this suite under environment: 'node' (see the comment
 * there — no database, no browser), so there is no real `localStorage`
 * global. lib/recent-records.ts reads the bare `localStorage` identifier
 * directly (not `window.localStorage`) precisely so a minimal shim like this
 * is enough to exercise it in Node, without needing jsdom.
 */
function createLocalStorageShim(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

beforeEach(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = createLocalStorageShim();
});

function entry(n: number): RecentRecord {
  return { type: 'company', id: String(n), label: `Company ${n}`, href: `/admin/companies/${n}` };
}

describe('recent-records', () => {
  it('starts empty when nothing has been stored', () => {
    expect(readRecents()).toEqual([]);
  });

  it('reads back a pushed entry', () => {
    pushRecent(entry(1));
    expect(readRecents()).toEqual([entry(1)]);
  });

  it('orders newest first', () => {
    pushRecent(entry(1));
    pushRecent(entry(2));
    pushRecent(entry(3));
    expect(readRecents().map((r) => r.id)).toEqual(['3', '2', '1']);
  });

  it('caps the list at 8 entries, dropping the oldest', () => {
    for (let i = 1; i <= 10; i++) pushRecent(entry(i));
    const recents = readRecents();
    expect(recents).toHaveLength(8);
    expect(recents.map((r) => r.id)).toEqual(['10', '9', '8', '7', '6', '5', '4', '3']);
  });

  it('moves a re-pushed href to the front instead of duplicating it', () => {
    pushRecent(entry(1));
    pushRecent(entry(2));
    pushRecent(entry(3));
    // Same href as entry(1), but a fresher label — visiting the same record
    // again should refresh its label and jump it back to the top, not add
    // a second row.
    pushRecent({ type: 'company', id: '1', label: 'Company 1 renamed', href: '/admin/companies/1' });
    const recents = readRecents();
    expect(recents).toHaveLength(3);
    expect(recents[0]).toEqual({ type: 'company', id: '1', label: 'Company 1 renamed', href: '/admin/companies/1' });
    expect(recents.map((r) => r.id)).toEqual(['1', '3', '2']);
  });

  it('treats malformed stored JSON as empty instead of throwing', () => {
    localStorage.setItem('ui:recent-records', '{not valid json');
    expect(() => readRecents()).not.toThrow();
    expect(readRecents()).toEqual([]);
  });

  it('recovers from malformed JSON on the next push', () => {
    localStorage.setItem('ui:recent-records', 'not even json-ish');
    pushRecent(entry(1));
    expect(readRecents()).toEqual([entry(1)]);
  });
});
