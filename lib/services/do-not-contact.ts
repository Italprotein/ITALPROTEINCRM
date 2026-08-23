import type { DoNotContactEntry } from "@/lib/types";
import type { DoNotContactInput, DoNotContactPatch } from "@/lib/do-not-contact";
import type { DoNotContactService } from "@/lib/mock-services/doNotContactService";
import {
  listDoNotContactEntries,
  getDoNotContactEntry,
  doNotContactForCompany,
  isCompanyDoNotContact,
  addToDoNotContact,
  updateDoNotContactEntry,
  removeFromDoNotContact,
} from "./do-not-contact.actions";

// Real (Prisma-backed) doNotContactService — contract-identical to the mock
// service. The register is not company-scoped: every internal role reads the
// whole list, which is the point of having one.
export const doNotContactService: DoNotContactService = {
  list: () => listDoNotContactEntries(),
  get: (id: string) => getDoNotContactEntry(id),
  byCompany: (companyId: string) => doNotContactForCompany(companyId),
  // The brief-mandated name a future send path will call, plus the older alias.
  isCompanyDoNotContact: (companyId: string) => isCompanyDoNotContact(companyId),
  isCompanyListed: (companyId: string) => isCompanyDoNotContact(companyId),
  add: (input: DoNotContactInput) => addToDoNotContact(input),
  update: (id: string, patch: DoNotContactPatch): Promise<DoNotContactEntry | undefined> =>
    updateDoNotContactEntry(id, patch),
  remove: (id: string) => removeFromDoNotContact(id),
  reset: () => {},
};
