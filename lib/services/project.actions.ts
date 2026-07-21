"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireSectionEdit } from "@/lib/backend/session";
import type { ApplicationProject, DevelopmentStage } from "@/lib/types";
import { projectToDTO, projectWriteData } from "./project.mapper";

// ApplicationProject is portal-visible to the owning company only: external
// users see only their own company's projects; internal users see all. The
// server is the authority — client-supplied ids are ignored.
async function scopeWhere(): Promise<Prisma.ApplicationProjectWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

export async function listProjects(): Promise<ApplicationProject[]> {
  await requireUser();
  const rows = await prisma.applicationProject.findMany({
    where: await scopeWhere(),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(projectToDTO);
}

export async function getProject(id: string): Promise<ApplicationProject | undefined> {
  await requireUser();
  const rows = await prisma.applicationProject.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    take: 1,
  });
  return rows[0] ? projectToDTO(rows[0]) : undefined;
}

// `projects` exists in BOTH section unions, so section-edit resolves per
// workspace: internal business_dev/rnd/admins, and portal company_owner /
// company_technical (who own application projects and upload results).
export async function createProject(input: ApplicationProject): Promise<ApplicationProject> {
  const user = await requireSectionEdit("projects");
  const row = await prisma.applicationProject.create({
    data: { ...projectWriteData(input, user.id), id: input.id, createdById: user.id },
  });
  return projectToDTO(row);
}

export async function updateProject(
  id: string,
  patch: Partial<ApplicationProject>,
): Promise<ApplicationProject | undefined> {
  const user = await requireSectionEdit("projects");
  const existing = await prisma.applicationProject.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: ApplicationProject = { ...projectToDTO(existing), ...patch };
  const row = await prisma.applicationProject.update({
    where: { id },
    data: projectWriteData(merged, user.id),
  });
  return projectToDTO(row);
}

export async function removeProject(id: string): Promise<void> {
  await requireSectionEdit("projects");
  await prisma.applicationProject.delete({ where: { id } }).catch(() => undefined);
}

export async function projectsByCompany(companyId: string): Promise<ApplicationProject[]> {
  await requireUser();
  const rows = await prisma.applicationProject.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(projectToDTO);
}

export async function projectStatistics() {
  await requireUser();
  const rows = await prisma.applicationProject.findMany({
    where: await scopeWhere(),
    select: { developmentStage: true },
  });
  const byStage = {} as Record<DevelopmentStage, number>;
  for (const r of rows) byStage[r.developmentStage] = (byStage[r.developmentStage] ?? 0) + 1;
  return {
    total: rows.length,
    byStage,
    active: rows.filter((r) => !["launched", "on_hold"].includes(r.developmentStage)).length,
    launched: rows.filter((r) => r.developmentStage === "launched").length,
  };
}
