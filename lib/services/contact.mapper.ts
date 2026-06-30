import { Prisma } from "@/lib/generated/prisma/client";
import type { Contact as PrismaContact } from "@/lib/generated/prisma/client";
import type { Contact, Locale } from "@/lib/types";

// Prisma row <-> Contact DTO. Key transforms: ownerUserId<->ownerId (FK rename),
// nextAction Json <-> typed object, lastContactAt DateTime <-> ISO string. The
// portalAccountId DTO field is the reverse side of User.contactId (relation
// "UserPortalContact"), so it is read from the optional portalUser relation and
// is not a writable scalar.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** Prisma row (optionally with portalUser) -> Contact DTO. */
export function contactToDTO(
  c: PrismaContact & { portalUser?: { id: string } | null },
): Contact {
  return {
    id: c.id,
    companyId: c.companyId,
    firstName: c.firstName,
    lastName: c.lastName,
    jobTitle: undef(c.jobTitle),
    department: undef(c.department),
    businessRole: undef(c.businessRole),
    decisionRole: undef(c.decisionRole),
    email: c.email,
    secondaryEmail: undef(c.secondaryEmail),
    phone: undef(c.phone),
    mobile: undef(c.mobile),
    whatsapp: undef(c.whatsapp),
    linkedin: undef(c.linkedin),
    country: undef(c.country),
    countryCode: undef(c.countryCode),
    timezone: undef(c.timezone),
    preferredLanguage: undef(c.preferredLanguage as Locale | null),
    isPrimary: c.isPrimary,
    isTechnical: c.isTechnical,
    isCommercial: c.isCommercial,
    isLegal: c.isLegal,
    isLogistics: c.isLogistics,
    isFinance: c.isFinance,
    communicationPreferences: c.communicationPreferences,
    lastContactAt: c.lastContactAt?.toISOString(),
    nextAction: undef(c.nextAction as unknown as Contact["nextAction"] | null),
    ownerId: undef(c.ownerUserId),
    notes: undef(c.notes),
    portalAccountId: c.portalUser?.id ?? undefined,
    createdAt: c.createdAt.toISOString(),
  };
}

/** Contact DTO -> Prisma write payload (shared by create and update). */
export function contactWriteData(input: Contact, actorId: string | null) {
  return {
    companyId: input.companyId,
    firstName: input.firstName,
    lastName: input.lastName,
    jobTitle: input.jobTitle ?? null,
    department: input.department ?? null,
    businessRole: input.businessRole ?? null,
    decisionRole: input.decisionRole ?? null,
    email: input.email,
    secondaryEmail: input.secondaryEmail ?? null,
    phone: input.phone ?? null,
    mobile: input.mobile ?? null,
    whatsapp: input.whatsapp ?? null,
    linkedin: input.linkedin ?? null,
    country: input.country ?? null,
    countryCode: input.countryCode ?? null,
    timezone: input.timezone ?? null,
    preferredLanguage: input.preferredLanguage ?? null,
    isPrimary: input.isPrimary ?? false,
    isTechnical: input.isTechnical ?? false,
    isCommercial: input.isCommercial ?? false,
    isLegal: input.isLegal ?? false,
    isLogistics: input.isLogistics ?? false,
    isFinance: input.isFinance ?? false,
    communicationPreferences: input.communicationPreferences ?? [],
    lastContactAt: input.lastContactAt ? new Date(input.lastContactAt) : null,
    nextAction: input.nextAction ? asJson(input.nextAction) : undefined,
    ownerUserId: input.ownerId ?? null,
    notes: input.notes ?? null,
    // portalAccountId is the reverse side of User.contactId (relation
    // "UserPortalContact") and not a writable scalar here. TODO: link/unlink the
    // portal User via identity provisioning when that flow is integrated.
    updatedById: actorId,
  };
}
