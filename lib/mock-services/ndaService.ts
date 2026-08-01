import type { NDA } from '@/lib/types';
import { NDAS } from '@/fixtures';
import { currentNdasOf, ndaStatusTallies } from '@/lib/nda-stats';
import { createRepository } from './repository';

const repo = createRepository<NDA>('ndas', NDAS);

const NOW = new Date('2026-06-17T12:00:00Z');

export const ndaService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (n: NDA) => repo.create(n),
  update: (id: string, patch: Partial<NDA>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<NDA[]> {
    return (await repo.list()).filter((n) => n.companyId === companyId);
  },
  async getStatistics() {
    // One current row per company, then the shared tallies — same contract as
    // the Prisma path in lib/services/nda.actions.ts.
    const current = currentNdasOf(await repo.list());
    const tallies = ndaStatusTallies(current.map((n) => n.status));
    const expiringSoon = current.filter((n) => {
      if (!n.expiryDate || n.status !== 'fully_signed') return false;
      const days = (new Date(n.expiryDate).getTime() - NOW.getTime()) / 86400000;
      return days >= 0 && days <= 60;
    }).length;
    return { ...tallies, expiringSoon };
  },
};

export type NdaService = typeof ndaService;
