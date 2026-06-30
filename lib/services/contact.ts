import type { Contact } from "@/lib/types";
import type { ContactService } from "@/lib/mock-services/contactService";
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  removeContact,
  contactsByCompany,
  searchContacts,
  contactStatistics,
} from "./contact.actions";

// Real (Prisma-backed) contactService — contract-identical to the mock service.
// The barrel swaps this in when NEXT_PUBLIC_DATA_MODE=api.
export const contactService: ContactService = {
  list: () => listContacts(),
  get: (id: string) => getContact(id),
  getById: (id: string) => getContact(id),
  create: (c: Contact) => createContact(c),
  update: (id: string, patch: Partial<Contact>) => updateContact(id, patch),
  remove: (id: string) => removeContact(id),
  reset: () => {},
  byCompany: (companyId: string) => contactsByCompany(companyId),
  search: (q: string) => searchContacts(q),
  getStatistics: () => contactStatistics(),
};
