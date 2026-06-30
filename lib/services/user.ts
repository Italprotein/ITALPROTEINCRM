import type { InternalRole } from "@/lib/types";
import type { StaffMember } from "@/fixtures";
import type { UserService } from "@/lib/mock-services/userService";
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  removeUser,
  usersByRole,
  assignedCompanyCount,
  userStatistics,
} from "./user.actions";

// Real (Prisma-backed) userService — contract-identical to the mock service.
// The internal staff directory; not company-scoped (internal users only).
export const userService: UserService = {
  list: () => listUsers(),
  get: (id: string) => getUser(id),
  getById: (id: string) => getUser(id),
  create: (u: StaffMember) => createUser(u),
  update: (id: string, patch: Partial<StaffMember>) => updateUser(id, patch),
  remove: (id: string) => removeUser(id),
  reset: () => {},

  listInternal: () => listUsers(),
  byRole: (role: InternalRole) => usersByRole(role),
  assignedCompanies: (id: string) => assignedCompanyCount(id),
  getStatistics: () => userStatistics(),
};
