import type { InternalRole } from '@/lib/types';
import { STAFF, type StaffMember } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<StaffMember>('staff', STAFF);

export const userService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (u: StaffMember) => repo.create(u),
  update: (id: string, patch: Partial<StaffMember>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  listInternal: () => repo.list(),
  async byRole(role: InternalRole): Promise<StaffMember[]> {
    return (await repo.list()).filter((u) => u.role === role);
  },
  async assignedCompanies(id: string): Promise<number> {
    const u = await repo.get(id);
    return u?.assignedCompanyIds.length ?? 0;
  },
  async getStatistics() {
    const all = await repo.list();
    const byRole = {} as Record<InternalRole, number>;
    for (const u of all) byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    return {
      total: all.length,
      active: all.filter((u) => u.status === 'active').length,
      invited: all.filter((u) => u.status === 'invited').length,
      suspended: all.filter((u) => u.status === 'suspended').length,
      byRole,
    };
  },
};

export type UserService = typeof userService;
