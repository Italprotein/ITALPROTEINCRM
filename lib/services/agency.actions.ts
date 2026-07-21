"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser } from "@/lib/backend/session";
import type { Agency } from "@/lib/mock-services/agencyService";
import { agencyToDTO } from "./agency.mapper";

// Agencies are Company records of type agency|distributor carrying the "partner"
// tag (the partner-network records, distinct from pipeline companies). The schema
// has no separate agency table, so we query companies filtered to that shape.
// Standard company scoping applies: external users see only their own company;
// internal users see all. The server is the authority.
const PARTNER_TYPES: Prisma.CompanyWhereInput = {
  type: { in: ["agency", "distributor"] },
  tags: { has: "partner" },
};

async function scopeWhere(): Promise<Prisma.CompanyWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { id: user.companyId ?? "__no_company__" };
  return {};
}

export async function listAgencies(): Promise<Agency[]> {
  // Authenticated-only rather than requireSection('agencies'): that section is
  // hidden for external roles, and scopeWhere() below deliberately supports an
  // external partner reading its own record. Section-gating would make that
  // branch dead code and change existing scoping behaviour.
  await requireUser();
  const where: Prisma.CompanyWhereInput = { AND: [await scopeWhere(), PARTNER_TYPES] };
  const rows = await prisma.company.findMany({ where, orderBy: { legalName: "asc" } });
  return rows.map(agencyToDTO);
}

export async function getAgency(id: string): Promise<Agency | undefined> {
  await requireUser();
  const rows = await prisma.company.findMany({
    where: { AND: [await scopeWhere(), PARTNER_TYPES, { id }] },
    take: 1,
  });
  return rows[0] ? agencyToDTO(rows[0]) : undefined;
}

export async function agencyStatistics(): Promise<{
  total: number;
  active: number;
  totalCompaniesIntroduced: number;
  totalLeads: number;
  avgConversionRate: number;
}> {
  await requireUser();
  const all = await listAgencies();
  const active = all.filter((a) => a.meta.agreementStatus === "active").length;
  const totalCompaniesIntroduced = all.reduce(
    (s, a) => s + a.meta.companiesIntroducedIds.length,
    0,
  );
  const totalLeads = all.reduce((s, a) => s + a.meta.activeLeads, 0);
  const avgConversionRate = all.length
    ? Math.round((all.reduce((s, a) => s + a.meta.conversionRate, 0) / all.length) * 100)
    : 0;
  return { total: all.length, active, totalCompaniesIntroduced, totalLeads, avgConversionRate };
}
