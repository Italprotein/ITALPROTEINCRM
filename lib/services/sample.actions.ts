"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireSectionEdit } from "@/lib/backend/session";
import type { SampleRequest, SampleStatus } from "@/lib/types";
import { sampleToDTO, sampleWriteData } from "./sample.mapper";

// External users see only their own company's sample requests; internal see all.
async function scopeWhere(): Promise<Prisma.SampleRequestWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

export async function listSamples(): Promise<SampleRequest[]> {
  await requireUser();
  const rows = await prisma.sampleRequest.findMany({
    where: await scopeWhere(),
    orderBy: { requestDate: "desc" },
  });
  return rows.map(sampleToDTO);
}

export async function getSample(id: string): Promise<SampleRequest | undefined> {
  await requireUser();
  const rows = await prisma.sampleRequest.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    take: 1,
  });
  return rows[0] ? sampleToDTO(rows[0]) : undefined;
}

// Dual-audience: internal staff raise sample requests AND portal clients do
// (portal/samples/new). Gated on edit rights over the `samples` section, which
// resolves per workspace — so client_owner/member/technical/logistics keep
// working while view-only roles (finance, management_readonly) are refused.
export async function createSample(input: SampleRequest): Promise<SampleRequest> {
  const user = await requireSectionEdit("samples");
  const row = await prisma.sampleRequest.create({
    data: { ...sampleWriteData(input, user.id), id: input.id, createdById: user.id },
  });
  return sampleToDTO(row);
}

export async function updateSample(
  id: string,
  patch: Partial<SampleRequest>,
): Promise<SampleRequest | undefined> {
  // NOT `sample.status_update` / `sample.approve`: no external role holds those
  // actions, and the portal calls this to confirm receipt/delivery. Section
  // edit keeps both workspaces working.
  const user = await requireSectionEdit("samples");
  const existing = await prisma.sampleRequest.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: SampleRequest = { ...sampleToDTO(existing), ...patch };
  const row = await prisma.sampleRequest.update({
    where: { id },
    data: sampleWriteData(merged, user.id),
  });
  return sampleToDTO(row);
}

export async function removeSample(id: string): Promise<void> {
  await requireSectionEdit("samples");
  await prisma.sampleRequest.delete({ where: { id } }).catch(() => undefined);
}

export async function samplesByCompany(companyId: string): Promise<SampleRequest[]> {
  await requireUser();
  const rows = await prisma.sampleRequest.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    orderBy: { requestDate: "desc" },
  });
  return rows.map(sampleToDTO);
}

export async function samplesByStatus(status: SampleStatus): Promise<SampleRequest[]> {
  await requireUser();
  const rows = await prisma.sampleRequest.findMany({
    where: { AND: [await scopeWhere(), { status }] },
    orderBy: { requestDate: "desc" },
  });
  return rows.map(sampleToDTO);
}

export async function sampleStatistics() {
  await requireUser();
  const rows = await prisma.sampleRequest.findMany({
    where: await scopeWhere(),
    select: { status: true },
  });
  const byStatus = {} as Record<SampleStatus, number>;
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  const inSet = (...st: SampleStatus[]) => rows.filter((r) => st.includes(r.status)).length;
  return {
    total: rows.length,
    byStatus,
    pendingApproval: inSet("submitted", "under_review", "more_info_required"),
    preparing: inSet("approved", "preparing", "ready_to_ship"),
    shipped: inSet("shipped", "in_transit", "customs_hold", "delivery_attempted"),
    awaitingFeedback: inSet("delivered", "receipt_confirmed", "testing", "feedback_requested"),
    feedbackReceived: inSet("feedback_received", "closed"),
  };
}
