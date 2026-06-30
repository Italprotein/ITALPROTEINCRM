import type { Agency, AgencyService } from "@/lib/mock-services/agencyService";
import { listAgencies, getAgency, agencyStatistics } from "./agency.actions";

// Real (Prisma-backed) agencyService — contract-identical to the mock service.
// Agencies are Company records (type agency|distributor, partner-network records)
// joined with derived partner-network metadata. Read-only, like the mock.
export const agencyService: AgencyService = {
  list: (): Promise<Agency[]> => listAgencies(),
  get: (id: string): Promise<Agency | undefined> => getAgency(id),
  getById: (id: string): Promise<Agency | undefined> => getAgency(id),
  getStatistics: () => agencyStatistics(),
};
