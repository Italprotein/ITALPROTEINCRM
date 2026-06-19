import type { Meeting } from '@/lib/types';
import { MEETINGS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Meeting>('meetings', MEETINGS);

const NOW = new Date('2026-06-17T12:00:00Z');

export const meetingService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (m: Meeting) => repo.create(m),
  update: (id: string, patch: Partial<Meeting>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<Meeting[]> {
    return (await repo.list()).filter((m) => m.companyId === companyId);
  },
  async upcoming(now: Date = NOW): Promise<Meeting[]> {
    return (await repo.list())
      .filter((m) => m.status === 'scheduled' && new Date(m.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  },
  async getStatistics() {
    const all = await repo.list();
    return {
      total: all.length,
      scheduled: all.filter((m) => m.status === 'scheduled').length,
      completed: all.filter((m) => m.status === 'completed').length,
    };
  },
};

export type MeetingService = typeof meetingService;
