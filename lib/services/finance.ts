import type { FinanceDocument, FinanceDocKind } from "@/lib/types";
import type { FinanceService } from "@/lib/mock-services/financeService";
import {
  listFinanceDocuments,
  getFinanceDocument,
  createFinanceDocument,
  updateFinanceDocument,
  removeFinanceDocument,
  financeDocumentsByCompany,
  financeDocumentsByKind,
  financeStatistics,
} from "./finance.actions";

// Real (Prisma-backed) financeService — contract-identical to the mock service.
// FinanceDocument is a polymorphic view over the Quote/Order/Invoice/CreditNote
// tables; the actions handle routing by the document's `kind`.
export const financeService: FinanceService = {
  list: () => listFinanceDocuments(),
  get: (id: string) => getFinanceDocument(id),
  getById: (id: string) => getFinanceDocument(id),
  create: (d: FinanceDocument) => createFinanceDocument(d),
  update: (id: string, patch: Partial<FinanceDocument>) => updateFinanceDocument(id, patch),
  remove: (id: string) => removeFinanceDocument(id),
  reset: () => {},
  byCompany: (companyId: string) => financeDocumentsByCompany(companyId),
  byKind: (kind: FinanceDocKind) => financeDocumentsByKind(kind),
  getStatistics: () => financeStatistics(),
};
