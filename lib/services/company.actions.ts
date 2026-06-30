"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import type { Company } from "@/lib/types";
import type { CompanyQuery } from "@/lib/mock-services/companyService";
import { companyToDTO, companyWriteData } from "./company.mapper";

// Server-side company scope: external users see only their own company; internal
// users see all. The server is the authority — client-supplied ids are ignored.
async function scopeWhere(): Promise<Prisma.CompanyWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { id: user.companyId ?? "__no_company__" };
  return {};
}

function queryWhere(q: CompanyQuery): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = {};
  if (q.search) {
    where.OR = [
      { legalName: { contains: q.search, mode: "insensitive" } },
      { tradingName: { contains: q.search, mode: "insensitive" } },
      { city: { contains: q.search, mode: "insensitive" } },
      { country: { contains: q.search, mode: "insensitive" } },
      { tags: { has: q.search } },
    ];
  }
  if (q.types?.length) where.type = { in: q.types };
  if (q.countries?.length) where.country = { in: q.countries };
  if (q.stages?.length) where.relationshipStage = { in: q.stages };
  if (q.ownerId) where.ownerUserId = q.ownerId;
  if (q.ndaStatuses?.length) where.ndaStatus = { in: q.ndaStatuses };
  if (q.priorities?.length) where.priority = { in: q.priorities };
  if (q.tag) where.tags = { has: q.tag };
  return where;
}

export async function listCompanies(query: CompanyQuery = {}): Promise<Company[]> {
  const where: Prisma.CompanyWhereInput = { AND: [await scopeWhere(), queryWhere(query)] };
  const rows = await prisma.company.findMany({ where, orderBy: { legalName: "asc" } });
  return rows.map(companyToDTO);
}

export async function getCompany(id: string): Promise<Company | undefined> {
  const rows = await prisma.company.findMany({ where: { AND: [await scopeWhere(), { id }] }, take: 1 });
  return rows[0] ? companyToDTO(rows[0]) : undefined;
}

export async function createCompany(input: Company): Promise<Company> {
  const user = await getCurrentUser();
  const row = await prisma.company.create({
    data: { ...companyWriteData(input, user?.id ?? null), id: input.id, createdById: user?.id ?? null },
  });
  return companyToDTO(row);
}

export async function updateCompany(id: string, patch: Partial<Company>): Promise<Company | undefined> {
  const user = await getCurrentUser();
  const existing = await prisma.company.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: Company = { ...companyToDTO(existing), ...patch };
  const row = await prisma.company.update({ where: { id }, data: companyWriteData(merged, user?.id ?? null) });
  return companyToDTO(row);
}

export async function removeCompany(id: string): Promise<void> {
  await prisma.company.delete({ where: { id } }).catch(() => undefined);
}

export async function countCompanies(): Promise<number> {
  return prisma.company.count({ where: await scopeWhere() });
}

export async function companiesByCountry(): Promise<
  { country: string; countryCode: string; count: number }[]
> {
  const rows = await prisma.company.findMany({
    where: await scopeWhere(),
    select: { country: true, countryCode: true },
  });
  const map = new Map<string, { country: string; countryCode: string; count: number }>();
  for (const r of rows) {
    const e = map.get(r.country) ?? { country: r.country, countryCode: r.countryCode, count: 0 };
    e.count++;
    map.set(r.country, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export async function companiesByType(): Promise<{ type: Company["type"]; count: number }[]> {
  const grouped = await prisma.company.groupBy({
    by: ["type"],
    where: await scopeWhere(),
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({ type: g.type as Company["type"], count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function companyStatistics() {
  const rows = await prisma.company.findMany({
    where: await scopeWhere(),
    select: {
      relationshipStage: true,
      ndaStatus: true,
      priority: true,
      opportunityValueMinor: true,
      estimatedAnnualPotentialMinor: true,
    },
  });
  const ACTIVE_EXCLUDE = ["lost", "dormant"];
  const byStage = new Map<string, number>();
  for (const r of rows) byStage.set(r.relationshipStage, (byStage.get(r.relationshipStage) ?? 0) + 1);
  return {
    total: rows.length,
    active: rows.filter((r) => !ACTIVE_EXCLUDE.includes(r.relationshipStage)).length,
    customers: rows.filter((r) => ["customer", "repeat_customer"].includes(r.relationshipStage)).length,
    ndaSigned: rows.filter((r) => r.ndaStatus === "fully_signed").length,
    pipelineValue: rows.reduce((s, r) => s + (r.opportunityValueMinor ?? 0) / 100, 0),
    estimatedPotential: rows.reduce((s, r) => s + (r.estimatedAnnualPotentialMinor ?? 0) / 100, 0),
    highPriority: rows.filter((r) => r.priority === "high" || r.priority === "urgent").length,
    byStage: [...byStage.entries()].map(([stage, count]) => ({
      stage: stage as Company["relationshipStage"],
      count,
    })),
  };
}
