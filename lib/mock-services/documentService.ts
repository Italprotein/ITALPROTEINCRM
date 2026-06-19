import type { DocumentRecord, DocumentCategory, DocumentAccessLevel } from '@/lib/types';
import { DOCUMENTS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<DocumentRecord>('documents', DOCUMENTS);

const PORTAL_OPEN: DocumentAccessLevel[] = ['public', 'portal_general', 'pre_nda'];
const POST_NDA: DocumentAccessLevel[] = ['post_nda', 'company_specific'];

export const documentService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (d: DocumentRecord) => repo.create(d),
  update: (id: string, patch: Partial<DocumentRecord>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<DocumentRecord[]> {
    return (await repo.list()).filter((d) => d.companyId === companyId);
  },
  async byCategory(category: DocumentCategory): Promise<DocumentRecord[]> {
    return (await repo.list()).filter((d) => d.category === category);
  },
  /** Documents a portal company may see, gated by NDA signed state. */
  async forPortal(companyId: string, ndaSigned: boolean): Promise<DocumentRecord[]> {
    return (await repo.list()).filter((d) => {
      if (PORTAL_OPEN.includes(d.accessLevel)) return !d.companyId || d.companyId === companyId;
      if (POST_NDA.includes(d.accessLevel)) return ndaSigned && (!d.companyId || d.companyId === companyId);
      return false; // 'internal' never exposed
    });
  },
  async getStatistics() {
    const all = await repo.list();
    const byCategory = {} as Record<DocumentCategory, number>;
    for (const d of all) byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
    return {
      total: all.length,
      byCategory,
      internal: all.filter((d) => d.accessLevel === 'internal').length,
      shared: all.filter((d) => d.accessLevel !== 'internal').length,
      totalSizeKb: all.reduce((s, d) => s + (d.sizeKb ?? 0), 0),
    };
  },
};

export type DocumentService = typeof documentService;
