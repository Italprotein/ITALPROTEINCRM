import type { Registration, RegistrationStatus } from "@/lib/types";
import type { RegistrationService } from "@/lib/mock-services/registrationService";
import {
  listRegistrations,
  getRegistration,
  createRegistration,
  updateRegistration,
  removeRegistration,
  registrationsByStatus,
  registrationStatistics,
} from "./registration.actions";

// Real (Prisma-backed) registrationService — contract-identical to the mock
// service. The barrel swaps this in when NEXT_PUBLIC_DATA_MODE=api.
export const registrationService: RegistrationService = {
  list: () => listRegistrations(),
  get: (id: string) => getRegistration(id),
  getById: (id: string) => getRegistration(id),
  create: (r: Registration) => createRegistration(r),
  update: (id: string, patch: Partial<Registration>) => updateRegistration(id, patch),
  remove: (id: string) => removeRegistration(id),
  reset: () => {},
  byStatus: (status: RegistrationStatus) => registrationsByStatus(status),
  getStatistics: () => registrationStatistics(),
};
