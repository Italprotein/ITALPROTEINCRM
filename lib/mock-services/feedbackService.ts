import type { Feedback, FeedbackStatus, FeedbackResult } from '@/lib/types';
import { FEEDBACK } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Feedback>('feedback', FEEDBACK);

export const feedbackService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (f: Feedback) => repo.create(f),
  update: (id: string, patch: Partial<Feedback>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<Feedback[]> {
    return (await repo.list()).filter((f) => f.companyId === companyId);
  },
  async bySample(sampleRequestId: string): Promise<Feedback[]> {
    return (await repo.list()).filter((f) => f.sampleRequestId === sampleRequestId);
  },
  async getStatistics() {
    const all = await repo.list();
    const byStatus = {} as Record<FeedbackStatus, number>;
    const byResult = {} as Record<FeedbackResult, number>;
    for (const f of all) {
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
      if (f.overallResult) byResult[f.overallResult] = (byResult[f.overallResult] ?? 0) + 1;
    }
    const rated = all.filter((f) => typeof f.overallRating === 'number');
    const avgRating = rated.length
      ? Math.round((rated.reduce((s, f) => s + (f.overallRating ?? 0), 0) / rated.length) * 10) / 10
      : 0;
    return {
      total: all.length,
      byStatus,
      byResult,
      avgRating,
      open: all.filter((f) => f.status !== 'resolved').length,
      positive: all.filter((f) => f.overallResult === 'positive').length,
    };
  },
};

export type FeedbackService = typeof feedbackService;
