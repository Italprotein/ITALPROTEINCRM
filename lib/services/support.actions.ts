"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireInternal } from "@/lib/backend/session";
import type { SupportRequest, SupportStatus } from "@/lib/types";
import {
  supportToDTO,
  supportWriteData,
  conversationCreateData,
} from "./support.mapper";

// External users see only their own company's support requests; internal see all.
async function scopeWhere(): Promise<Prisma.SupportRequestWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

export async function listSupportRequests(): Promise<SupportRequest[]> {
  // Communications inbox; scopeWhere() filters external callers to their company.
  await requireUser();
  const rows = await prisma.supportRequest.findMany({
    where: await scopeWhere(),
    include: { messages: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(supportToDTO);
}

export async function getSupportRequest(id: string): Promise<SupportRequest | undefined> {
  await requireUser();
  const rows = await prisma.supportRequest.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include: { messages: true },
    take: 1,
  });
  return rows[0] ? supportToDTO(rows[0]) : undefined;
}

export async function createSupportRequest(input: SupportRequest): Promise<SupportRequest> {
  // Portal-originated write: clients raise tickets from /portal/requests.
  const user = await requireUser();
  const row = await prisma.supportRequest.create({
    data: {
      ...supportWriteData(input, user.id),
      id: input.id,
      createdById: user.id,
      messages: { create: conversationCreateData(input) },
    },
    include: { messages: true },
  });
  return supportToDTO(row);
}

export async function updateSupportRequest(
  id: string,
  patch: Partial<SupportRequest>,
): Promise<SupportRequest | undefined> {
  // Both sides of the conversation write here: the client replies from
  // /portal/requests and staff reply from /admin/communications. Keep it at the
  // authenticated bar — an internal-only guard would break client replies.
  const user = await requireUser();
  const existing = await prisma.supportRequest.findUnique({
    where: { id },
    include: { messages: true },
  });
  if (!existing) return undefined;
  const merged: SupportRequest = { ...supportToDTO(existing), ...patch };
  // The conversation has no stable per-message id in the DTO, so replace the set
  // when the caller supplies a new conversation; otherwise leave it untouched.
  const replaceConversation = patch.conversation !== undefined;
  const row = await prisma.supportRequest.update({
    where: { id },
    data: {
      ...supportWriteData(merged, user.id),
      ...(replaceConversation
        ? { messages: { deleteMany: {}, create: conversationCreateData(merged) } }
        : {}),
    },
    include: { messages: true },
  });
  return supportToDTO(row);
}

export async function removeSupportRequest(id: string): Promise<void> {
  // Deletes by raw id with no company scope; `requests` is a portal-only section
  // (hidden for every internal role) so a section guard would lock staff out.
  await requireInternal();
  await prisma.supportRequest.delete({ where: { id } }).catch(() => undefined);
}

export async function supportRequestsByCompany(companyId: string): Promise<SupportRequest[]> {
  // Portal requests list + portal dashboard.
  await requireUser();
  const rows = await prisma.supportRequest.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include: { messages: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(supportToDTO);
}

export async function supportStatistics() {
  // Shared counts widget — authenticated bar (scoped by scopeWhere).
  await requireUser();
  const rows = await prisma.supportRequest.findMany({
    where: await scopeWhere(),
    select: { status: true },
  });
  const byStatus = {} as Record<SupportStatus, number>;
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  return {
    total: rows.length,
    byStatus,
    open: rows.filter((r) => r.status === "open" || r.status === "in_progress").length,
    waitingOnClient: rows.filter((r) => r.status === "waiting_on_client").length,
  };
}
