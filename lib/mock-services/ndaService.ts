import type { NDA, NDAStatus } from '@/lib/types';
import { NDAS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<NDA>('ndas', NDAS);

const NOW = new Date('2026-06-17T12:00:00Z');
const AWAITING: NDAStatus[] = [
  'sent', 'under_review', 'changes_requested', 'approved',
  'awaiting_italprotein_signature', 'awaiting_counterparty_signature', 'partially_signed',
];

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
    const all = await repo.list();
    const byStatus = {} as Record<NDAStatus, number>;
    for (const n of all) byStatus[n.status] = (byStatus[n.status] ?? 0) + 1;
    const expiringSoon = all.filter((n) => {
      if (!n.expiryDate || n.status !== 'fully_signed') return false;
      const days = (new Date(n.expiryDate).getTime() - NOW.getTime()) / 86400000;
      return days >= 0 && days <= 60;
    }).length;
    return {
      total: all.length,
      byStatus,
      awaitingSignature: all.filter((n) => AWAITING.includes(n.status)).length,
      signed: all.filter((n) => n.status === 'fully_signed').length,
      toPrepare: all.filter((n) => n.status === 'to_prepare' || n.status === 'draft').length,
      expiringSoon,
    };
  },
};

export type NdaService = typeof ndaService;
