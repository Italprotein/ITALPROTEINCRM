"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireSection, requireSectionEdit } from "@/lib/backend/session";
import { investorStatistics } from "@/lib/investors";
import type { Investor, InvestorStatus } from "@/lib/types";
import { investorToDTO, investorWriteData, type InvestorFormInput } from "./investor.mapper";

// Investor register actions. Not company-scoped: investors live in their own
// table precisely so none of the company machinery (or its scoping) applies.
// Reads are gated on requireSection('investors') — internal roles only; the
// section does not exist for portal roles, so external users are refused.
// Writes are gated on requireSectionEdit('investors') (super_admin, crm_admin,
// business_dev hold edit-or-full).

export type InvestorSaveResult =
  | { ok: true; investor: Investor; created: boolean }
  // Returned, never thrown: Next redacts thrown server-action messages in
  // production, so a business refusal must travel as a result.
  | { ok: false; reason: "duplicate_name" };

export async function listInvestors(): Promise<Investor[]> {
  await requireSection("investors");
  const rows = await prisma.investor.findMany({
    orderBy: [{ lastContactAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
  });
  return rows.map(investorToDTO);
}

export async function getInvestor(id: string): Promise<Investor | undefined> {
  await requireSection("investors");
  const row = await prisma.investor.findUnique({ where: { id } });
  return row ? investorToDTO(row) : undefined;
}

export async function investorStats(): Promise<ReturnType<typeof investorStatistics>> {
  await requireSection("investors");
  const rows = await prisma.investor.findMany({ select: { status: true } });
  return investorStatistics(rows as { status: InvestorStatus }[]);
}

export async function createInvestor(input: InvestorFormInput): Promise<InvestorSaveResult> {
  const user = await requireSectionEdit("investors");
  const data = investorWriteData(input);
  if (!data.name) return { ok: false, reason: "duplicate_name" };
  const existing = await prisma.investor.findUnique({
    where: { name: data.name },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "duplicate_name" };
  try {
    const row = await prisma.investor.create({
      data: { ...data, createdById: user.id, updatedById: user.id },
    });
    return { ok: true, investor: investorToDTO(row), created: true };
  } catch {
    // Concurrent create of the same name between the check and the insert.
    return { ok: false, reason: "duplicate_name" };
  }
}

export async function updateInvestor(
  id: string,
  input: InvestorFormInput,
): Promise<InvestorSaveResult | undefined> {
  const user = await requireSectionEdit("investors");
  const existing = await prisma.investor.findUnique({ where: { id } });
  if (!existing) return undefined;
  const data = investorWriteData(input);
  if (!data.name) return { ok: false, reason: "duplicate_name" };
  // Renaming onto another row's name would violate the unique key — refuse
  // with the same result the create path uses.
  const clash = await prisma.investor.findUnique({
    where: { name: data.name },
    select: { id: true },
  });
  if (clash && clash.id !== id) return { ok: false, reason: "duplicate_name" };
  try {
    const row = await prisma.investor.update({
      where: { id },
      data: { ...data, updatedById: user.id },
    });
    return { ok: true, investor: investorToDTO(row), created: false };
  } catch {
    return { ok: false, reason: "duplicate_name" };
  }
}

/** The one destructive direction; the UI puts a named confirmation before it. */
export async function removeInvestor(id: string): Promise<void> {
  await requireSectionEdit("investors");
  await prisma.investor.delete({ where: { id } }).catch(() => undefined);
}
