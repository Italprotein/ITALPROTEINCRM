"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
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

export async function listNotifications(): Promise<AppNotification[]> {
  const rows = await prisma.notification.findMany({
    where: await scopeWhere(),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(notificationToDTO);
}

export async function getNotification(id: string): Promise<AppNotification | undefined> {
  const rows = await prisma.notification.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    take: 1,
  });
  return rows[0] ? notificationToDTO(rows[0]) : undefined;
}

export async function createNotification(input: AppNotification): Promise<AppNotification> {
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
  await prisma.notification.delete({ where: { id } }).catch(() => undefined);
}

export async function notificationsForAudience(q: AudienceQuery): Promise<AppNotification[]> {
  const rows = await prisma.notification.findMany({
    where: { AND: [await scopeWhere(), audienceWhere(q)] },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(notificationToDTO);
}

export async function notificationUnreadCount(q: AudienceQuery): Promise<number> {
  return prisma.notification.count({
    where: { AND: [await scopeWhere(), audienceWhere(q), { read: false }] },
  });
}

export async function markNotificationRead(id: string): Promise<AppNotification | undefined> {
  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) return undefined;
  const row = await prisma.notification.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  });
  return notificationToDTO(row);
}

export async function markAllNotificationsRead(q: AudienceQuery): Promise<void> {
  await prisma.notification.updateMany({
    where: { AND: [await scopeWhere(), audienceWhere(q), { read: false }] },
    data: { read: true, readAt: new Date() },
  });
}

export async function notificationStatistics(
  q: AudienceQuery,
): Promise<{ total: number; unread: number; byType: Record<NotificationType, number> }> {
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
