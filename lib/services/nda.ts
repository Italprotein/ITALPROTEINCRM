import type { NDA } from "@/lib/types";
import type { NdaService } from "@/lib/mock-services/ndaService";
import {
  listNdas,
  getNda,
  createNda,
  updateNda,
  removeNda,
  ndasByCompany,
  ndaStatistics,
} from "./nda.actions";

// Real (Prisma-backed) ndaService — contract-identical to the mock service.
export const ndaService: NdaService = {
  list: () => listNdas(),
  get: (id: string) => getNda(id),
  getById: (id: string) => getNda(id),
  create: (n: NDA) => createNda(n),
  update: (id: string, patch: Partial<NDA>) => updateNda(id, patch),
  remove: (id: string) => removeNda(id),
  reset: () => {},
  byCompany: (companyId: string) => ndasByCompany(companyId),
  getStatistics: () => ndaStatistics(),
};
