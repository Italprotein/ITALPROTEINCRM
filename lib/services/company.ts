import type { Company } from "@/lib/types";
import type { CompanyQuery, CompanyService } from "@/lib/mock-services/companyService";
import {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  removeCompany,
  countCompanies,
  companiesByCountry,
  companiesByType,
  companyStatistics,
} from "./company.actions";

// Real (Prisma-backed) companyService. Same contract as the mock service, so the
// UI is untouched — the barrel swaps this in when NEXT_PUBLIC_DATA_MODE=api.
export const companyService: CompanyService = {
  list: (query: CompanyQuery = {}) => listCompanies(query),
  get: (id: string) => getCompany(id),
  getById: (id: string) => getCompany(id),
  create: (c: Company) => createCompany(c),
  update: (id: string, patch: Partial<Company>) => updateCompany(id, patch),
  remove: (id: string) => removeCompany(id),
  reset: () => {},
  count: () => countCompanies(),
  byCountry: () => companiesByCountry(),
  byType: () => companiesByType(),
  getStatistics: () => companyStatistics(),
};
