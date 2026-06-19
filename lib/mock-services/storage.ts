/**
 * SSR-safe localStorage helpers. The prototype persists demo mutations here so
 * changes survive a reload; the real backend will ignore this layer entirely.
 */
const PREFIX = 'italprotein-crm:';

export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readStore<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    // Notify same-tab listeners (storage event only fires cross-tab).
    window.dispatchEvent(new CustomEvent('italprotein-store', { detail: { key } }));
  } catch {
    /* quota / serialization errors are non-fatal in the demo */
  }
}

export function clearStore(key?: string): void {
  if (!isBrowser()) return;
  if (key) {
    window.localStorage.removeItem(PREFIX + key);
    return;
  }
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
}
