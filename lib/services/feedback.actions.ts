"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import {
  getCurrentUser,
  requireUser,
  requireInternal,
  requireAction,
  requireSectionEdit,
} from "@/lib/backend/session";
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
  // Shared read (admin list + overview widgets); scopeWhere() does the filtering.
  await requireUser();
  const rows = await prisma.feedback.findMany({
    where: await scopeWhere(),
    include: withComments,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(feedbackToDTO);
}

export async function getFeedback(id: string): Promise<Feedback | undefined> {
  await requireUser();
  const rows = await prisma.feedback.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include: withComments,
    take: 1,
  });
  return rows[0] ? feedbackToDTO(rows[0]) : undefined;
}

export async function createFeedback(input: Feedback): Promise<Feedback> {
  // Portal-originated write (/portal/feedback/new) — authenticated bar. Not
  // gated on 'portal.submit_feedback': internal staff also record feedback and
  // hold no portal actions, and company_logistics/company_finance would lose a
  // surface the portal already offers them.
  const user = await requireUser();
  const actorId = user.id;
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
  // Internal triage / technical reply (admin feedback console). 'feedback.reply'
  // resolves to exactly the roles with edit rights on the feedback section
  // (super_admin, crm_admin, rnd_technical).
  const user = await requireAction("feedback.reply");
  const actorId = user.id;
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
  // `feedback` exists in BOTH the internal and the portal section lists, so the
  // section guard alone would let portal roles delete by raw id (no scope on the
  // delete). Require internal first, then edit rights on the section.
  await requireInternal();
  await requireSectionEdit("feedback");
  await prisma.feedback.delete({ where: { id } }).catch(() => undefined);
}

export async function feedbackByCompany(companyId: string): Promise<Feedback[]> {
  // Portal feedback list — scopeWhere() keeps external users in their company.
  await requireUser();
  const rows = await prisma.feedback.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include: withComments,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(feedbackToDTO);
}

export async function feedbackBySample(sampleRequestId: string): Promise<Feedback[]> {
  // Portal sample detail page reads this.
  await requireUser();
  const rows = await prisma.feedback.findMany({
    where: { AND: [await scopeWhere(), { sampleRequestId }] },
    include: withComments,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(feedbackToDTO);
}

export async function feedbackStatistics() {
  // Shared counts widget — authenticated bar (scoped by scopeWhere).
  await requireUser();
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
