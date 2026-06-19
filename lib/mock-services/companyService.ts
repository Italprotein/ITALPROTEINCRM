import type { Company } from '@/lib/types';
import { COMPANIES, AGENCY_COMPANIES } from '@/fixtures';
import { createRepository } from './repository';

// Agencies/distributors are Company records too, so they appear in company lists.
const repo = createRepository<Company>('companies', [...COMPANIES, ...AGENCY_COMPANIES]);

export interface CompanyQuery {
  search?: string;
  types?: Company['type'][];
  countries?: string[];
  stages?: Company['relationshipStage'][];
  ownerId?: string;
  ndaStatuses?: Company['ndaStatus'][];
  priorities?: Company['priority'][];
  tag?: string;
}

function matches(c: Company, q: CompanyQuery): boolean {
  if (q.search) {
    const s = q.search.toLowerCase();
    const hay = [c.legalName, c.tradingName, c.city, c.country, ...(c.tags ?? [])]
      .filter(Boolean).join(' ').toLowerCase();
    if (!hay.includes(s)) return false;
  }
  if (q.types?.length && !q.types.includes(c.type)) return false;
  if (q.countries?.length && !q.countries.includes(c.country)) return false;
  if (q.stages?.length && !q.stages.includes(c.relationshipStage)) return false;
  if (q.ownerId && c.accountOwnerId !== q.ownerId) return false;
  if (q.ndaStatuses?.length && !q.ndaStatuses.includes(c.ndaStatus)) return false;
  if (q.priorities?.length && !q.priorities.includes(c.priority)) return false;
  if (q.tag && !(c.tags ?? []).includes(q.tag)) return false;
  return true;
}

const ACTIVE_EXCLUDE: Company['relationshipStage'][] = ['lost', 'dormant'];

export const companyService = {
  async list(query: CompanyQuery = {}): Promise<Company[]> {
    const all = await repo.list();
    return all.filter((c) => matches(c, query));
  },
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (c: Company) => repo.create(c),
  update: (id: string, patch: Partial<Company>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async count(): Promise<number> {
    return (await repo.list()).length;
  },
  async byCountry(): Promise<{ country: string; countryCode: string; count: number }[]> {
    const all = await repo.list();
    const map = new Map<string, { country: string; countryCode: string; count: number }>();
    for (const c of all) {
      const e = map.get(c.country) ?? { country: c.country, countryCode: c.countryCode, count: 0 };
      e.count++;
      map.set(c.country, e);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  },
  async byType(): Promise<{ type: Company['type']; count: number }[]> {
    const all = await repo.list();
    const map = new Map<Company['type'], number>();
    for (const c of all) map.set(c.type, (map.get(c.type) ?? 0) + 1);
    return [...map.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  },
  async getStatistics() {
    const all = await repo.list();
    const byStage = new Map<Company['relationshipStage'], number>();
    for (const c of all) byStage.set(c.relationshipStage, (byStage.get(c.relationshipStage) ?? 0) + 1);
    return {
      total: all.length,
      active: all.filter((c) => !ACTIVE_EXCLUDE.includes(c.relationshipStage)).length,
      customers: all.filter((c) => ['customer', 'repeat_customer'].includes(c.relationshipStage)).length,
      ndaSigned: all.filter((c) => c.ndaStatus === 'fully_signed').length,
      pipelineValue: all.reduce((s, c) => s + (c.opportunityValue ?? 0), 0),
      estimatedPotential: all.reduce((s, c) => s + (c.estimatedAnnualPotential ?? 0), 0),
      highPriority: all.filter((c) => c.priority === 'high' || c.priority === 'urgent').length,
      byStage: [...byStage.entries()].map(([stage, count]) => ({ stage, count })),
    };
  },
};

export type CompanyService = typeof companyService;
