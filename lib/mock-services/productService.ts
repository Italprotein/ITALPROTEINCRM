import type { Product } from '@/lib/types';
import { PRODUCTS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Product>('products', PRODUCTS);

export const productService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (p: Product) => repo.create(p),
  update: (id: string, patch: Partial<Product>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async byCompany(companyId: string): Promise<Product[]> {
    return (await repo.list()).filter((p) => p.companyId === companyId);
  },
  async getStatistics() {
    const all = await repo.list();
    return {
      total: all.length,
      launched: all.filter((p) => p.status === 'launched').length,
      inDevelopment: all.filter((p) => p.status === 'in_development').length,
    };
  },
};

export type ProductService = typeof productService;
