import type { DoNotContactEntry } from '@/lib/types';
import { DO_NOT_CONTACT_ENTRIES } from '@/fixtures';
import {
  applyDoNotContactUpsert,
  findByCompany,
  isListed,
  normalizeNotes,
  toDoNotContactReason,
  type DoNotContactInput,
  type DoNotContactPatch,
  type DoNotContactSaveResult,
} from '@/lib/do-not-contact';
import { uid } from '@/lib/utils';
import { createRepository } from './repository';
import { authService } from './authService';

const repo = createRepository<DoNotContactEntry>('doNotContact', DO_NOT_CONTACT_ENTRIES);

export const doNotContactService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<DoNotContactEntry | undefined> {
    return findByCompany(await repo.list(), companyId);
  },

  /** Cheap "may we contact them?" check for any send path. */
  async isCompanyListed(companyId: string): Promise<boolean> {
    return isListed(await repo.list(), companyId);
  },

  /**
   * Add a company, or update its entry if it is already listed — the same
   * upsert the unique `companyId` column gives us in api mode.
   */
  async add(input: DoNotContactInput): Promise<DoNotContactSaveResult> {
    const entries = await repo.list();
    const { entry, created } = applyDoNotContactUpsert(entries, input, {
      id: uid('dnc'),
      addedById: authService.getCurrentAccount()?.id,
      now: new Date().toISOString(),
    });
    if (created) await repo.create(entry);
    else await repo.update(entry.id, { reason: entry.reason, notes: entry.notes, updatedAt: entry.updatedAt });
    return { entry, created };
  },

  async update(id: string, patch: DoNotContactPatch): Promise<DoNotContactEntry | undefined> {
    const existing = await repo.get(id);
    if (!existing) return undefined;
    return repo.update(id, {
      reason: patch.reason ? toDoNotContactReason(patch.reason) : existing.reason,
      notes: 'notes' in patch ? normalizeNotes(patch.notes) : existing.notes,
      updatedAt: new Date().toISOString(),
    });
  },
};

export type DoNotContactService = typeof doNotContactService;
