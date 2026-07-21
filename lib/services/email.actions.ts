"use server";

import { headers } from "next/headers";

import { prisma } from "@/lib/backend/prisma";
import { requireAction, requireInternal, requireSectionEdit } from "@/lib/backend/session";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/backend/rate-limit";
import { runGmailSync } from "@/lib/backend/gmail-sync";
import {
  buildRawEmail,
  getGmailAuth,
  getMailboxConnection,
  revokeMailbox,
  sendRawMessage,
} from "@/lib/backend/gmail";
import { getBackendEnv } from "@/lib/backend/env";
import { emailMessageToDTO } from "./email.mapper";
import type {
  EmailMessageRecord,
  GmailConnectionStatus,
  GmailSyncResult,
  OutboundEmailInput,
  SendEmailResult,
} from "@/lib/types";

const EMPTY_SYNC = { fetched: 0, created: 0, ndasCreated: 0, leadsCreated: 0, leadsUpdated: 0 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// AUTHZ: the shared Italprotein mailbox is an internal communications log — no
// portal or anonymous caller may reach any action in this file. Each export
// opens with a guard that throws, replacing the previous "resolve the session,
// bail out quietly if it is missing" pattern.

export async function listEmailMessages(
  direction?: "inbound" | "outbound",
  limit = 200,
): Promise<EmailMessageRecord[]> {
  await requireInternal();
  const rows = await prisma.emailMessage.findMany({
    where: direction ? { direction } : {},
    orderBy: { internalDate: "desc" },
    take: Math.min(limit, 500),
  });
  return rows.map(emailMessageToDTO);
}

export async function syncGmailInbox(): Promise<GmailSyncResult> {
  // Triggered from both /admin/communications and /admin/settings, so it stays
  // open to every internal role rather than being gated on either section.
  await requireInternal();
  // One mailbox for everyone — keep sync polite regardless of who clicks.
  const limit = await checkRateLimit("gmail:sync", 4, 60);
  if (!limit.ok) return { ok: false, error: "rate_limited", ...EMPTY_SYNC };
  return runGmailSync();
}

export async function sendAdminEmail(input: OutboundEmailInput): Promise<SendEmailResult> {
  // Outbound mail leaves the company under the Italprotein mailbox — the send
  // itself needs edit rights on communications, not just an internal session.
  const user = await requireSectionEdit("communications");

  const to = (input.to ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
  const cc = (input.cc ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
  const subject = (input.subject ?? "").trim();
  const body = (input.body ?? "").trim();
  if (!to.length || ![...to, ...cc].every((a) => EMAIL_RE.test(a))) {
    return { ok: false, error: "invalid_recipients" };
  }
  if (!subject || subject.length > 300 || !body || body.length > 50_000) {
    return { ok: false, error: "invalid_content" };
  }

  const ip = clientIpFromHeaders(await headers());
  const [byUser, byIp] = await Promise.all([
    checkRateLimit(`mail:user:${user.id}`, 30, 3600),
    checkRateLimit(`mail:ip:${ip}`, 60, 3600),
  ]);
  if (!byUser.ok || !byIp.ok) return { ok: false, error: "rate_limited" };

  const auth = await getGmailAuth();
  if (!auth) return { ok: false, error: "gmail_not_connected" };

  const env = getBackendEnv();
  const raw = buildRawEmail({
    from: auth.email,
    fromName: user.name ? `${user.name} — Italprotein` : "Italprotein",
    replyTo: env.gmail.replyTo,
    to,
    cc,
    subject,
    text: body,
  });

  try {
    const sent = await sendRawMessage(auth, raw);
    const now = new Date();
    const row = await prisma.emailMessage
      .create({
        data: {
          gmailMessageId: sent.id,
          gmailThreadId: sent.threadId,
          direction: "outbound",
          fromAddress: auth.email.toLowerCase(),
          fromName: user.name ?? "Italprotein",
          toAddresses: to,
          ccAddresses: cc,
          subject,
          snippet: body.slice(0, 160),
          bodyText: body.slice(0, 20_000),
          internalDate: now,
          companyId: input.companyId ?? null,
          sentByUserId: user.id,
        },
      })
      .catch(() => null);
    await prisma.emailLog
      .create({
        data: {
          trigger: "manual_email",
          to: to[0],
          toAddresses: to,
          cc,
          subject,
          preview: body.slice(0, 140),
          locale: "en",
          status: "sent",
          providerMessageId: sent.id,
          companyId: input.companyId ?? null,
          relatedEntityType: "email_message",
          relatedEntityId: row?.id ?? null,
          sentAt: now,
        },
      })
      .catch(() => undefined);
    // Surface the send in the existing activity timeline / communications tab.
    await prisma.activity
      .create({
        data: {
          type: "email",
          title: subject,
          body: body.slice(0, 500),
          actorUserId: user.id,
          companyId: input.companyId ?? null,
          relatedType: "gmail_message",
          relatedId: sent.id,
          visibility: "internal",
          occurredAt: now,
        },
      })
      .catch(() => undefined);
    return { ok: true, providerMessageId: sent.id };
  } catch {
    await prisma.emailLog
      .create({
        data: {
          trigger: "manual_email",
          to: to[0],
          toAddresses: to,
          cc,
          subject,
          preview: body.slice(0, 140),
          locale: "en",
          status: "failed",
          error: "gmail_send_failed",
          companyId: input.companyId ?? null,
        },
      })
      .catch(() => undefined);
    return { ok: false, error: "send_failed" };
  }
}

export async function gmailConnectionStatus(): Promise<GmailConnectionStatus> {
  await requireInternal();
  const connection = await getMailboxConnection();
  if (!connection.email) return { connected: false };
  const [latest, inboxCount] = await Promise.all([
    prisma.emailMessage.findFirst({ orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
    prisma.emailMessage.count({ where: { direction: "inbound" } }),
  ]);
  return {
    connected: connection.connected,
    email: connection.email,
    status: connection.status,
    lastSyncedAt: latest?.syncedAt.toISOString(),
    inboxCount,
  };
}

export async function disconnectGmail(): Promise<void> {
  // Revokes the single shared mailbox for the whole company. The control lives
  // on /admin/settings, which only super_admin and crm_admin can open (settings
  // is 'hidden' for every other role) — both hold 'settings.edit', so this
  // matches the UI exactly without locking out a legitimate role.
  const user = await requireAction("settings.edit");
  await revokeMailbox();
  await prisma.auditEvent
    .create({
      data: {
        actorUserId: user.id,
        action: "integration.gmail_disconnected",
        entityType: "google_oauth_token",
        summary: "Gmail mailbox disconnected from the CRM",
      },
    })
    .catch(() => undefined);
}
