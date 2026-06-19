import type { Contact } from '@/lib/types';
import { CONTACTS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Contact>('contacts', CONTACTS);

export const contactService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (c: Contact) => repo.create(c),
  update: (id: string, patch: Partial<Contact>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<Contact[]> {
    return (await repo.list()).filter((c) => c.companyId === companyId);
  },
  async search(q: string): Promise<Contact[]> {
    const s = q.trim().toLowerCase();
    if (!s) return repo.list();
    return (await repo.list()).filter((c) =>
      [c.firstName, c.lastName, c.email, c.jobTitle, c.department].filter(Boolean).join(' ').toLowerCase().includes(s),
    );
  },
  async getStatistics() {
    const all = await repo.list();
    return {
      total: all.length,
      primary: all.filter((c) => c.isPrimary).length,
      technical: all.filter((c) => c.isTechnical).length,
      commercial: all.filter((c) => c.isCommercial).length,
    };
  },
};

export type ContactService = typeof contactService;
