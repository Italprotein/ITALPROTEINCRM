import type { LeadService } from "@/lib/mock-services/leadService";
import { leadsByAdmin, leadStatistics, listLeads, listMyLeads, removeLead } from "./lead.actions";

// Real (Prisma-backed) "My Leads" service — contract-identical to the mock.
export const leadService: LeadService = {
  listMine: () => listMyLeads(),
  list: () => listLeads(),
  byAdmin: (adminUserId: string) => leadsByAdmin(adminUserId),
  remove: (id: string) => removeLead(id),
  getStatistics: () => leadStatistics(),
  reset: () => {},
};
