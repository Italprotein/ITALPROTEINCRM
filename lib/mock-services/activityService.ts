import type { Activity, ActivityType } from '@/lib/types';
import { ACTIVITIES } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Activity>('activities', ACTIVITIES);

const byDateDesc = (a: Activity, b: Activity) => new Date(b.at).getTime() - new Date(a.at).getTime();

export const activityService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (a: Activity) => repo.create(a),
  update: (id: string, patch: Partial<Activity>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<Activity[]> {
    return (await repo.list()).filter((a) => a.companyId === companyId).sort(byDateDesc);
  },
  async recent(limit = 12): Promise<Activity[]> {
    return (await repo.list()).sort(byDateDesc).slice(0, limit);
  },
  async byType(type: ActivityType): Promise<Activity[]> {
    return (await repo.list()).filter((a) => a.type === type).sort(byDateDesc);
  },
  /** Client-visible activities for a portal company. */
  async forPortal(companyId: string): Promise<Activity[]> {
    return (await repo.list())
      .filter((a) => a.companyId === companyId && a.visibility === 'client')
      .sort(byDateDesc);
  },
  async getStatistics() {
    const all = await repo.list();
    const byType = {} as Record<ActivityType, number>;
    for (const a of all) byType[a.type] = (byType[a.type] ?? 0) + 1;
    return { total: all.length, byType };
  },
};

export type ActivityService = typeof activityService;
