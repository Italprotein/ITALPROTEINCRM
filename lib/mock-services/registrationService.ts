import type { Registration, RegistrationStatus } from '@/lib/types';
import { REGISTRATIONS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Registration>('registrations', REGISTRATIONS);

export const registrationService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (r: Registration) => repo.create(r),
  update: (id: string, patch: Partial<Registration>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byStatus(status: RegistrationStatus): Promise<Registration[]> {
    return (await repo.list()).filter((r) => r.status === status);
  },
  async getStatistics() {
    const all = await repo.list();
    const pending = all.filter((r) => ['submitted', 'email_verification', 'pending_approval'].includes(r.status)).length;
    return {
      total: all.length,
      pending,
      moreInfo: all.filter((r) => r.status === 'more_info_requested').length,
      approved: all.filter((r) => r.status === 'approved').length,
      rejected: all.filter((r) => r.status === 'rejected').length,
    };
  },
};

export type RegistrationService = typeof registrationService;
