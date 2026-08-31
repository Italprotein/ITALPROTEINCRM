import type { Investor } from "@/lib/types";
import type { InvestorService } from "@/lib/mock-services/investorService";
import {
  createInvestor,
  getInvestor,
  investorStats,
  listInvestors,
  removeInvestor,
  updateInvestor,
} from "./investor.actions";

// Real (Prisma-backed) investorService — contract-identical to the mock.
export const investorService: InvestorService = {
  list: (): Promise<Investor[]> => listInvestors(),
  get: (id) => getInvestor(id),
  getStatistics: () => investorStats(),
  create: (input) => createInvestor(input),
  update: (id, input) => updateInvestor(id, input),
  remove: (id) => removeInvestor(id),
};
