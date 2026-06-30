import type { Company as PrismaCompany } from "@/lib/generated/prisma/client";
import type { Agency } from "@/lib/mock-services/agencyService";
import { companyToDTO } from "./company.mapper";

// Agencies/distributors are Company records of type=agency|distributor (partner-
// network records), joined with partner-network metadata. The schema has NO
// dedicated agency-meta table (see prisma/schema.prisma DESIGN DECISION around
// CompanyType): agencies are modelled as Company rows. We therefore DERIVE the
// `meta` block from available Company columns and provide sensible defaults for
// fields that have no backing column (companiesIntroducedIds / activeLeads /
// conversionRate). This mapper is server-side only (imported by agency.actions.ts).

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

type AgencyMeta = Agency["meta"];

/** Derive partner-network metadata from a Company row. */
function metaFromCompany(c: PrismaCompany): AgencyMeta {
  // agreementStatus has no column — derive a sensible value from ndaStatus.
  let agreementStatus: AgencyMeta["agreementStatus"] = "none";
  if (c.ndaStatus === "fully_signed") agreementStatus = "active";
  else if (c.ndaStatus === "sent" || c.ndaStatus === "under_review") agreementStatus = "draft";

  const nextAction = c.nextAction as unknown as AgencyMeta["nextAction"] | null;

  return {
    territory: c.territory ?? "",
    countriesCovered: c.distributionMarkets,
    agencyType: c.cooperationModel ?? c.type,
    agreementStatus,
    // TODO: no Company column for companies introduced via this partner — persist
    // a relation/Json column to surface real values; defaulting to empty for now.
    companiesIntroducedIds: [],
    // TODO: no Company column for activeLeads — default until a column exists.
    activeLeads: 0,
    // TODO: no Company column for conversionRate — default until a column exists.
    conversionRate: 0,
    lastInteractionAt: (c.lastActivityAt ?? c.createdAt).toISOString(),
    nextAction: undef(nextAction ?? null),
  };
}

/** Prisma Company row -> Agency DTO (Company DTO + derived partner meta). */
export function agencyToDTO(c: PrismaCompany): Agency {
  return { ...companyToDTO(c), meta: metaFromCompany(c) };
}
