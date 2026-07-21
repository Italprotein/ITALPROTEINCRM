"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireSectionEdit } from "@/lib/backend/session";
import type { Activity, ActivityType } from "@/lib/types";
import { activityToDTO, activityWriteData } from "./activity.mapper";

// Activity is an append-only timeline scoped by companyId. External users see
// only their own company's activities; internal users see all. Activities with
// no companyId (system-level) are visible to internal users only.
async function scopeWhere(): Promise<Prisma.ActivityWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

export async function listActivities(): Promise<Activity[]> {
  // Authenticated-only: `activities` is hidden for external roles, but the portal
  // timeline reads through these helpers; scopeWhere() confines it to own company.
  await requireUser();
  const rows = await prisma.activity.findMany({
    where: await scopeWhere(),
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(activityToDTO);
}

export async function getActivity(id: string): Promise<Activity | undefined> {
  await requireUser();
  const rows = await prisma.activity.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    take: 1,
  });
  return rows[0] ? activityToDTO(rows[0]) : undefined;
}

export async function createActivity(input: Activity): Promise<Activity> {
  // No `activity.*` Action exists, so gate on edit-or-full of the section.
  await requireSectionEdit("activities");
  const row = await prisma.activity.create({
    data: { ...activityWriteData(input), id: input.id },
  });
  return activityToDTO(row);
}

export async function updateActivity(
  id: string,
  patch: Partial<Activity>,
): Promise<Activity | undefined> {
  await requireSectionEdit("activities");
  const existing = await prisma.activity.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: Activity = { ...activityToDTO(existing), ...patch };
  const row = await prisma.activity.update({ where: { id }, data: activityWriteData(merged) });
  return activityToDTO(row);
}

export async function removeActivity(id: string): Promise<void> {
  await requireSectionEdit("activities");
  await prisma.activity.delete({ where: { id } }).catch(() => undefined);
}

export async function activitiesByCompany(companyId: string): Promise<Activity[]> {
  await requireUser();
  const rows = await prisma.activity.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(activityToDTO);
}

export async function recentActivities(limit = 12): Promise<Activity[]> {
  await requireUser();
  const rows = await prisma.activity.findMany({
    where: await scopeWhere(),
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
  return rows.map(activityToDTO);
}

export async function activitiesByType(type: ActivityType): Promise<Activity[]> {
  await requireUser();
  const rows = await prisma.activity.findMany({
    where: { AND: [await scopeWhere(), { type }] },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(activityToDTO);
}

/** Client-visible activities for a portal company. */
export async function activitiesForPortal(companyId: string): Promise<Activity[]> {
  await requireUser();
  const rows = await prisma.activity.findMany({
    where: { AND: [await scopeWhere(), { companyId, visibility: "client" }] },
    orderBy: { occurredAt: "desc" },
  });
  return rows.map(activityToDTO);
}

export async function activityStatistics() {
  await requireUser();
  const rows = await prisma.activity.findMany({
    where: await scopeWhere(),
    select: { type: true },
  });
  const byType = {} as Record<ActivityType, number>;
  for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
  return { total: rows.length, byType };
}
