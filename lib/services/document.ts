import type { DocumentRecord, DocumentCategory } from "@/lib/types";
import type { DocumentService } from "@/lib/mock-services/documentService";
import {
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  removeDocument,
  documentsByCompany,
  documentsByCategory,
  documentsForPortal,
  documentStatistics,
} from "./document.actions";

// Real (Prisma-backed) documentService — contract-identical to the mock service,
// so the UI is untouched. The barrel swaps this in when NEXT_PUBLIC_DATA_MODE=api.
export const documentService: DocumentService = {
  list: () => listDocuments(),
  get: (id: string) => getDocument(id),
  getById: (id: string) => getDocument(id),
  create: (d: DocumentRecord) => createDocument(d),
  update: (id: string, patch: Partial<DocumentRecord>) => updateDocument(id, patch),
  remove: (id: string) => removeDocument(id),
  reset: () => {},
  byCompany: (companyId: string) => documentsByCompany(companyId),
  byCategory: (category: DocumentCategory) => documentsByCategory(category),
  forPortal: (companyId: string, ndaSigned: boolean) => documentsForPortal(companyId, ndaSigned),
  getStatistics: () => documentStatistics(),
};
