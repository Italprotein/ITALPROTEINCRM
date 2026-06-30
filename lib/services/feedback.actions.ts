"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import type { Feedback, FeedbackResult, FeedbackStatus } from "@/lib/types";
import {
  feedbackToDTO,
  feedbackWriteData,
  commentCreateData,
} from "./feedback.mapper";

// External users see only their own company's feedback; internal users see all.
async function scopeWhere(): Promise<Prisma.FeedbackWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

const withComments = { comments: { orderBy: { at: "asc" as const } } };

/**
 * Stub for the not-yet-integrated technical-reply email. The reply text and
 * status change are already persisted by the caller; this only logs intent.
 */
function maybeSendTechnicalReplyEmail(feedback: Feedback): void {
  if (feedback.status === "technical_reply_sent") {
    // TODO: integrate transactional email — notify the contact that a technical
    // reply was sent for this feedback (feedback.reference, feedback.contactId).
  }
}

export async function listFeedback(): Promise<Feedback[]> {
  const rows = await prisma.feedback.findMany({
    where: await scopeWhere(),
    include: withComments,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(feedbackToDTO);
}

export async function getFeedback(id: string): Promise<Feedback | undefined> {
  const rows = await prisma.feedback.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include: withComments,
    take: 1,
  });
  return rows[0] ? feedbackToDTO(rows[0]) : undefined;
}

export async function createFeedback(input: Feedback): Promise<Feedback> {
  const user = await getCurrentUser();
  const actorId = user?.id ?? null;
  const row = await prisma.feedback.create({
    data: {
      ...feedbackWriteData(input, actorId),
      id: input.id,
      createdById: actorId,
      comments: { create: commentCreateData(input.comments ?? [], actorId) },
    },
    include: withComments,
  });
  const dto = feedbackToDTO(row);
  maybeSendTechnicalReplyEmail(dto);
  return dto;
}

export async function updateFeedback(
  id: string,
  patch: Partial<Feedback>,
): Promise<Feedback | undefined> {
  const user = await getCurrentUser();
  const actorId = user?.id ?? null;
  const existing = await prisma.feedback.findUnique({
    where: { id },
    include: withComments,
  });
  if (!existing) return undefined;
  const merged: Feedback = { ...feedbackToDTO(existing), ...patch };

  // Comments are a 1-to-many relation; replace the set so the DTO array is the
  // source of truth (mirrors the mock's whole-object update semantics).
  const row = await prisma.$transaction(async (tx) => {
    await tx.feedbackComment.deleteMany({ where: { feedbackId: id } });
    return tx.feedback.update({
      where: { id },
      data: {
        ...feedbackWriteData(merged, actorId),
        comments: { create: commentCreateData(merged.comments ?? [], actorId) },
      },
      include: withComments,
    });
  });
  const dto = feedbackToDTO(row);
  maybeSendTechnicalReplyEmail(dto);
  return dto;
}

export async function removeFeedback(id: string): Promise<void> {
  await prisma.feedback.delete({ where: { id } }).catch(() => undefined);
}

export async function feedbackByCompany(companyId: string): Promise<Feedback[]> {
  const rows = await prisma.feedback.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include: withComments,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(feedbackToDTO);
}

export async function feedbackBySample(sampleRequestId: string): Promise<Feedback[]> {
  const rows = await prisma.feedback.findMany({
    where: { AND: [await scopeWhere(), { sampleRequestId }] },
    include: withComments,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(feedbackToDTO);
}

export async function feedbackStatistics() {
  const rows = await prisma.feedback.findMany({
    where: await scopeWhere(),
    select: { status: true, overallResult: true, overallRating: true },
  });
  const byStatus = {} as Record<FeedbackStatus, number>;
  const byResult = {} as Record<FeedbackResult, number>;
  for (const f of rows) {
    byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    if (f.overallResult) byResult[f.overallResult] = (byResult[f.overallResult] ?? 0) + 1;
  }
  const rated = rows.filter((f) => typeof f.overallRating === "number");
  const avgRating = rated.length
    ? Math.round((rated.reduce((s, f) => s + (f.overallRating ?? 0), 0) / rated.length) * 10) / 10
    : 0;
  return {
    total: rows.length,
    byStatus,
    byResult,
    avgRating,
    open: rows.filter((f) => f.status !== "resolved").length,
    positive: rows.filter((f) => f.overallResult === "positive").length,
  };
}
