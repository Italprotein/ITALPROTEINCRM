import type { FinanceDocument, FinanceDocKind, PaymentStatus } from '@/lib/types';
import { FINANCE_DOCS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<FinanceDocument>('finance', FINANCE_DOCS);

export const financeService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (d: FinanceDocument) => repo.create(d),
  update: (id: string, patch: Partial<FinanceDocument>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<FinanceDocument[]> {
    return (await repo.list()).filter((d) => d.companyId === companyId);
  },
  async byKind(kind: FinanceDocKind): Promise<FinanceDocument[]> {
    return (await repo.list()).filter((d) => d.kind === kind);
  },
  async getStatistics() {
    const all = await repo.list();
    const invoices = all.filter((d) => d.kind === 'invoice');
    const byStatus = {} as Record<PaymentStatus, number>;
    for (const d of all) byStatus[d.paymentStatus] = (byStatus[d.paymentStatus] ?? 0) + 1;
    return {
      total: all.length,
      quotes: all.filter((d) => d.kind === 'quote').length,
      orders: all.filter((d) => d.kind === 'order').length,
      invoices: invoices.length,
      revenue: invoices.filter((d) => d.paymentStatus === 'paid').reduce((s, d) => s + d.total, 0),
      outstanding: invoices.reduce((s, d) => s + (d.outstandingAmount ?? 0), 0),
      overdue: invoices.filter((d) => d.paymentStatus === 'overdue').reduce((s, d) => s + (d.overdueAmount ?? d.outstandingAmount ?? d.total), 0),
      byStatus,
    };
  },
};

export type FinanceService = typeof financeService;
