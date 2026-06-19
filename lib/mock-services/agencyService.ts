import type { Company } from '@/lib/types';
import { AGENCY_COMPANIES, AGENCY_META } from '@/fixtures';

type AgencyMeta = (typeof AGENCY_META)[string];
export type Agency = Company & { meta: AgencyMeta };

function join(c: Company): Agency {
  return { ...c, meta: AGENCY_META[c.id] };
}

/** Agencies/distributors are Company records (also present in companyService) joined
 *  with partner-network metadata. Read-only in the demo. */
export const agencyService = {
  async list(): Promise<Agency[]> {
    return AGENCY_COMPANIES.filter((c) => AGENCY_META[c.id]).map(join);
  },
  async get(id: string): Promise<Agency | undefined> {
    const c = AGENCY_COMPANIES.find((a) => a.id === id);
    return c && AGENCY_META[c.id] ? join(c) : undefined;
  },
  getById(id: string) {
    return this.get(id);
  },
  async getStatistics() {
    const all = await this.list();
    const active = all.filter((a) => a.meta.agreementStatus === 'active').length;
    const totalCompaniesIntroduced = all.reduce((s, a) => s + a.meta.companiesIntroducedIds.length, 0);
    const totalLeads = all.reduce((s, a) => s + a.meta.activeLeads, 0);
    const avgConversionRate = all.length
      ? Math.round((all.reduce((s, a) => s + a.meta.conversionRate, 0) / all.length) * 100)
      : 0;
    return { total: all.length, active, totalCompaniesIntroduced, totalLeads, avgConversionRate };
  },
};

export type AgencyService = typeof agencyService;
