import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/backend/prisma';
import { getCurrentUser } from '@/lib/backend/session';
import { checkRateLimit, clientIpFromHeaders } from '@/lib/backend/rate-limit';
import { assistantAudienceForRole, type AssistantAudience } from '@/lib/ai/assistant-profile';
import { generateAssistantReply, type AssistantTurn } from '@/lib/ai/assistant-runtime';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/*
 * Amina chat endpoint.
 *
 * The security contract lives here, not in the prompt:
 *   - the audience is derived from the *session*, never from the request body;
 *   - a thread can only be resumed by the identity + audience + company that owns it;
 *   - every turn is persisted and audited.
 *
 * The model call itself is still stubbed — see lib/ai/assistant-runtime.ts.
 */

const BodySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  threadId: z.string().trim().min(1).max(64).optional(),
  locale: z.enum(['en', 'it']).default('en'),
});

/** How many turns of history we replay. Bounds both the prompt and the query. */
const HISTORY_LIMIT = 20;

/**
 * The public (marketing) assistant is not exposed on the site yet and the model
 * call is still stubbed, so anonymous access buys nothing and costs something:
 * an unauthenticated POST creates assistant threads and messages in the
 * database from anyone on the internet — and would become real model spend the
 * moment the runtime is wired. Refuse anonymous callers until that ships.
 * Flip to true, deliberately, when the public assistant goes live.
 */
const ALLOW_PUBLIC_ASSISTANT = false;

interface Actor {
  audience: AssistantAudience;
  userId: string | null;
  companyId: string | null;
  role: Role | null;
}

export async function POST(request: Request) {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const user = await getCurrentUser();

  if (!user && !ALLOW_PUBLIC_ASSISTANT) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  // The audience is resolved from the verified session — a caller cannot ask for
  // a wider one. No session at all means the public (marketing) assistant.
  const actor: Actor = user
    ? {
        audience: assistantAudienceForRole(user.role),
        userId: user.id,
        companyId: user.companyId ?? null,
        role: user.role,
      }
    : { audience: 'public', userId: null, companyId: null, role: null };

  // Anonymous callers are limited by IP and far more tightly than signed-in staff.
  const ip = clientIpFromHeaders(request.headers);
  const limitKey = actor.userId ? `assistant:user:${actor.userId}` : `assistant:ip:${ip}`;
  const limit = actor.userId
    ? await checkRateLimit(limitKey, 30, 5 * 60)
    : await checkRateLimit(limitKey, 10, 5 * 60);
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const thread = body.threadId
    ? await resumeThread(body.threadId, actor)
    : await createThread(actor, body.message);

  if (!thread) {
    // Covers both "no such thread" and "not yours" — do not distinguish them.
    return NextResponse.json({ error: 'thread_not_found' }, { status: 404 });
  }

  const history = await loadHistory(thread.id);

  const companyName = actor.companyId ? await loadCompanyName(actor.companyId) : null;

  await prisma.assistantMessage.create({
    data: { threadId: thread.id, role: 'user', content: body.message },
  });

  const reply = await generateAssistantReply({
    audience: actor.audience,
    locale: body.locale,
    history,
    message: body.message,
    companyId: actor.companyId,
    companyName,
    actorRole: actor.role ?? undefined,
  });

  const assistantMessage = await prisma.assistantMessage.create({
    data: {
      threadId: thread.id,
      role: 'assistant',
      content: reply.text,
      tokenUsage: reply.usage ?? undefined,
      citations: reply.citations.length
        ? {
            create: reply.citations.map((citation) => ({
              targetType: citation.targetType,
              targetId: citation.targetId,
              citedDocumentId: citation.targetType === 'document' ? citation.targetId : undefined,
              label: citation.label,
              snippet: citation.snippet,
              accessLevel: citation.accessLevel,
              sourceUrl: citation.sourceUrl,
            })),
          }
        : undefined,
    },
    include: { citations: true },
  });

  await prisma.assistantThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date(), updatedById: actor.userId ?? undefined },
  });

  // Auditing the read is the point: Amina can surface company-scoped data, so who
  // asked what — and under which audience — has to be reconstructable.
  await prisma.auditEvent
    .create({
      data: {
        actorUserId: actor.userId,
        actorRole: actor.role ?? undefined,
        action: 'assistant.message',
        entityType: 'assistant_thread',
        entityId: thread.id,
        summary: `Amina (${actor.audience}) answered a message`,
        companyId: actor.companyId,
        ip,
        userAgent: request.headers.get('user-agent') ?? undefined,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({
    threadId: thread.id,
    audience: actor.audience,
    stubbed: reply.stubbed,
    message: {
      id: assistantMessage.id,
      role: 'assistant' as const,
      content: assistantMessage.content,
      citations: assistantMessage.citations.map((citation) => ({
        id: citation.id,
        label: citation.label,
        targetType: citation.targetType,
        targetId: citation.targetId,
        sourceUrl: citation.sourceUrl,
      })),
    },
  });
}

/**
 * Loads a thread only if this actor genuinely owns it. Identity, audience and
 * company must all match — otherwise a portal user who learned a thread id could
 * read another company's conversation, or replay a public thread as an internal one.
 */
async function resumeThread(threadId: string, actor: Actor) {
  const thread = await prisma.assistantThread.findUnique({
    where: { id: threadId },
    select: { id: true, userId: true, companyId: true, audience: true },
  });
  if (!thread) return null;
  if (thread.audience !== actor.audience) return null;
  if (thread.userId !== actor.userId) return null;
  if ((thread.companyId ?? null) !== actor.companyId) return null;
  return thread;
}

async function createThread(actor: Actor, firstMessage: string) {
  return prisma.assistantThread.create({
    data: {
      audience: actor.audience,
      title: firstMessage.slice(0, 80),
      userId: actor.userId,
      companyId: actor.companyId,
      actorRole: actor.role ?? undefined,
      lastMessageAt: new Date(),
      createdById: actor.userId ?? undefined,
    },
    select: { id: true, userId: true, companyId: true, audience: true },
  });
}

async function loadHistory(threadId: string): Promise<AssistantTurn[]> {
  const messages = await prisma.assistantMessage.findMany({
    where: { threadId, role: { in: ['user', 'assistant'] } },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  return messages
    .reverse()
    .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content }));
}

async function loadCompanyName(companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { legalName: true, tradingName: true },
  });
  if (!company) return null;
  return company.tradingName ?? company.legalName;
}
