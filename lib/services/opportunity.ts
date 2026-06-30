import type { Opportunity } from "@/lib/types";
import type { OpportunityService } from "@/lib/mock-services/opportunityService";
import {
  listOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  removeOpportunity,
  opportunitiesByCompany,
  opportunitiesByStage,
  opportunityStatistics,
} from "./opportunity.actions";

// Real (Prisma-backed) opportunityService — contract-identical to the mock
// service. The barrel swaps this in when NEXT_PUBLIC_DATA_MODE=api.
export const opportunityService: OpportunityService = {
  list: () => listOpportunities(),
  get: (id: string) => getOpportunity(id),
  getById: (id: string) => getOpportunity(id),
  create: (o: Opportunity) => createOpportunity(o),
  update: (id: string, patch: Partial<Opportunity>) => updateOpportunity(id, patch),
  remove: (id: string) => removeOpportunity(id),
  reset: () => {},
  byCompany: (companyId: string) => opportunitiesByCompany(companyId),
  byStage: () => opportunitiesByStage(),
  getStatistics: () => opportunityStatistics(),
};
