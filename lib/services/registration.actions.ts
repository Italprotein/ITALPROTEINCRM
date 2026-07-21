"use server";

import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";

import {
  ApplicationCategory,
  CompanySize,
  CompanyType,
  Currency,
  Locale,
} from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/backend/prisma";
import { requireAction, requireSection } from "@/lib/backend/session";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/backend/rate-limit";
import { normalizeEmailAddress } from "@/lib/backend/gmail";
import {
  createActivationTokenMaterial,
  deliverAccountInvitation,
  replaceActivationToken,
  settleStagedActivationToken,
  stageActivationToken,
  type InvitationDeliveryResult,
} from "@/lib/backend/account-invitations";
import type { Registration, RegistrationStatus } from "@/lib/types";
import { registrationToDTO } from "./registration.mapper";

// Registrations are public-intake/admin-review records. Public creation is the
// one intentionally anonymous action; every queue/read/decision path is guarded.

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable();
const publicRegistrationSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  tradingName: optionalText(200),
  companyType: z.enum(CompanyType),
  companySubtype: optionalText(100),
  website: optionalText(500),
  country: z.string().trim().min(2).max(100),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  region: optionalText(100),
  city: z.string().trim().min(1).max(100),
  address: optionalText(300),
  postalCode: optionalText(30),
  vatNumber: optionalText(80),
  registrationNumber: optionalText(80),
  mainActivity: optionalText(1_000),
  companySize: z.enum(CompanySize).optional().nullable(),
  marketsServed: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  preferredLanguage: z.enum(Locale),
  preferredCurrency: z.enum(Currency),
  timezone: optionalText(100),
  contactFirstName: z.string().trim().min(1).max(100),
  contactLastName: z.string().trim().min(1).max(100),
  contactJobTitle: optionalText(150),
  contactDepartment: optionalText(150),
  contactEmail: z.string().trim().toLowerCase().email().max(320),
  contactPhone: optionalText(50),
  contactMobile: optionalText(50),
  contactLanguage: z.enum(Locale).optional().nullable(),
  reason: optionalText(2_000),
  existingContactPerson: optionalText(200),
  intendedApplications: z.array(z.enum(ApplicationCategory)).max(50).optional(),
  productCategories: z.array(z.enum(ApplicationCategory)).max(50).optional(),
  samplesRequested: z.boolean().optional().nullable(),
  intendedTerritories: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  estimatedTimeline: optionalText(200),
  additionalMessage: optionalText(5_000),
  privacyAccepted: z.literal(true),
  termsAccepted: z.literal(true),
  marketingOptIn: z.boolean().optional().nullable(),
});

export async function listRegistrations(): Promise<Registration[]> {
  await requireSection("registrations");
  const rows = await prisma.registration.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(registrationToDTO);
}

export async function getRegistration(id: string): Promise<Registration | undefined> {
  await requireSection("registrations");
  const row = await prisma.registration.findUnique({ where: { id } });
  return row ? registrationToDTO(row) : undefined;
}

/**
 * Intentionally unauthenticated: this is the public registration intake. Abuse
 * controls belong in rate limiting/captcha, not a session guard.
 */
export async function createRegistration(input: Registration): Promise<Registration> {
  const ip = clientIpFromHeaders(await headers());
  const byIp = await checkRateLimit(`registration:ip:${ip}`, 8, 60 * 60);
  if (!byIp.ok) throw new Error("RATE_LIMITED");

  const parsed = publicRegistrationSchema.safeParse(input);
  if (!parsed.success) throw new Error("INVALID_REGISTRATION");
  const data = parsed.data;
  const contactEmail = normalizeEmailAddress(data.contactEmail);
  if (!contactEmail) throw new Error("INVALID_REGISTRATION");
  const byEmail = await checkRateLimit(`registration:email:${contactEmail}`, 3, 60 * 60);
  if (!byEmail.ok) throw new Error("RATE_LIMITED");

  const row = await prisma.registration.create({
    data: {
      reference: `REG-${new Date().getUTCFullYear()}-${randomBytes(5).toString("hex").toUpperCase()}`,
      // The activation invitation verifies control of the contact mailbox;
      // successful, consented intake can therefore enter the admin review queue.
      status: "pending_approval",
      legalName: data.legalName,
      tradingName: data.tradingName || null,
      companyType: data.companyType,
      companySubtype: data.companySubtype || null,
      website: data.website || null,
      country: data.country,
      countryCode: data.countryCode,
      region: data.region || null,
      city: data.city,
      address: data.address || null,
      postalCode: data.postalCode || null,
      vatNumber: data.vatNumber || null,
      registrationNumber: data.registrationNumber || null,
      mainActivity: data.mainActivity || null,
      companySize: data.companySize ?? null,
      marketsServed: data.marketsServed ?? [],
      preferredLanguage: data.preferredLanguage,
      preferredCurrency: data.preferredCurrency,
      timezone: data.timezone || null,
      contactFirstName: data.contactFirstName,
      contactLastName: data.contactLastName,
      contactJobTitle: data.contactJobTitle || null,
      contactDepartment: data.contactDepartment || null,
      contactEmail,
      contactPhone: data.contactPhone || null,
      contactMobile: data.contactMobile || null,
      contactLanguage: data.contactLanguage ?? null,
      reason: data.reason || null,
      existingContactPerson: data.existingContactPerson || null,
      intendedApplications: data.intendedApplications ?? [],
      productCategories: data.productCategories ?? [],
      samplesRequested: data.samplesRequested ?? null,
      intendedTerritories: data.intendedTerritories ?? [],
      estimatedTimeline: data.estimatedTimeline || null,
      additionalMessage: data.additionalMessage || null,
      privacyAccepted: true,
      termsAccepted: true,
      marketingOptIn: data.marketingOptIn ?? null,
      linkedCompanyId: null,
      adminNote: null,
      decidedByUserId: null,
      decidedAt: null,
      createdById: null,
      updatedById: null,
    },
  });
  return registrationToDTO(row);
}

export async function updateRegistration(
  id: string,
  patch: Partial<Registration>,
): Promise<Registration | undefined> {
  const user = await requireAction("registration.approve");
  if (patch.status === "approved") {
    const result = await approveRegistration(id, patch.decidedByUserId);
    return result?.registration;
  }
  if (patch.status === "rejected") return rejectRegistration(id, patch.adminNote);

  const existing = await prisma.registration.findUnique({ where: { id } });
  if (!existing) return undefined;
  if (existing.status === "approved" || existing.status === "rejected") {
    return registrationToDTO(existing);
  }
  if (patch.decidedByUserId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: patch.decidedByUserId,
        kind: "internal",
        status: "active",
        role: { kind: "internal" },
      },
      select: { id: true },
    });
    if (!assignee) throw new Error("INVALID_ACCOUNT_OWNER");
  }

  // Generic queue edits are deliberately narrow. Registration source fields,
  // linkage and terminal decisions belong to dedicated workflows below.
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.registration.update({
      where: { id },
      data: {
        ...(patch.adminNote !== undefined ? { adminNote: patch.adminNote ?? null } : {}),
        ...(patch.decidedByUserId !== undefined
          ? { decidedByUserId: patch.decidedByUserId || null }
          : {}),
        ...(patch.status === "pending_approval" || patch.status === "more_info_requested"
          ? { status: patch.status }
          : {}),
        updatedById: user.id,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "registration.review_updated",
        entityType: "registration",
        entityId: id,
        summary: `Updated registration review ${existing.reference}`,
        result: "success",
        before: {
          status: existing.status,
          assigneeUserId: existing.decidedByUserId,
          adminNote: existing.adminNote,
        },
        after: {
          status: updated.status,
          assigneeUserId: updated.decidedByUserId,
          adminNote: updated.adminNote,
        },
      },
    });
    return updated;
  });
  return registrationToDTO(row);
}

const DECIDABLE_STATUSES = [
  "submitted",
  "email_verification",
  "pending_approval",
  "more_info_requested",
] as const;

function companyInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Approve once and provision Company + primary Contact + invited portal owner
 * in one transaction. Repeats return the completed registration; legacy partial
 * approvals fail closed instead of guessing at links.
 */
export async function approveRegistration(
  id: string,
  requestedAccountOwnerId?: string,
): Promise<{
  registration: Registration;
  invitationDelivery: InvitationDeliveryResult | null;
  alreadyApproved: boolean;
} | undefined> {
  const actor = await requireAction("registration.approve");
  const existing = await prisma.registration.findUnique({
    where: { id },
    include: {
      decisions: {
        where: { decision: "approve" },
        orderBy: { decidedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!existing) return undefined;
  if (existing.status === "approved") {
    const decision = existing.decisions[0];
    if (
      existing.linkedCompanyId &&
      decision?.provisionedCompanyId &&
      decision.provisionedContactId &&
      decision.provisionedOwnerUserId
    ) {
      return {
        registration: registrationToDTO(existing),
        invitationDelivery: null,
        alreadyApproved: true,
      };
    }
    throw new Error("APPROVAL_INCOMPLETE");
  }
  if (existing.status === "rejected") throw new Error("REGISTRATION_ALREADY_REJECTED");
  if (existing.status !== "pending_approval") throw new Error("REGISTRATION_NOT_READY_FOR_APPROVAL");
  if (!existing.privacyAccepted || !existing.termsAccepted) throw new Error("REGISTRATION_CONSENT_REQUIRED");

  const accountOwnerId = requestedAccountOwnerId || existing.decidedByUserId || actor.id;
  const accountOwner = await prisma.user.findFirst({
    where: {
      id: accountOwnerId,
      kind: "internal",
      status: "active",
      role: { kind: "internal" },
    },
    select: { id: true },
  });
  if (!accountOwner) throw new Error("INVALID_ACCOUNT_OWNER");

  const ownerRole = await prisma.role.findFirst({
    where: { key: "company_owner", kind: "external" },
    select: { id: true },
  });
  if (!ownerRole) throw new Error("COMPANY_OWNER_ROLE_MISSING");

  const normalizedEmail = normalizeEmailAddress(existing.contactEmail);
  if (!normalizedEmail) throw new Error("INVALID_CONTACT_EMAIL");
  if (await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })) {
    throw new Error("ACCOUNT_EMAIL_ALREADY_EXISTS");
  }

  const material = createActivationTokenMaterial();
  const provisioned = await prisma.$transaction(async (tx) => {
    const claimed = await tx.registration.updateMany({
      where: { id, status: "pending_approval", privacyAccepted: true, termsAccepted: true },
      data: {
        status: "approved",
        decidedByUserId: actor.id,
        decidedAt: new Date(),
        updatedById: actor.id,
      },
    });
    if (claimed.count !== 1) throw new Error("REGISTRATION_DECISION_CONFLICT");

    const note = [existing.reason, existing.additionalMessage].filter(Boolean).join(" — ") || undefined;
    const company = await tx.company.create({
      data: {
        legalName: existing.legalName,
        tradingName: existing.tradingName,
        aliases: [],
        type: existing.companyType,
        subtype: existing.companySubtype,
        website: existing.website,
        vatNumber: existing.vatNumber,
        registrationNumber: existing.registrationNumber,
        initials: companyInitials(existing.tradingName || existing.legalName),
        headquarters: {
          line1: existing.address ?? "",
          city: existing.city,
          ...(existing.region ? { region: existing.region } : {}),
          ...(existing.postalCode ? { postalCode: existing.postalCode } : {}),
          country: existing.country,
          countryCode: existing.countryCode,
        },
        country: existing.country,
        countryCode: existing.countryCode,
        city: existing.city,
        region: existing.region,
        timezone: existing.timezone,
        preferredLanguage: existing.preferredLanguage,
        preferredCurrency: existing.preferredCurrency,
        size: existing.companySize,
        marketsServed: existing.marketsServed,
        mainActivity: existing.mainActivity,
        leadSource: "inbound_web",
        firstContact: {
          date: existing.createdAt.toISOString(),
          channel: "inbound_web",
          personName: `${existing.contactFirstName} ${existing.contactLastName}`.trim(),
          ...(note ? { note } : {}),
        },
        distributionMarkets: existing.intendedTerritories,
        relationshipStage: "lead",
        priority: "medium",
        ndaStatus: "not_required",
        productCategories: existing.productCategories,
        applicationInterests: existing.intendedApplications,
        ownerUserId: accountOwner.id,
        supportingTeamUserIds: [],
        tags: [],
        createdById: actor.id,
        updatedById: actor.id,
      },
    });

    const contact = await tx.contact.create({
      data: {
        companyId: company.id,
        firstName: existing.contactFirstName,
        lastName: existing.contactLastName,
        jobTitle: existing.contactJobTitle,
        department: existing.contactDepartment,
        businessRole: "Company owner",
        decisionRole: "decision_maker",
        email: normalizedEmail,
        phone: existing.contactPhone,
        mobile: existing.contactMobile,
        country: existing.country,
        countryCode: existing.countryCode,
        timezone: existing.timezone,
        preferredLanguage: existing.contactLanguage ?? existing.preferredLanguage,
        isPrimary: true,
        isTechnical: false,
        isCommercial: false,
        isLegal: false,
        isLogistics: false,
        isFinance: false,
        communicationPreferences: ["email"],
        ownerUserId: accountOwner.id,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });

    const ownerUser = await tx.user.create({
      data: {
        name: `${existing.contactFirstName} ${existing.contactLastName}`.trim(),
        email: normalizedEmail,
        roleId: ownerRole.id,
        kind: "external",
        companyId: company.id,
        contactId: contact.id,
        status: "invited",
        passwordHash: null,
        emailVerified: null,
        language: existing.contactLanguage ?? existing.preferredLanguage,
        invitedByUserId: actor.id,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });

    await replaceActivationToken(tx, ownerUser.id, actor.id, material);
    const decision = await tx.registrationDecision.create({
      data: {
        registrationId: id,
        decision: "approve",
        reason: existing.adminNote,
        note: existing.adminNote,
        decidedByUserId: actor.id,
        decidedAt: new Date(),
        provisionedCompanyId: company.id,
        provisionedContactId: contact.id,
        provisionedOwnerUserId: ownerUser.id,
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    const row = await tx.registration.update({
      where: { id },
      data: { linkedCompanyId: company.id, updatedById: actor.id },
    });
    const emailLog = await tx.emailLog.create({
      data: {
        trigger: "account_invitation",
        templateKey: "registration_approved_account_invitation",
        to: normalizedEmail,
        toAddresses: [normalizedEmail],
        cc: [],
        subject:
          existing.preferredLanguage === "it"
            ? "Attiva il tuo account Italprotein CRM"
            : "Activate your Italprotein CRM account",
        preview: `Portal invitation for ${existing.legalName}`,
        locale: existing.contactLanguage ?? existing.preferredLanguage,
        status: "queued",
        recipientUserId: ownerUser.id,
        companyId: company.id,
        relatedEntityType: "registration",
        relatedEntityId: id,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "registration.approved_and_provisioned",
        entityType: "registration",
        entityId: id,
        summary: `Approved ${existing.reference}; provisioned company, contact and portal owner`,
        result: "success",
        companyId: company.id,
        after: {
          companyId: company.id,
          contactId: contact.id,
          ownerUserId: ownerUser.id,
          decisionId: decision.id,
        },
      },
    });

    return { row, ownerUser, emailLog };
  });

  const invitationDelivery = await deliverAccountInvitation({
    emailLogId: provisioned.emailLog.id,
    userId: provisioned.ownerUser.id,
    email: normalizedEmail,
    name: provisioned.ownerUser.name,
    locale: provisioned.ownerUser.language,
    workspace: "external",
    token: material.token,
  });
  return {
    registration: registrationToDTO(provisioned.row),
    invitationDelivery,
    alreadyApproved: false,
  };
}

/** Reissue a single-use portal activation link for an approved registration. */
export async function resendRegistrationInvitation(id: string) {
  const actor = await requireAction("registration.approve");
  const registration = await prisma.registration.findUnique({
    where: { id },
    include: {
      decisions: {
        where: { decision: "approve" },
        orderBy: { decidedAt: "desc" },
        take: 1,
      },
    },
  });
  const ownerUserId = registration?.decisions[0]?.provisionedOwnerUserId;
  if (registration?.status !== "approved" || !registration.linkedCompanyId || !ownerUserId) {
    throw new Error("APPROVAL_INCOMPLETE");
  }

  const ownerUser = await prisma.user.findFirst({
    where: {
      id: ownerUserId,
      kind: "external",
      status: "invited",
      companyId: registration.linkedCompanyId,
      role: { kind: "external" },
    },
    select: { id: true, email: true, name: true, language: true, companyId: true },
  });
  if (!ownerUser?.email || !ownerUser.companyId) throw new Error("PORTAL_INVITATION_NOT_AVAILABLE");
  const [byActor, byUser] = await Promise.all([
    checkRateLimit(`portal-resend:actor:${actor.id}`, 20, 60 * 60),
    checkRateLimit(`portal-resend:user:${ownerUser.id}`, 5, 60 * 60),
  ]);
  if (!byActor.ok || !byUser.ok) throw new Error("RATE_LIMITED");

  const material = createActivationTokenMaterial();
  const staged = await prisma.$transaction(async (tx) => {
    const token = await stageActivationToken(tx, ownerUser.id, actor.id, material);
    const log = await tx.emailLog.create({
      data: {
        trigger: "account_invitation",
        templateKey: "registration_approved_account_invitation_resend",
        to: ownerUser.email!,
        toAddresses: [ownerUser.email!],
        cc: [],
        subject:
          ownerUser.language === "it"
            ? "Attiva il tuo account Italprotein CRM"
            : "Activate your Italprotein CRM account",
        preview: `Portal invitation resent for ${registration.legalName}`,
        locale: ownerUser.language,
        status: "queued",
        recipientUserId: ownerUser.id,
        companyId: ownerUser.companyId,
        relatedEntityType: "registration",
        relatedEntityId: registration.id,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "registration.portal_invitation_resent",
        entityType: "registration",
        entityId: registration.id,
        summary: `Reissued portal invitation for ${registration.reference}`,
        result: "success",
        companyId: ownerUser.companyId,
        after: { ownerUserId: ownerUser.id, emailLogId: log.id },
      },
    });
    return { token, log };
  });

  const delivery = await deliverAccountInvitation({
    emailLogId: staged.log.id,
    userId: ownerUser.id,
    email: ownerUser.email,
    name: ownerUser.name,
    locale: ownerUser.language,
    workspace: "external",
    token: material.token,
  });
  await settleStagedActivationToken(ownerUser.id, staged.token, delivery.ok);
  return delivery;
}

export async function rejectRegistration(
  id: string,
  reason?: string,
): Promise<Registration | undefined> {
  const actor = await requireAction("registration.approve");
  const existing = await prisma.registration.findUnique({ where: { id } });
  if (!existing) return undefined;
  if (existing.status === "rejected") return registrationToDTO(existing);
  if (existing.status === "approved") throw new Error("REGISTRATION_ALREADY_APPROVED");

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.registration.updateMany({
      where: { id, status: { in: [...DECIDABLE_STATUSES] } },
      data: {
        status: "rejected",
        adminNote: reason ?? existing.adminNote,
        decidedByUserId: actor.id,
        decidedAt: new Date(),
        updatedById: actor.id,
      },
    });
    if (claimed.count !== 1) throw new Error("REGISTRATION_DECISION_CONFLICT");
    await tx.registrationDecision.create({
      data: {
        registrationId: id,
        decision: "reject",
        reason: reason ?? existing.adminNote,
        note: reason ?? existing.adminNote,
        decidedByUserId: actor.id,
        decidedAt: new Date(),
        createdById: actor.id,
        updatedById: actor.id,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "registration.rejected",
        entityType: "registration",
        entityId: id,
        summary: `Rejected ${existing.reference}`,
        result: "success",
      },
    });
    const row = await tx.registration.findUniqueOrThrow({ where: { id } });
    return registrationToDTO(row);
  });
}

export async function removeRegistration(id: string): Promise<void> {
  await requireAction("registration.approve");
  await prisma.registration.delete({ where: { id } }).catch(() => undefined);
}

export async function registrationsByStatus(
  status: RegistrationStatus,
): Promise<Registration[]> {
  await requireSection("registrations");
  const rows = await prisma.registration.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(registrationToDTO);
}

export async function registrationStatistics() {
  await requireSection("registrations");
  const rows = await prisma.registration.findMany({ select: { status: true } });
  const has = (...statuses: RegistrationStatus[]) =>
    rows.filter((row) => statuses.includes(row.status)).length;
  return {
    total: rows.length,
    pending: has("submitted", "email_verification", "pending_approval"),
    moreInfo: has("more_info_requested"),
    approved: has("approved"),
    rejected: has("rejected"),
  };
}
