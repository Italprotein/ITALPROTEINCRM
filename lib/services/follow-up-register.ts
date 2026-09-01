import type { FollowUp } from "@/lib/types";
import type { FollowUpRegisterService } from "@/lib/mock-services/followUpRegisterService";
import {
  createFollowUp,
  followUpCompanyOptions,
  followUpStats,
  getFollowUp,
  listFollowUps,
  removeFollowUp,
  setFollowUpStatus,
  syncFollowUps,
  updateFollowUp,
} from "./follow-up-register.actions";

// Real (Prisma-backed) followUpRegisterService — contract-identical to the mock.
export const followUpRegisterService: FollowUpRegisterService = {
  list: (): Promise<FollowUp[]> => listFollowUps(),
  get: (id) => getFollowUp(id),
  getStatistics: () => followUpStats(),
  companyOptions: () => followUpCompanyOptions(),
  create: (input) => createFollowUp(input),
  update: (id, input) => updateFollowUp(id, input),
  setStatus: (id, status, followUpOn) => setFollowUpStatus(id, status, followUpOn),
  remove: (id) => removeFollowUp(id),
  sync: () => syncFollowUps(),
};
