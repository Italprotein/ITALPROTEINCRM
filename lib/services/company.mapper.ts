import { Prisma } from "@/lib/generated/prisma/client";
import type { Company as PrismaCompany } from "@/lib/generated/prisma/client";
import type { Address, Company, FirstContact } from "@/lib/types";

// Prisma row <-> frontend DTO mappers for Company. Server-side only (imported by
// company.actions.ts). Key transforms: ownerUserId<->accountOwnerId,
// supportingTeamUserIds<->supportingTeamIds, *Minor (Int) <-> currency units,
// Json columns <-> typed objects, DateTime <-> ISO string, nullable ndaStatus.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/**
 * Logo bytes never cross this boundary — see `companyToDTO`. Typed as a row
 * *without* logoUrl so a caller that forgets `omit: OMIT_LOGO` still compiles,
 * while one that remembers it does too.
 */
type CompanyRow = Omit<PrismaCompany, "logoUrl">;

/** `omit` clause for company reads: keeps the base64 logo out of the query. */
export const OMIT_LOGO = { logoUrl: true } as const;

/**
 * Prisma row -> Company DTO (the shape the UI consumes).
 *
 * `logoUrl` is deliberately absent from the result. A logo is a ~10-50KB base64
 * data URI; carrying one per row would dwarf everything else in a companies
 * list payload. The DTO exposes `logoUpdatedAt` instead — enough for the UI to
 * decide between <img src="/api/companies/[id]/logo"> and initials — and the
 * API route streams the bytes with its own cache headers. Detail reads follow
 * the same rule: one route serves the logo, for both shapes.
 */
export function companyToDTO(c: CompanyRow): Company {
  return {
    id: c.id,
    legalName: c.legalName,
    tradingName: undef(c.tradingName),
    aliases: c.aliases,
    type: c.type,
    subtype: undef(c.subtype),
    description: undef(c.description),
    website: undef(c.website),
    linkedin: undef(c.linkedin),
    vatNumber: undef(c.vatNumber),
    registrationNumber: undef(c.registrationNumber),
    logoUpdatedAt: c.logoUpdatedAt?.toISOString() ?? null,
    initials: c.initials,
    accentColor: undef(c.accentColor),
    headquarters: c.headquarters as unknown as Address,
    additionalLocations: undef(c.additionalLocations as unknown as Address[] | null),
    billingAddress: undef(c.billingAddress as unknown as Address | null),
    shippingAddresses: undef(c.shippingAddresses as unknown as Address[] | null),
    country: c.country,
    countryCode: c.countryCode,
    city: c.city,
    region: undef(c.region),
    timezone: undef(c.timezone),
    preferredLanguage: c.preferredLanguage,
    preferredCurrency: c.preferredCurrency,
    size: undef(c.size),
    marketsServed: c.marketsServed,
    mainActivity: undef(c.mainActivity),
    leadSource: undef(c.leadSource),
    firstContact: c.firstContact as unknown as FirstContact,
    accountOwnerId: c.ownerUserId,
    supportingTeamIds: c.supportingTeamUserIds,
    territory: undef(c.territory),
    distributionMarkets: c.distributionMarkets,
    cooperationModel: undef(c.cooperationModel),
    relationshipStage: c.relationshipStage,
    leadScore: undef(c.leadScore),
    probability: undef(c.probability),
    priority: c.priority,
    ndaStatus: c.ndaStatus ?? "not_required",
    latestSampleStatus: undef(c.latestSampleStatus),
    productCategories: c.productCategories,
    applicationInterests: c.applicationInterests,
    estimatedAnnualPotential:
      c.estimatedAnnualPotentialMinor == null ? undefined : c.estimatedAnnualPotentialMinor / 100,
    opportunityValue: c.opportunityValueMinor == null ? undefined : c.opportunityValueMinor / 100,
    commercialNotes: undef(c.commercialNotes),
    logisticsRequirements: undef(c.logisticsRequirements),
    preferredCourier: undef(c.preferredCourier),
    deliveryInstructions: undef(c.deliveryInstructions),
    customsInfo: undef(c.customsInfo),
    paymentTerms: undef(c.paymentTerms),
    tags: c.tags,
    lastActivityAt: c.lastActivityAt?.toISOString(),
    nextAction: undef(c.nextAction as unknown as Company["nextAction"] | null),
    createdAt: c.createdAt.toISOString(),
  };
}

/**
 * Company DTO -> Prisma write payload (shared by create and update).
 *
 * The three logo columns are absent on purpose. updateCompany() rebuilds its
 * payload from `companyToDTO(existing)` merged with the caller's patch, and the
 * DTO no longer carries the bytes — writing `logoUrl: input.logoUrl ?? null`
 * here would wipe a company's logo on every unrelated edit. The logo columns
 * are owned solely by lib/services/logo.actions.ts.
 */
export function companyWriteData(input: Company, actorId: string | null) {
  return {
    legalName: input.legalName,
    tradingName: input.tradingName ?? null,
    aliases: input.aliases ?? [],
    type: input.type,
    subtype: input.subtype ?? null,
    description: input.description ?? null,
    website: input.website ?? null,
    linkedin: input.linkedin ?? null,
    vatNumber: input.vatNumber ?? null,
    registrationNumber: input.registrationNumber ?? null,
    initials: input.initials,
    accentColor: input.accentColor ?? null,
    headquarters: asJson(input.headquarters),
    additionalLocations: input.additionalLocations ? asJson(input.additionalLocations) : undefined,
    billingAddress: input.billingAddress ? asJson(input.billingAddress) : undefined,
    shippingAddresses: input.shippingAddresses ? asJson(input.shippingAddresses) : undefined,
    country: input.country,
    countryCode: input.countryCode,
    city: input.city,
    region: input.region ?? null,
    timezone: input.timezone ?? null,
    preferredLanguage: input.preferredLanguage,
    preferredCurrency: input.preferredCurrency,
    size: input.size ?? null,
    marketsServed: input.marketsServed ?? [],
    mainActivity: input.mainActivity ?? null,
    leadSource: input.leadSource ?? null,
    firstContact: asJson(input.firstContact),
    ownerUserId: input.accountOwnerId,
    supportingTeamUserIds: input.supportingTeamIds ?? [],
    territory: input.territory ?? null,
    distributionMarkets: input.distributionMarkets ?? [],
    cooperationModel: input.cooperationModel ?? null,
    relationshipStage: input.relationshipStage,
    leadScore: input.leadScore ?? null,
    probability: input.probability ?? null,
    priority: input.priority,
    ndaStatus: input.ndaStatus,
    latestSampleStatus: input.latestSampleStatus ?? null,
    productCategories: input.productCategories ?? [],
    applicationInterests: input.applicationInterests ?? [],
    estimatedAnnualPotentialMinor:
      input.estimatedAnnualPotential == null ? null : Math.round(input.estimatedAnnualPotential * 100),
    opportunityValueMinor:
      input.opportunityValue == null ? null : Math.round(input.opportunityValue * 100),
    commercialNotes: input.commercialNotes ?? null,
    logisticsRequirements: input.logisticsRequirements ?? null,
    preferredCourier: input.preferredCourier ?? null,
    deliveryInstructions: input.deliveryInstructions ?? null,
    customsInfo: input.customsInfo ?? null,
    paymentTerms: input.paymentTerms ?? null,
    tags: input.tags ?? [],
    lastActivityAt: input.lastActivityAt ? new Date(input.lastActivityAt) : null,
    nextAction: input.nextAction ? asJson(input.nextAction) : undefined,
    updatedById: actorId,
  };
}
