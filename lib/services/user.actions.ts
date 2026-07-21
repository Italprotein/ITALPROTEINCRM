"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { requireAction, requireInternal, requireSection } from "@/lib/backend/session";
import { checkRateLimit } from "@/lib/backend/rate-limit";
import { normalizeEmailAddress } from "@/lib/backend/gmail";
import {
  createActivationTokenMaterial,
  deliverAccountInvitation,
  replaceActivationToken,
  settleStagedActivationToken,
  stageActivationToken,
  type InvitationDeliveryResult,
} from "@/lib/backend/account-invitations";
import type { InternalRole } from "@/lib/types";
import type { StaffMember } from "@/fixtures";
import { userInclude, userToDTO } from "./user.mapper";

function staffWhere(): Prisma.UserWhereInput {
  return { kind: "internal" };
}

async function roleIdForKey(key: InternalRole): Promise<string | null> {
  const role = await prisma.role.findFirst({ where: { key, kind: "internal" } });
  return role?.id ?? null;
}

export async function listUsers(): Promise<StaffMember[]> {
  await requireInternal();
  const rows = await prisma.user.findMany({
    where: staffWhere(),
    include: userInclude,
    orderBy: { name: "asc" },
  });
  return rows.map(userToDTO);
}

export async function getUser(id: string): Promise<StaffMember | undefined> {
  await requireSection("users");
  const rows = await prisma.user.findMany({
    where: { AND: [staffWhere(), { id }] },
    include: userInclude,
    take: 1,
  });
  return rows[0] ? userToDTO(rows[0]) : undefined;
}

export interface InviteStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  role: InternalRole;
}

export interface InviteStaffResult {
  user: StaffMember;
  delivery: InvitationDeliveryResult;
}

export async function inviteStaff(input: InviteStaffInput): Promise<InviteStaffResult> {
  const actor = await requireAction("user.manage");
  if (input.role === "super_admin" && actor.role !== "super_admin") throw new Error("FORBIDDEN");
  const roleId = await roleIdForKey(input.role);
  if (!roleId) throw new Error("INTERNAL_ROLE_MISSING");

  const email = normalizeEmailAddress(input.email);
  const name = [input.firstName.trim(), input.lastName.trim()].filter(Boolean).join(" ");
  if (!name || !email) throw new Error("INVALID_STAFF_INVITATION");
  const [byActor, byRecipient] = await Promise.all([
    checkRateLimit(`staff-invite:actor:${actor.id}`, 20, 60 * 60),
    checkRateLimit(`staff-invite:email:${email}`, 5, 60 * 60),
  ]);
  if (!byActor.ok || !byRecipient.ok) throw new Error("RATE_LIMITED");
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new Error("ACCOUNT_EMAIL_ALREADY_EXISTS");
  }

  const material = createActivationTokenMaterial();
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.user.create({
      data: {
        name,
        email,
        status: "invited",
        passwordHash: null,
        emailVerified: null,
        kind: "internal",
        roleId,
        invitedByUserId: actor.id,
        createdById: actor.id,
        updatedById: actor.id,
      },
      include: userInclude,
    });
    await replaceActivationToken(tx, row.id, actor.id, material);
    const emailLog = await tx.emailLog.create({
      data: {
        trigger: "account_invitation",
        templateKey: "staff_account_invitation",
        to: email,
        toAddresses: [email],
        cc: [],
        subject: "Activate your Italprotein CRM account",
        preview: `Team invitation for ${name}`,
        locale: "en",
        status: "queued",
        recipientUserId: row.id,
        relatedEntityType: "user",
        relatedEntityId: row.id,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "user.invited",
        entityType: "user",
        entityId: row.id,
        summary: `Invited internal user ${email}`,
        result: "success",
      },
    });
    return { row, emailLog };
  });

  const delivery = await deliverAccountInvitation({
    emailLogId: created.emailLog.id,
    userId: created.row.id,
    email,
    name,
    locale: "en",
    workspace: "internal",
    token: material.token,
  });
  return { user: userToDTO(created.row), delivery };
}

export async function createUser(input: StaffMember): Promise<StaffMember> {
  const result = await inviteStaff({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    role: input.role,
  });
  return result.user;
}

export async function resendUserInvitation(id: string): Promise<InvitationDeliveryResult> {
  const actor = await requireAction("user.manage");
  const user = await prisma.user.findFirst({
    where: { id, kind: "internal", status: "invited", role: { kind: "internal" } },
    include: userInclude,
  });
  if (!user?.email) throw new Error("INVITED_USER_NOT_FOUND");
  if (user.role.key === "super_admin" && actor.role !== "super_admin") throw new Error("FORBIDDEN");
  const [byActor, byUser] = await Promise.all([
    checkRateLimit(`staff-resend:actor:${actor.id}`, 20, 60 * 60),
    checkRateLimit(`staff-resend:user:${user.id}`, 5, 60 * 60),
  ]);
  if (!byActor.ok || !byUser.ok) throw new Error("RATE_LIMITED");

  const material = createActivationTokenMaterial();
  const staged = await prisma.$transaction(async (tx) => {
    const token = await stageActivationToken(tx, user.id, actor.id, material);
    const emailLog = await tx.emailLog.create({
      data: {
        trigger: "account_invitation",
        templateKey: "staff_account_invitation_resend",
        to: user.email!,
        toAddresses: [user.email!],
        cc: [],
        subject: "Activate your Italprotein CRM account",
        preview: `Resent team invitation for ${user.name ?? user.email}`,
        locale: user.language,
        status: "queued",
        recipientUserId: user.id,
        relatedEntityType: "user",
        relatedEntityId: user.id,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "user.invitation_resent",
        entityType: "user",
        entityId: user.id,
        summary: `Reissued internal invitation for ${user.email}`,
        result: "success",
        after: { emailLogId: emailLog.id },
      },
    });
    return { token, emailLog };
  });
  const delivery = await deliverAccountInvitation({
    emailLogId: staged.emailLog.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    locale: user.language,
    workspace: "internal",
    token: material.token,
  });
  await settleStagedActivationToken(user.id, staged.token, delivery.ok);
  return delivery;
}

export async function updateUser(
  id: string,
  patch: Partial<StaffMember>,
): Promise<StaffMember | undefined> {
  const actor = await requireAction("user.manage");
  const existing = await prisma.user.findFirst({
    where: { AND: [staffWhere(), { id }] },
    include: userInclude,
  });
  if (!existing) return undefined;
  const requestedRole = patch.role;
  const requestedStatus = patch.status;
  if (requestedStatus && requestedStatus !== "active" && requestedStatus !== "suspended") {
    throw new Error("INVALID_USER_STATUS");
  }
  if (existing.status === "invited" && requestedStatus === "active") {
    throw new Error("INVITATION_MUST_BE_ACTIVATED");
  }
  if (
    actor.role !== "super_admin" &&
    (existing.role.key === "super_admin" || requestedRole === "super_admin")
  ) {
    throw new Error("FORBIDDEN");
  }
  if (actor.id === id && requestedStatus === "suspended") throw new Error("CANNOT_SUSPEND_SELF");

  const roleId = requestedRole ? await roleIdForKey(requestedRole) : null;
  if (requestedRole && !roleId) throw new Error("INTERNAL_ROLE_MISSING");

  const row = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirstOrThrow({
      where: { id, kind: "internal" },
      include: userInclude,
    });
    if (
      actor.role !== "super_admin" &&
      (current.role.key === "super_admin" || requestedRole === "super_admin")
    ) {
      throw new Error("FORBIDDEN");
    }
    if (current.status === "invited" && requestedStatus === "active") {
      throw new Error("INVITATION_MUST_BE_ACTIVATED");
    }
    const removesActiveSuperAdmin =
      current.role.key === "super_admin" &&
      current.status === "active" &&
      ((requestedRole !== undefined && requestedRole !== "super_admin") ||
        (requestedStatus !== undefined && requestedStatus !== "active"));
    if (removesActiveSuperAdmin) {
      const otherActiveSuperAdmins = await tx.user.count({
        where: {
          id: { not: id },
          kind: "internal",
          status: "active",
          role: { key: "super_admin", kind: "internal" },
        },
      });
      if (otherActiveSuperAdmins === 0) throw new Error("LAST_ACTIVE_SUPER_ADMIN");
    }
    const updated = await tx.user.update({
      where: { id },
      data: {
        ...(requestedStatus ? { status: requestedStatus } : {}),
        ...(roleId ? { role: { connect: { id: roleId } } } : {}),
        ...(requestedStatus || requestedRole ? { authVersion: { increment: 1 } } : {}),
        updatedById: actor.id,
      },
      include: userInclude,
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "user.updated",
        entityType: "user",
        entityId: id,
        summary: `Updated internal user ${current.email ?? id}`,
        result: "success",
        before: { role: current.role.key, status: current.status },
        after: { role: updated.role.key, status: updated.status },
      },
    });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return userToDTO(row);
}

export async function removeUser(id: string): Promise<void> {
  const actor = await requireAction("user.manage");
  if (actor.id === id) throw new Error("CANNOT_DELETE_SELF");
  const target = await prisma.user.findFirst({
    where: { id, kind: "internal" },
    include: { role: true },
  });
  if (!target) return;
  if (target.role.key === "super_admin") {
    if (actor.role !== "super_admin") throw new Error("FORBIDDEN");
  }
  await prisma.$transaction(async (tx) => {
    const current = await tx.user.findFirstOrThrow({
      where: { id, kind: "internal" },
      include: { role: true },
    });
    if (current.role.key === "super_admin" && actor.role !== "super_admin") {
      throw new Error("FORBIDDEN");
    }
    if (current.role.key === "super_admin" && current.status === "active") {
      const otherActiveSuperAdmins = await tx.user.count({
        where: {
          id: { not: id },
          kind: "internal",
          status: "active",
          role: { key: "super_admin", kind: "internal" },
        },
      });
      if (otherActiveSuperAdmins === 0) throw new Error("LAST_ACTIVE_SUPER_ADMIN");
    }
    await tx.user.delete({ where: { id } });
    await tx.auditEvent.create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "user.deleted",
        entityType: "user",
        entityId: id,
        summary: `Deleted internal user ${current.email ?? id}`,
        result: "success",
        before: { role: current.role.key, status: current.status },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function usersByRole(role: InternalRole): Promise<StaffMember[]> {
  await requireInternal();
  const rows = await prisma.user.findMany({
    where: { AND: [staffWhere(), { role: { key: role } }] },
    include: userInclude,
    orderBy: { name: "asc" },
  });
  return rows.map(userToDTO);
}

export async function assignedCompanyCount(id: string): Promise<number> {
  await requireSection("users");
  return prisma.company.count({ where: { ownerUserId: id } });
}

export async function userStatistics() {
  await requireSection("users");
  const rows = await prisma.user.findMany({
    where: staffWhere(),
    select: { status: true, role: { select: { key: true } } },
  });
  const byRole = {} as Record<InternalRole, number>;
  for (const row of rows) {
    const key = row.role.key as InternalRole;
    byRole[key] = (byRole[key] ?? 0) + 1;
  }
  return {
    total: rows.length,
    active: rows.filter((row) => row.status === "active").length,
    invited: rows.filter((row) => row.status === "invited").length,
    suspended: rows.filter((row) => row.status === "suspended" || row.status === "disabled").length,
    byRole,
  };
}
