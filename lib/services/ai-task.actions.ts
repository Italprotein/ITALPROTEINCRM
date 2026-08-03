"use server";

import { headers } from "next/headers";

import { classifyAiFailure } from "@/lib/ai/ai-failure";
import { generatePersonalizedReply, generateTaskCandidates, isCrmTaskAiConfigured } from "@/lib/ai/crm-task-ai";
import { getAiProviderName } from "@/lib/ai/provider";
import { getBackendEnv } from "@/lib/backend/env";
import {
  buildRawEmail,
  createRawDraft,
  getGmailAuth,
  getMessage,
  GmailError,
  headerValue,
} from "@/lib/backend/gmail";
import { runGmailSync } from "@/lib/backend/gmail-sync";
import { prisma } from "@/lib/backend/prisma";
import { checkRateLimit, clientIpFromHeaders, peekRateLimit } from "@/lib/backend/rate-limit";
import { requireSection, requireSectionEdit } from "@/lib/backend/session";
import type { Task } from "@/lib/types";
import { taskToDTO } from "./task.mapper";

type AiTaskError =
  | "openai_not_configured"
  | "gmail_not_connected"
  | "gmail_reconnect_required"
  | "rate_limited"
  /** The AI provider's own allowance is spent (Groq's free plan caps per day). */
  | "ai_quota_exhausted"
  /** The AI provider is unreachable or erroring. */
  | "ai_provider_unavailable"
  /** The provider replied but the output was empty or off-schema. */
  | "ai_invalid_output"
  | "source_not_found"
  | "forbidden"
  | "generation_failed"
  | "draft_failed";

export type GenerateAiTasksResult =
  | { ok: true; tasks: Task[]; consideredEmails: number }
  | { ok: false; error: AiTaskError; retryAfterSeconds?: number };

export type CreateAiDraftResult =
  | { ok: true; draftId: string; gmailUrl: string }
  | { ok: false; error: AiTaskError };

const TASK_INCLUDE = {
  collaborators: true,
  comments: { orderBy: { createdAt: "asc" as const } },
};

function dateOnly(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dueDate(candidate: string, today: string): Date {
  const safe = candidate < today ? today : candidate;
  return new Date(`${safe}T12:00:00.000Z`);
}

/** One inbox pass per member per day. The window key is shared with the UI hint. */
const DAILY_TASKS_LIMIT_KEY = (userId: string) => `ai-tasks-daily:${userId}`;
const DAILY_TASKS_WINDOW_SECONDS = 24 * 60 * 60;

const TASK_NOTE_LABELS = {
  en: { source: "Source email", evidence: "AI evidence" },
  it: { source: "Email di origine", evidence: "Evidenza AI" },
} as const;

/** Sync the shared inbox, identify today's unfinished actions, and persist them as tasks. */
export async function generateAiTasksFromInbox(
  locale: "en" | "it",
): Promise<GenerateAiTasksResult> {
  const user = await requireSectionEdit("tasks");
  await requireSection("communications");
  if (!isCrmTaskAiConfigured()) return { ok: false, error: "openai_not_configured" };

  // Peek only: the daily slot is consumed after a SUCCESSFUL run (below), so a
  // provider outage or an empty inbox never burns the member's one pass a day.
  const daily = await peekRateLimit(DAILY_TASKS_LIMIT_KEY(user.id), 1, DAILY_TASKS_WINDOW_SECONDS);
  if (!daily.ok) {
    return { ok: false, error: "rate_limited", retryAfterSeconds: daily.retryAfterSeconds };
  }

  // Best effort: stored mail remains usable if Google is temporarily unavailable.
  await runGmailSync({ maxMessages: 100 }).catch(() => undefined);

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const inbound = await prisma.emailMessage.findMany({
    where: {
      direction: "inbound",
      matchedAdminUserId: user.id,
      internalDate: { gte: since },
      bodyText: { not: null },
    },
    orderBy: { internalDate: "desc" },
    take: 80,
    select: {
      id: true,
      gmailThreadId: true,
      fromAddress: true,
      fromName: true,
      subject: true,
      bodyText: true,
      internalDate: true,
      companyId: true,
      lead: { select: { companyName: true } },
    },
  });

  const existing = inbound.length
    ? await prisma.task.findMany({
        where: {
          relatedType: "email_message",
          relatedId: { in: inbound.map((email) => email.id) },
          status: { notIn: ["done", "cancelled"] },
        },
        select: { title: true, relatedId: true },
      })
    : [];
  const alreadyTracked = new Set(existing.map((task) => task.relatedId).filter(Boolean));
  const freeTierMode = getAiProviderName() === "groq";
  // One email per Gmail thread (the newest — the list is already sorted desc):
  // older messages in the same conversation restate the same pending action and
  // would only spend the token budget on duplicates.
  const seenThreads = new Set<string>();
  const latestPerThread = inbound.filter((email) => {
    if (seenThreads.has(email.gmailThreadId)) return false;
    seenThreads.add(email.gmailThreadId);
    return true;
  });
  // Groq's free plan has a small per-minute token allowance; eight trimmed
  // messages stay inside it while covering the day's distinct conversations.
  const available = latestPerThread
    .filter((email) => !alreadyTracked.has(email.id))
    .slice(0, freeTierMode ? 8 : 60);
  if (!available.length) return { ok: true, tasks: [], consideredEmails: 0 };

  try {
    const today = dateOnly(new Date());
    const candidates = await generateTaskCandidates({
      locale: locale === "it" ? "it" : "en",
      today,
      memberName: user.name ?? user.email ?? "Italprotein team member",
      existingTasks: existing,
      emails: available.map((email) => ({
        id: email.id,
        receivedAt: email.internalDate.toISOString(),
        from: email.fromAddress,
        fromName: email.fromName,
        subject: email.subject,
        companyName: email.lead?.companyName,
        body: (email.bodyText ?? "").slice(0, freeTierMode ? 2_200 : 6_000),
      })),
    });

    const byId = new Map(available.map((email) => [email.id, email]));
    const unique = new Map(
      candidates
        .filter((candidate) => byId.has(candidate.sourceEmailId))
        .map((candidate) => [candidate.sourceEmailId, candidate]),
    );

    const leadNames = [
      ...new Set(
        available
          .map((email) => email.lead?.companyName?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const companies = leadNames.length
      ? await prisma.company.findMany({
          where: {
            OR: leadNames.flatMap((name) => [
              { legalName: { equals: name, mode: "insensitive" as const } },
              { tradingName: { equals: name, mode: "insensitive" as const } },
            ]),
          },
          select: { id: true, legalName: true, tradingName: true },
        })
      : [];
    const companyByName = new Map<string, string>();
    for (const company of companies) {
      companyByName.set(company.legalName.toLocaleLowerCase(), company.id);
      if (company.tradingName) companyByName.set(company.tradingName.toLocaleLowerCase(), company.id);
    }

    const created: Task[] = [];
    for (const candidate of unique.values()) {
      const source = byId.get(candidate.sourceEmailId)!;
      const inferredCompanyId = source.lead?.companyName
        ? companyByName.get(source.lead.companyName.toLocaleLowerCase())
        : undefined;
      const sourceLabel = `${source.subject ?? "(no subject)"} — ${source.fromName ?? source.fromAddress}`;
      const noteLabels = TASK_NOTE_LABELS[locale === "it" ? "it" : "en"];
      const row = await prisma.task.create({
        data: {
          title: candidate.title,
          description: `${candidate.description}\n\n${noteLabels.source}: ${sourceLabel}\n${noteLabels.evidence}: ${candidate.reason}`.slice(0, 2_500),
          type: candidate.type,
          priority: candidate.priority,
          source: "system",
          status: "open",
          companyId: source.companyId ?? inferredCompanyId,
          relatedType: "email_message",
          relatedId: source.id,
          ownerUserId: user.id,
          dueDate: dueDate(candidate.dueDate, today),
          reminderDate: dueDate(candidate.dueDate, today),
          createdById: user.id,
          updatedById: user.id,
        },
        include: TASK_INCLUDE,
      });
      created.push(taskToDTO(row));
    }

    // The model pass ran and its output is persisted — now spend today's slot.
    await checkRateLimit(DAILY_TASKS_LIMIT_KEY(user.id), 1, DAILY_TASKS_WINDOW_SECONDS);

    await prisma.auditEvent
      .create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "task.ai_generated",
          entityType: "task",
          summary: `AI created ${created.length} task(s) from ${available.length} assigned inbox message(s)`,
        },
      })
      .catch(() => undefined);

    return { ok: true, tasks: created, consideredEmails: available.length };
  } catch (error) {
    // Never swallow this. A spent provider quota, an outage, a rejected key and
    // unusable model output need four different answers from the UI — collapsing
    // them into one code is what made Amina blame the Gmail connection when the
    // connection was fine.
    const failure = classifyAiFailure(error);
    console.error(
      `[ai-tasks] generation failed for ${user.id} (${failure.kind}): ${failure.detail}`,
    );
    switch (failure.kind) {
      case "quota_exhausted":
        return {
          ok: false,
          error: "ai_quota_exhausted",
          retryAfterSeconds: failure.retryAfterSeconds,
        };
      case "provider_refused":
        return { ok: false, error: "openai_not_configured" };
      case "invalid_output":
        return { ok: false, error: "ai_invalid_output" };
      default:
        return { ok: false, error: "ai_provider_unavailable" };
    }
  }
}

function replySubject(subject: string | null): string {
  const clean = (subject ?? "").trim() || "Italprotein follow-up";
  return /^re:/i.test(clean) ? clean : `Re: ${clean}`;
}

/** Generate a personalized reply and save it in Gmail Drafts for human review. */
export async function createAiReplyDraft(
  taskId: string,
  locale: "en" | "it",
): Promise<CreateAiDraftResult> {
  const user = await requireSectionEdit("tasks");
  await requireSectionEdit("communications");
  if (!isCrmTaskAiConfigured()) return { ok: false, error: "openai_not_configured" };

  const limit = await checkRateLimit(`ai-draft:${user.id}`, 20, 60 * 60);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || task.relatedType !== "email_message" || !task.relatedId) {
    return { ok: false, error: "source_not_found" };
  }
  if (task.ownerUserId !== user.id && !["super_admin", "crm_admin"].includes(user.role)) {
    return { ok: false, error: "forbidden" };
  }

  const source = await prisma.emailMessage.findUnique({ where: { id: task.relatedId } });
  if (!source || source.direction !== "inbound") return { ok: false, error: "source_not_found" };

  const auth = await getGmailAuth();
  if (!auth) return { ok: false, error: "gmail_not_connected" };

  const thread = await prisma.emailMessage.findMany({
    where: { gmailThreadId: source.gmailThreadId },
    orderBy: { internalDate: "asc" },
    take: 12,
    select: { direction: true, internalDate: true, fromAddress: true, bodyText: true },
  });

  try {
    const body = await generatePersonalizedReply({
      locale: locale === "it" ? "it" : "en",
      memberName: user.name ?? "Italprotein team",
      recipientName: source.fromName,
      subject: source.subject ?? "",
      taskTitle: task.title,
      taskDescription: task.description,
      thread: thread.map((message) => ({
        direction: message.direction,
        at: message.internalDate.toISOString(),
        from: message.fromAddress,
        body: (message.bodyText ?? "").slice(0, 4_000),
      })),
    });

    const original = await getMessage(auth, source.gmailMessageId);
    const rfcMessageId = headerValue(original, "Message-ID");
    const env = getBackendEnv();
    const raw = buildRawEmail({
      from: auth.email,
      fromName: user.name ? `${user.name} — Italprotein` : "Italprotein",
      replyTo: env.gmail.replyTo,
      to: [source.fromAddress],
      subject: replySubject(source.subject),
      text: body,
      inReplyTo: rfcMessageId,
      references: rfcMessageId,
    });
    const draft = await createRawDraft(auth, raw, source.gmailThreadId);

    await prisma.$transaction([
      prisma.task.update({
        where: { id: task.id },
        data: { status: task.status === "open" ? "in_progress" : task.status, updatedById: user.id },
      }),
      prisma.taskComment.create({
        data: {
          taskId: task.id,
          authorUserId: user.id,
          body: `AI reply saved to Gmail Drafts (${draft.id}). Review before sending.`,
          createdById: user.id,
        },
      }),
      prisma.auditEvent.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "gmail.ai_draft_created",
          entityType: "task",
          entityId: task.id,
          summary: "AI-generated Gmail draft created for review",
          ip: clientIpFromHeaders(await headers()),
        },
      }),
    ]);

    return {
      ok: true,
      draftId: draft.id,
      gmailUrl: "https://mail.google.com/mail/u/0/#drafts",
    };
  } catch (error) {
    if (error instanceof GmailError && (error.status === 401 || error.status === 403)) {
      return { ok: false, error: "gmail_reconnect_required" };
    }
    return { ok: false, error: "draft_failed" };
  }
}
