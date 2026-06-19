import type { ApplicationProject, DevelopmentStage } from '@/lib/types';
import { PROJECTS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<ApplicationProject>('projects', PROJECTS);

export const projectService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (p: ApplicationProject) => repo.create(p),
  update: (id: string, patch: Partial<ApplicationProject>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<ApplicationProject[]> {
    return (await repo.list()).filter((p) => p.companyId === companyId);
  },
  async getStatistics() {
    const all = await repo.list();
    const byStage = {} as Record<DevelopmentStage, number>;
    for (const p of all) byStage[p.developmentStage] = (byStage[p.developmentStage] ?? 0) + 1;
    return {
      total: all.length,
      byStage,
      active: all.filter((p) => !['launched', 'on_hold'].includes(p.developmentStage)).length,
      launched: all.filter((p) => p.developmentStage === 'launched').length,
    };
  },
};

export type ProjectService = typeof projectService;
