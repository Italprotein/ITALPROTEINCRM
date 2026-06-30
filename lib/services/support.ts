import type { SupportRequest } from "@/lib/types";
import type { SupportService } from "@/lib/mock-services/supportService";
import {
  listSupportRequests,
  getSupportRequest,
  createSupportRequest,
  updateSupportRequest,
  removeSupportRequest,
  supportRequestsByCompany,
  supportStatistics,
} from "./support.actions";

// Real (Prisma-backed) supportService — contract-identical to the mock service.
export const supportService: SupportService = {
  list: () => listSupportRequests(),
  get: (id: string) => getSupportRequest(id),
  getById: (id: string) => getSupportRequest(id),
  create: (r: SupportRequest) => createSupportRequest(r),
  update: (id: string, patch: Partial<SupportRequest>) => updateSupportRequest(id, patch),
  remove: (id: string) => removeSupportRequest(id),
  reset: () => {},
  byCompany: (companyId: string) => supportRequestsByCompany(companyId),
  getStatistics: () => supportStatistics(),
};
