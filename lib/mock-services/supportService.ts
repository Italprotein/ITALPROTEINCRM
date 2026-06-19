import type { SupportRequest, SupportStatus } from '@/lib/types';
import { SUPPORT_REQUESTS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<SupportRequest>('support', SUPPORT_REQUESTS);

export const supportService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (r: SupportRequest) => repo.create(r),
  update: (id: string, patch: Partial<SupportRequest>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<SupportRequest[]> {
    return (await repo.list()).filter((r) => r.companyId === companyId);
  },
  async getStatistics() {
    const all = await repo.list();
    const byStatus = {} as Record<SupportStatus, number>;
    for (const r of all) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    return {
      total: all.length,
      byStatus,
      open: all.filter((r) => r.status === 'open' || r.status === 'in_progress').length,
      waitingOnClient: all.filter((r) => r.status === 'waiting_on_client').length,
    };
  },
};

export type SupportService = typeof supportService;
