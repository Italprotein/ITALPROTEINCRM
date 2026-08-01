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
  // The reference is SERVER-minted — a client-computed sequence collides the
  // moment two companies both send their first message. Retry on the unique
  // constraint instead of pre-checking (pre-checks race under concurrency).
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const reference =
      attempt < 5
        ? `REQ-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`
        : `REQ-${year}-${Date.now().toString(36).toUpperCase()}`;
    try {
      const row = await prisma.supportRequest.create({
        data: {
          ...supportWriteData({ ...input, reference }, user.id),
          id: input.id,
          createdById: user.id,
          messages: { create: conversationCreateData(input) },
        },
        include: { messages: true },
      });
      return supportToDTO(row);
    } catch (error) {
      const uniqueCollision =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!uniqueCollision) throw error;
    }
  }
  throw new Error("SUPPORT_REFERENCE_EXHAUSTED");
}

export async function updateSupportRequest(
  id: string,
  patch: Partial<SupportRequest>,
): Promise<SupportRequest | undefined> {
  // Both sides of the conversation write here: the client replies from
  // /portal/requests and staff reply from /admin/communications. Keep it at the
  // authenticated bar — an internal-only guard would break client replies.
  const user = await requireUser();
  // Scope the target: scopeWhere() limits an external client to their OWN
  // company's threads; internal staff reach any. Without this, a portal user who
  // guessed a thread id could append messages to another company's conversation
  // (IDOR). Missing/foreign id -> undefined.
  const existing = await prisma.supportRequest.findFirst({
    where: { AND: [await scopeWhere(), { id }] },
    include: { messages: true },
  });
  if (!existing) return undefined;
  const merged: SupportRequest = { ...supportToDTO(existing), ...patch };
  // Append-only conversation sync. A reply from either side (client at
  // /portal/requests, staff at /admin/communications) arrives as the caller's
  // snapshot of the thread plus their new message(s). We must NEVER delete
  // existing rows: the other party may have posted since this caller loaded the
  // thread, and a deleteMany+recreate would silently drop that message. Instead
  // we create only the messages we don't already have, matched on timestamp.
  const seen = new Set(existing.messages.map((m) => m.createdAt.toISOString()));
  const toAppend =
    patch.conversation !== undefined
      ? conversationCreateData({
          ...merged,
          conversation: merged.conversation.filter((m) => !seen.has(m.at)),
        })
      : [];
  const row = await prisma.supportRequest.update({
    where: { id },
    data: {
      ...supportWriteData(merged, user.id),
      ...(toAppend.length ? { messages: { create: toAppend } } : {}),
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
