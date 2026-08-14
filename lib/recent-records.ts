/**
 * "Recently viewed" records for the global search palette — a small, pure
 * localStorage-backed ring buffer, independent of the mock/api data mode.
 *
 * Deliberately reads the bare `localStorage` global (not `window.localStorage`
 * — compare lib/mock-services/storage.ts) so it stays trivially unit-testable
 * under vitest's Node environment: a test only needs to stub `globalThis.localStorage`,
 * with no `window` shim required.
 */
const KEY = 'ui:recent-records';
const MAX = 8;

export interface RecentRecord {
  type: string;
  id: string;
  label: string;
  href: string;
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

/** Newest first, capped at 8. Malformed or missing stored JSON reads back as empty. */
export function readRecents(): RecentRecord[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentRecord[]) : [];
  } catch {
    return [];
  }
}

/** Pushes `entry` to the front. An existing entry with the same href is moved, not duplicated. */
export function pushRecent(entry: RecentRecord): void {
  const store = storage();
  if (!store) return;
  const deduped = readRecents().filter((r) => r.href !== entry.href);
  const next = [entry, ...deduped].slice(0, MAX);
  try {
    store.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota / serialization errors are non-fatal — the recents list is a convenience, not data of record */
  }
}
