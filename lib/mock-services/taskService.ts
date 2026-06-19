import type { Task } from '@/lib/types';
import { TASKS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Task>('tasks', TASKS);

const NOW = new Date('2026-06-17T12:00:00Z');
const isActive = (t: Task) => t.status !== 'done' && t.status !== 'cancelled';
const sameDay = (a: Date, b: Date) => a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

export const taskService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (t: Task) => repo.create(t),
  update: (id: string, patch: Partial<Task>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byOwner(ownerId: string): Promise<Task[]> {
    return (await repo.list()).filter((t) => t.ownerId === ownerId);
  },
  async byCompany(companyId: string): Promise<Task[]> {
    return (await repo.list()).filter((t) => t.companyId === companyId);
  },
  async overdue(now: Date = NOW): Promise<Task[]> {
    return (await repo.list()).filter((t) => isActive(t) && !!t.dueDate && new Date(t.dueDate) < now && !sameDay(new Date(t.dueDate), now));
  },
  async dueToday(now: Date = NOW): Promise<Task[]> {
    return (await repo.list()).filter((t) => isActive(t) && !!t.dueDate && sameDay(new Date(t.dueDate), now));
  },
  async upcoming(now: Date = NOW): Promise<Task[]> {
    return (await repo.list()).filter((t) => isActive(t) && !!t.dueDate && new Date(t.dueDate) > now && !sameDay(new Date(t.dueDate), now));
  },
  async getStatistics(now: Date = NOW) {
    const all = await repo.list();
    const open = all.filter(isActive);
    const completed = all.filter((t) => t.status === 'done');
    const overdue = open.filter((t) => !!t.dueDate && new Date(t.dueDate) < now && !sameDay(new Date(t.dueDate), now));
    const dueToday = open.filter((t) => !!t.dueDate && sameDay(new Date(t.dueDate), now));
    const byAssignee = Object.entries(
      all.reduce<Record<string, number>>((acc, t) => { acc[t.ownerId] = (acc[t.ownerId] ?? 0) + (isActive(t) ? 1 : 0); return acc; }, {}),
    ).map(([ownerId, count]) => ({ ownerId, count }));
    return {
      total: all.length,
      open: open.length,
      completed: completed.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      completionRate: all.length ? Math.round((completed.length / all.length) * 100) : 0,
      byAssignee,
    };
  },
};

export type TaskService = typeof taskService;
