"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
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
  const rows = await prisma.supportRequest.findMany({
    where: await scopeWhere(),
    include: { messages: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(supportToDTO);
}

export async function getSupportRequest(id: string): Promise<SupportRequest | undefined> {
  const rows = await prisma.supportRequest.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include: { messages: true },
    take: 1,
  });
  return rows[0] ? supportToDTO(rows[0]) : undefined;
}

export async function createSupportRequest(input: SupportRequest): Promise<SupportRequest> {
  const user = await getCurrentUser();
  const row = await prisma.supportRequest.create({
    data: {
      ...supportWriteData(input, user?.id ?? null),
      id: input.id,
      createdById: user?.id ?? null,
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
  const user = await getCurrentUser();
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
      ...supportWriteData(merged, user?.id ?? null),
      ...(replaceConversation
        ? { messages: { deleteMany: {}, create: conversationCreateData(merged) } }
        : {}),
    },
    include: { messages: true },
  });
  return supportToDTO(row);
}

export async function removeSupportRequest(id: string): Promise<void> {
  await prisma.supportRequest.delete({ where: { id } }).catch(() => undefined);
}

export async function supportRequestsByCompany(companyId: string): Promise<SupportRequest[]> {
  const rows = await prisma.supportRequest.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include: { messages: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(supportToDTO);
}

export async function supportStatistics() {
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
