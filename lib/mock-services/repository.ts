import { readStore, writeStore } from './storage';

/**
 * Generic in-memory repository over a seeded fixture array, with a localStorage
 * overlay (creates / updates / deletes) so demo edits persist across reloads.
 *
 * Every mock service is a thin wrapper around one of these. The real backend
 * replaces the wrapper with HTTP/server-action calls while keeping the same
 * async method signatures — so the UI never changes. See docs/BACKEND_HANDOFF.md.
 */
export interface Identified {
  id: string;
}

interface Overlay<T> {
  creates: T[];
  updates: Record<string, Partial<T>>;
  deletes: string[];
}

const emptyOverlay = <T,>(): Overlay<T> => ({ creates: [], updates: {}, deletes: [] });

export interface Repository<T extends Identified> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  create(item: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T | undefined>;
  remove(id: string): Promise<void>;
  /** Reset the localStorage overlay back to the seeded fixture. */
  reset(): void;
}

export function createRepository<T extends Identified>(
  storeKey: string,
  seed: T[],
): Repository<T> {
  const overlayKey = `repo:${storeKey}`;

  function readOverlay(): Overlay<T> {
    return readStore<Overlay<T>>(overlayKey, emptyOverlay<T>());
  }

  function materialize(): T[] {
    const overlay = readOverlay();
    const deleted = new Set(overlay.deletes);
    const merged = seed
      .filter((s) => !deleted.has(s.id))
      .map((s) => (overlay.updates[s.id] ? { ...s, ...overlay.updates[s.id] } : s));
    const created = overlay.creates.filter((c) => !deleted.has(c.id));
    return [...created, ...merged];
  }

  return {
    async list() {
      return materialize();
    },
    async get(id) {
      return materialize().find((x) => x.id === id);
    },
    async create(item) {
      const overlay = readOverlay();
      overlay.creates = [item, ...overlay.creates.filter((c) => c.id !== item.id)];
      writeStore(overlayKey, overlay);
      return item;
    },
    async update(id, patch) {
      const overlay = readOverlay();
      const isCreated = overlay.creates.some((c) => c.id === id);
      if (isCreated) {
        overlay.creates = overlay.creates.map((c) => (c.id === id ? { ...c, ...patch } : c));
      } else {
        overlay.updates[id] = { ...overlay.updates[id], ...patch };
      }
      writeStore(overlayKey, overlay);
      return materialize().find((x) => x.id === id);
    },
    async remove(id) {
      const overlay = readOverlay();
      overlay.deletes = Array.from(new Set([...overlay.deletes, id]));
      overlay.creates = overlay.creates.filter((c) => c.id !== id);
      writeStore(overlayKey, overlay);
    },
    reset() {
      writeStore(overlayKey, emptyOverlay<T>());
    },
  };
}
