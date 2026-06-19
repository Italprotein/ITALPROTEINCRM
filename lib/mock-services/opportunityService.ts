import type { Opportunity, PipelineStage } from '@/lib/types';
import { PIPELINE_STAGES } from '@/lib/types';
import { OPPORTUNITIES } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Opportunity>('opportunities', OPPORTUNITIES);

const OPEN_STAGES = new Set<PipelineStage>(PIPELINE_STAGES);
const WON: PipelineStage[] = ['customer', 'repeat_customer'];
const LOST: PipelineStage[] = ['lost', 'disqualified'];

export const opportunityService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (o: Opportunity) => repo.create(o),
  update: (id: string, patch: Partial<Opportunity>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<Opportunity[]> {
    return (await repo.list()).filter((o) => o.companyId === companyId);
  },
  async byStage(): Promise<Record<string, Opportunity[]>> {
    const all = await repo.list();
    const map: Record<string, Opportunity[]> = {};
    for (const stage of PIPELINE_STAGES) map[stage] = [];
    for (const o of all) (map[o.stage] ??= []).push(o);
    return map;
  },
  async getStatistics() {
    const all = await repo.list();
    const open = all.filter((o) => OPEN_STAGES.has(o.stage) && !WON.includes(o.stage));
    const won = all.filter((o) => WON.includes(o.stage));
    const lost = all.filter((o) => LOST.includes(o.stage));
    const totalValue = all.reduce((s, o) => s + (o.expectedValue ?? 0), 0);
    const weightedValue = all.reduce((s, o) => s + (o.expectedValue ?? 0) * ((o.probability ?? 0) / 100), 0);
    const byStage = PIPELINE_STAGES.map((stage) => {
      const items = all.filter((o) => o.stage === stage);
      return { stage, count: items.length, value: items.reduce((s, o) => s + (o.expectedValue ?? 0), 0) };
    });
    return { total: all.length, open: open.length, won: won.length, lost: lost.length, totalValue, weightedValue, byStage };
  },
};

export type OpportunityService = typeof opportunityService;
