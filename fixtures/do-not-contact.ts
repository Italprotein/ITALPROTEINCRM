import type { DoNotContactEntry } from '@/lib/types';

/**
 * Mock do-not-contact register. `companyId` references fixtures/companies.ts and
 * `addedById` references fixtures/staff.ts. One entry per company — the same
 * uniqueness the database enforces, so demo mode behaves like production.
 *
 * The spread of reasons mirrors what the real register looks like: a plain
 * "not interested" refusal is the commonest entry by some way, a GDPR erasure
 * is the strictest, and at least one row is on the list with `other` and no
 * note at all — which the table has to render as gracefully as the rest.
 */
export const DO_NOT_CONTACT_ENTRIES: DoNotContactEntry[] = [
  {
    id: 'dnc_barilla',
    companyId: 'c_barilla',
    reason: 'not_interested',
    notes: 'Told us at Fi Europe they source sugar reduction in-house. Revisit only if they reach out.',
    addedById: 'u_simone',
    createdAt: '2026-06-11T09:20:00.000Z',
    updatedAt: '2026-06-11T09:20:00.000Z',
  },
  {
    id: 'dnc_sudzucker',
    companyId: 'c_sudzucker',
    reason: 'competitor',
    notes: 'Runs its own sugar-reduction programme. Commercial contact only through the joint project team.',
    addedById: 'u_giuseppe',
    createdAt: '2026-05-04T14:05:00.000Z',
    updatedAt: '2026-07-02T10:30:00.000Z',
  },
  {
    id: 'dnc_naturasi',
    companyId: 'c_naturasi',
    reason: 'gdpr_request',
    notes: 'Written erasure request from their DPO on 2026-07-18. Marketing contacts deleted.',
    addedById: 'u_marco',
    createdAt: '2026-07-18T08:00:00.000Z',
    updatedAt: '2026-07-18T08:00:00.000Z',
  },
  {
    id: 'dnc_gimoka',
    companyId: 'c_gimoka',
    reason: 'other',
    addedById: 'u_elena',
    createdAt: '2026-08-01T16:45:00.000Z',
    updatedAt: '2026-08-01T16:45:00.000Z',
  },
];

export function getDoNotContactEntries(): DoNotContactEntry[] {
  return DO_NOT_CONTACT_ENTRIES;
}
