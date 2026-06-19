import type { SampleRequest, SampleStatus } from '@/lib/types';
import { SAMPLES } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<SampleRequest>('samples', SAMPLES);

export const sampleService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (s: SampleRequest) => repo.create(s),
  update: (id: string, patch: Partial<SampleRequest>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<SampleRequest[]> {
    return (await repo.list()).filter((s) => s.companyId === companyId);
  },
  async byStatus(status: SampleStatus): Promise<SampleRequest[]> {
    return (await repo.list()).filter((s) => s.status === status);
  },
  async getStatistics() {
    const all = await repo.list();
    const byStatus = {} as Record<SampleStatus, number>;
    for (const s of all) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    const inSet = (...st: SampleStatus[]) => all.filter((s) => st.includes(s.status)).length;
    return {
      total: all.length,
      byStatus,
      pendingApproval: inSet('submitted', 'under_review', 'more_info_required'),
      preparing: inSet('approved', 'preparing', 'ready_to_ship'),
      shipped: inSet('shipped', 'in_transit', 'customs_hold', 'delivery_attempted'),
      awaitingFeedback: inSet('delivered', 'receipt_confirmed', 'testing', 'feedback_requested'),
      feedbackReceived: inSet('feedback_received', 'closed'),
    };
  },
};

export type SampleService = typeof sampleService;
