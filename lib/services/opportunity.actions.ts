"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import type { Opportunity } from "@/lib/types";
import { PIPELINE_STAGES } from "@/lib/types";
import {
  opportunityToDTO,
  opportunityWriteData,
  stageHistoryCreateData,
} from "./opportunity.mapper";

// External users see only their own company's opportunities; internal see all.
// The server is the authority — client-supplied company ids are ignored.
async function scopeWhere(): Promise<Prisma.OpportunityWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

const includeHistory = { stageHistory: true } as const;

export async function listOpportunities(): Promise<Opportunity[]> {
  const rows = await prisma.opportunity.findMany({
    where: await scopeWhere(),
    include: includeHistory,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(opportunityToDTO);
}

export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  const rows = await prisma.opportunity.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include: includeHistory,
    take: 1,
  });
  return rows[0] ? opportunityToDTO(rows[0]) : undefined;
}

export async function createOpportunity(input: Opportunity): Promise<Opportunity> {
  const user = await getCurrentUser();
  const row = await prisma.opportunity.create({
    data: {
      ...opportunityWriteData(input, user?.id ?? null),
      id: input.id,
      createdById: user?.id ?? null,
      stageHistory: { create: stageHistoryCreateData(input.stageHistory ?? []) },
    },
    include: includeHistory,
  });
  return opportunityToDTO(row);
}

export async function updateOpportunity(
  id: string,
  patch: Partial<Opportunity>,
): Promise<Opportunity | undefined> {
  const user = await getCurrentUser();
  const existing = await prisma.opportunity.findUnique({
    where: { id },
    include: includeHistory,
  });
  if (!existing) return undefined;
  const merged: Opportunity = { ...opportunityToDTO(existing), ...patch };
  // stageHistory is a relation; rewrite it wholesale to mirror the merged DTO.
  const row = await prisma.opportunity.update({
    where: { id },
    data: {
      ...opportunityWriteData(merged, user?.id ?? null),
      stageHistory: {
        deleteMany: {},
        create: stageHistoryCreateData(merged.stageHistory ?? []),
      },
    },
    include: includeHistory,
  });
  return opportunityToDTO(row);
}

export async function removeOpportunity(id: string): Promise<void> {
  await prisma.opportunityStageHistory.deleteMany({ where: { opportunityId: id } }).catch(() => undefined);
  await prisma.opportunity.delete({ where: { id } }).catch(() => undefined);
}

export async function opportunitiesByCompany(companyId: string): Promise<Opportunity[]> {
  const rows = await prisma.opportunity.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include: includeHistory,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(opportunityToDTO);
}

export async function opportunitiesByStage(): Promise<Record<string, Opportunity[]>> {
  const rows = await prisma.opportunity.findMany({
    where: await scopeWhere(),
    include: includeHistory,
    orderBy: { createdAt: "desc" },
  });
  const map: Record<string, Opportunity[]> = {};
  for (const stage of PIPELINE_STAGES) map[stage] = [];
  for (const row of rows) {
    const o = opportunityToDTO(row);
    (map[o.stage] ??= []).push(o);
  }
  return map;
}

export async function opportunityStatistics() {
  const rows = await prisma.opportunity.findMany({
    where: await scopeWhere(),
    select: { stage: true, expectedValueMinor: true, probability: true },
  });
  const WON = ["customer", "repeat_customer"];
  const LOST = ["lost", "disqualified"];
  const OPEN = new Set<string>(PIPELINE_STAGES);
  const value = (m: number | null) => (m ?? 0) / 100;
  const open = rows.filter((o) => OPEN.has(o.stage) && !WON.includes(o.stage));
  const won = rows.filter((o) => WON.includes(o.stage));
  const lost = rows.filter((o) => LOST.includes(o.stage));
  const totalValue = rows.reduce((s, o) => s + value(o.expectedValueMinor), 0);
  const weightedValue = rows.reduce(
    (s, o) => s + value(o.expectedValueMinor) * ((o.probability ?? 0) / 100),
    0,
  );
  const byStage = PIPELINE_STAGES.map((stage) => {
    const items = rows.filter((o) => o.stage === stage);
    return {
      stage,
      count: items.length,
      value: items.reduce((s, o) => s + value(o.expectedValueMinor), 0),
    };
  });
  return {
    total: rows.length,
    open: open.length,
    won: won.length,
    lost: lost.length,
    totalValue,
    weightedValue,
    byStage,
  };
}
