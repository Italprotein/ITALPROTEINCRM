import type { Product } from "@/lib/types";
import type { ProductService } from "@/lib/mock-services/productService";
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  removeProduct,
  productsByCompany,
  productStatistics,
} from "./product.actions";

// Real (Prisma-backed) productService — contract-identical to the mock service.
// The catalogue is not company-scoped: all users read every product.
export const productService: ProductService = {
  list: () => listProducts(),
  get: (id: string) => getProduct(id),
  getById: (id: string) => getProduct(id),
  create: (p: Product) => createProduct(p),
  update: (id: string, patch: Partial<Product>) => updateProduct(id, patch),
  remove: (id: string) => removeProduct(id),
  reset: () => {},
  byCompany: (companyId: string) => productsByCompany(companyId),
  getStatistics: () => productStatistics(),
};
