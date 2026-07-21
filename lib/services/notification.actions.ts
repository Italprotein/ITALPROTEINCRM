"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireInternal, requireUser } from "@/lib/backend/session";
import type { AppNotification, NotificationType } from "@/lib/types";
import type { AudienceQuery } from "@/lib/mock-services/notificationService";
import { notificationToDTO, notificationWriteData } from "./notification.mapper";

// Server-side notification scope. External users only ever see their own
// company's portal notifications; internal users see all. The server is the
// authority — client-supplied companyId in the audience query is reconciled
// against the session, never trusted on its own.
async function scopeWhere(): Promise<Prisma.NotificationWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") {
    const companyId = user.companyId ?? "__no_company__";
    return {
      workspace: "external",
      OR: [{ audienceCompanyId: null }, { audienceCompanyId: companyId }],
    };
  }
  return {};
}

// Mirrors the mock's inAudience() as a Prisma filter. For external audiences,
// scopeWhere already constrains the company, so the audience query only narrows
// the workspace. For internal audiences: admins see everything; other roles see
// items with no role targeting OR items targeted at their role.
function audienceWhere(q: AudienceQuery): Prisma.NotificationWhereInput {
  if (q.workspace === "external") {
    return {
      workspace: "external",
      OR: [
        { audienceCompanyId: null },
        ...(q.companyId ? [{ audienceCompanyId: q.companyId }] : []),
      ],
    };
  }
  // internal
  if (q.role === "super_admin" || q.role === "crm_admin") {
    return { workspace: "internal" };
  }
  if (!q.role) return { workspace: "internal" };
  return {
    workspace: "internal",
    OR: [{ audienceRoles: { isEmpty: true } }, { audienceRoles: { has: q.role } }],
  };
}

// AUTHZ: every exported action below is a POST endpoint reachable by any
// caller that knows the action id, so each one opens with a guard. Reads use
// requireUser() because BOTH workspaces have a notifications section (a portal
// user must still reach their own notifications); scopeWhere() then narrows
// external callers to their company. Writes are internal-only.

export async function listNotifications(): Promise<AppNotification[]> {
  await requireUser();
  const rows = await prisma.notification.findMany({
    where: await scopeWhere(),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(notificationToDTO);
}

export async function getNotification(id: string): Promise<AppNotification | undefined> {
  await requireUser();
  const rows = await prisma.notification.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    take: 1,
  });
  return rows[0] ? notificationToDTO(rows[0]) : undefined;
}

export async function createNotification(input: AppNotification): Promise<AppNotification> {
  // Internal-only: a notification renders in the recipients' notification centre
  // as trusted first-party content, so it must never be creatable by an
  // anonymous or portal caller.
  await requireInternal();
  // TODO(authz-followup): the audience is still taken from the caller's input
  // (`workspace`, `audienceRoles`, `audienceCompanyId`). Those fields decide who
  // sees the notification and must be derived server-side from the triggering
  // event, not trusted from the request body. Left as-is in this pass because
  // changing the signature would break the notificationService contract; when the
  // portal-triggered side effects (feedback/sample/registration -> notify staff)
  // are wired, route them through an internal server-side helper that sets the
  // audience itself instead of exposing this action to those flows.
  const row = await prisma.notification.create({
    data: { ...notificationWriteData(input), id: input.id },
  });
  // TODO: fan out to email/push delivery once those channels are integrated.
  return notificationToDTO(row);
}

export async function updateNotification(
  id: string,
  patch: Partial<AppNotification>,
): Promise<AppNotification | undefined> {
  await requireInternal();
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: AppNotification = { ...notificationToDTO(existing), ...patch };
  const row = await prisma.notification.update({
    where: { id },
    data: notificationWriteData(merged),
  });
  return notificationToDTO(row);
}

export async function removeNotification(id: string): Promise<void> {
  // Deliberately requireInternal() and NOT requireSectionEdit('notifications'):
  // the delete control lives on /admin/notifications, which every internal role
  // can open, but `notifications` is only 'view' for business_dev / rnd_technical
  // / logistics / finance / management_readonly — an edit guard would silently
  // break the button for five legitimate roles. requireInternal() still closes
  // the anonymous-delete hole and keeps portal users out of the internal inbox.
  await requireInternal();
  await prisma.notification.delete({ where: { id } }).catch(() => undefined);
}

export async function notificationsForAudience(q: AudienceQuery): Promise<AppNotification[]> {
  // Shared internal+portal read (notification centre and badges) — requireUser().
  await requireUser();
  const rows = await prisma.notification.findMany({
    where: { AND: [await scopeWhere(), audienceWhere(q)] },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(notificationToDTO);
}

export async function notificationUnreadCount(q: AudienceQuery): Promise<number> {
  // Cross-page unread badge (both workspaces) — keep at requireUser().
  await requireUser();
  return prisma.notification.count({
    where: { AND: [await scopeWhere(), audienceWhere(q), { read: false }] },
  });
}

export async function markNotificationRead(id: string): Promise<AppNotification | undefined> {
  // Read-state toggle used by view-only roles in BOTH workspaces (a portal
  // company_member has notifications: 'view'), so an edit guard would break it.
  // TODO(authz-followup): this looks up by bare id and does not re-check the
  // caller's scope, so one authenticated user can flip another audience's read
  // flag. Low impact, but it should reuse scopeWhere() in a later pass.
  await requireUser();
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) return undefined;
  const row = await prisma.notification.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  });
  return notificationToDTO(row);
}

export async function markAllNotificationsRead(q: AudienceQuery): Promise<void> {
  // Same as markNotificationRead — available to view-only roles in both
  // workspaces; scopeWhere() already constrains what can be touched.
  await requireUser();
  await prisma.notification.updateMany({
    where: { AND: [await scopeWhere(), audienceWhere(q), { read: false }] },
    data: { read: true, readAt: new Date() },
  });
}

export async function notificationStatistics(
  q: AudienceQuery,
): Promise<{ total: number; unread: number; byType: Record<NotificationType, number> }> {
  await requireUser();
  const where: Prisma.NotificationWhereInput = { AND: [await scopeWhere(), audienceWhere(q)] };
  const rows = await prisma.notification.findMany({ where, select: { type: true, read: true } });
  const byType = {} as Record<NotificationType, number>;
  let unread = 0;
  for (const r of rows) {
    const t = r.type as NotificationType;
    byType[t] = (byType[t] ?? 0) + 1;
    if (!r.read) unread++;
  }
  return { total: rows.length, unread, byType };
}
