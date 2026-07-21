import bcrypt from "bcryptjs";

import type { Locale, Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { generateActivationToken, hashActivationToken } from "@/lib/backend/crypto";
import {
  buildRawEmail,
  getGmailAuth,
  normalizeEmailAddress,
  sendRawMessage,
} from "@/lib/backend/gmail";
import { getBackendEnv } from "@/lib/backend/env";

export const ACTIVATION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;

export interface ActivationTokenMaterial {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

export type AccountActivationError =
  | "invalid_token"
  | "expired_token"
  | "weak_password"
  | "server_error";

export type AccountActivationResult =
  | { ok: true; workspace: "internal" | "external" }
  | { ok: false; error: AccountActivationError };

export interface InvitationDeliveryResult {
  ok: boolean;
  error?: "invalid_email" | "app_url_missing" | "gmail_not_connected" | "gmail_send_failed";
}

export interface StagedActivationToken {
  id: string;
  createdAt: Date;
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 10 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

/** Create the plaintext+hash pair before a transaction; only the hash is stored. */
export function createActivationTokenMaterial(now = new Date()): ActivationTokenMaterial {
  const token = generateActivationToken();
  return {
    token,
    tokenHash: hashActivationToken(token),
    expiresAt: new Date(now.getTime() + ACTIVATION_TOKEN_TTL_MS),
  };
}

/** Replace all prior live invitations for a user inside the caller's transaction. */
export async function replaceActivationToken(
  tx: Prisma.TransactionClient,
  userId: string,
  createdByUserId: string | null,
  material: ActivationTokenMaterial,
): Promise<void> {
  const now = new Date();
  await tx.accountActivationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: now },
  });
  await tx.accountActivationToken.create({
    data: {
      userId,
      tokenHash: material.tokenHash,
      expiresAt: material.expiresAt,
      createdByUserId,
    },
  });
}

/** Stage a resend candidate while preserving the recipient's current link. */
export async function stageActivationToken(
  tx: Prisma.TransactionClient,
  userId: string,
  createdByUserId: string | null,
  material: ActivationTokenMaterial,
): Promise<StagedActivationToken> {
  return tx.accountActivationToken.create({
    data: {
      userId,
      tokenHash: material.tokenHash,
      expiresAt: material.expiresAt,
      createdByUserId,
    },
    select: { id: true, createdAt: true },
  });
}

/**
 * Promote a delivered resend candidate, or retire only that candidate when
 * delivery failed. Older working links survive a failed Gmail attempt.
 */
export async function settleStagedActivationToken(
  userId: string,
  staged: StagedActivationToken,
  delivered: boolean,
): Promise<void> {
  const now = new Date();
  if (!delivered) {
    await prisma.accountActivationToken.updateMany({
      where: { id: staged.id, userId, usedAt: null },
      data: { usedAt: now },
    }).catch(() => undefined);
    return;
  }
  await prisma.accountActivationToken.updateMany({
    where: {
      userId,
      id: { not: staged.id },
      usedAt: null,
      createdAt: { lt: staged.createdAt },
    },
    data: { usedAt: now },
  }).catch(() => undefined);
}

interface DeliverInvitationOptions {
  emailLogId: string;
  userId: string;
  email: string;
  name: string | null;
  locale: Locale;
  workspace: "internal" | "external";
  token: string;
}

/**
 * Deliver after the provisioning transaction commits. The durable EmailLog row
 * is created inside that transaction and updated here to sent/failed.
 */
export async function deliverAccountInvitation(
  options: DeliverInvitationOptions,
): Promise<InvitationDeliveryResult> {
  const recipient = normalizeEmailAddress(options.email);
  if (!recipient) {
    await prisma.emailLog.update({
      where: { id: options.emailLogId },
      data: { status: "failed", error: "invalid_email", attemptCount: { increment: 1 } },
    }).catch(() => undefined);
    return { ok: false, error: "invalid_email" };
  }
  const env = getBackendEnv();
  const appUrl = env.app.url;
  if (!appUrl) {
    await prisma.emailLog.update({
      where: { id: options.emailLogId },
      data: { status: "failed", error: "app_url_missing", attemptCount: { increment: 1 } },
    }).catch(() => undefined);
    return { ok: false, error: "app_url_missing" };
  }

  const gmail = await getGmailAuth();
  if (!gmail) {
    await prisma.emailLog.update({
      where: { id: options.emailLogId },
      data: { status: "failed", error: "gmail_not_connected", attemptCount: { increment: 1 } },
    }).catch(() => undefined);
    return { ok: false, error: "gmail_not_connected" };
  }

  const activationUrl = new URL(`/${options.locale}/activate`, appUrl);
  activationUrl.searchParams.set("token", options.token);
  const firstName = (options.name ?? "").trim().split(/\s+/)[0] || (options.locale === "it" ? "Salve" : "there");
  const loginLabel = options.workspace === "internal" ? "team workspace" : "company portal";
  const subject = options.locale === "it"
    ? "Attiva il tuo account Italprotein CRM"
    : "Activate your Italprotein CRM account";
  const text = options.locale === "it"
    ? [
        `Ciao ${firstName},`,
        "",
        "Il tuo account Italprotein CRM è pronto. Imposta la password usando questo link:",
        activationUrl.toString(),
        "",
        "Il link scade tra 72 ore e può essere utilizzato una sola volta.",
        "",
        "Italprotein Srl",
      ].join("\n")
    : [
        `Hi ${firstName},`,
        "",
        `Your Italprotein CRM ${loginLabel} account is ready. Set your password using this link:`,
        activationUrl.toString(),
        "",
        "The link expires in 72 hours and can be used only once.",
        "",
        "Italprotein Srl",
      ].join("\n");

  let sent: Awaited<ReturnType<typeof sendRawMessage>>;
  try {
    sent = await sendRawMessage(
      gmail,
      buildRawEmail({
        from: gmail.email,
        fromName: "Italprotein CRM",
        replyTo: env.gmail.replyTo,
        to: [recipient],
        subject,
        text,
      }),
    );
  } catch {
    await prisma.emailLog.update({
      where: { id: options.emailLogId },
      data: { status: "failed", error: "gmail_send_failed", attemptCount: { increment: 1 } },
    }).catch(() => undefined);
    return { ok: false, error: "gmail_send_failed" };
  }
  // Gmail accepted the message. A later bookkeeping failure must not be
  // reported as a delivery failure, which would encourage duplicate sends.
  await prisma.emailLog.update({
    where: { id: options.emailLogId },
    data: {
      status: "sent",
      error: null,
      providerMessageId: sent.id,
      sentAt: new Date(),
      attemptCount: { increment: 1 },
    },
  }).catch(() => undefined);
  return { ok: true };
}

class ActivationRaceError extends Error {}

/** Atomically consume one invitation token and activate its invited user. */
export async function activateInvitedAccount(
  tokenRaw: string,
  password: string,
  ip?: string,
): Promise<AccountActivationResult> {
  const token = tokenRaw.trim();
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) return { ok: false, error: "invalid_token" };
  if (!isStrongPassword(password)) return { ok: false, error: "weak_password" };

  const tokenHash = hashActivationToken(token);
  // Reject random/expired/mis-scoped tokens before paying bcrypt's cost. The
  // transaction below repeats every check and remains the security boundary.
  const preview = await prisma.accountActivationToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });
  if (!preview || preview.usedAt) return { ok: false, error: "invalid_token" };
  if (preview.expiresAt <= new Date()) return { ok: false, error: "expired_token" };
  if (
    preview.user.status !== "invited" ||
    preview.user.kind !== preview.user.role.kind ||
    (preview.user.kind === "external" && !preview.user.companyId)
  ) {
    return { ok: false, error: "invalid_token" };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.accountActivationToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { role: true } } },
      });
      if (!entry || entry.usedAt) return { ok: false, error: "invalid_token" } as const;
      if (entry.expiresAt <= now) return { ok: false, error: "expired_token" } as const;

      const user = entry.user;
      const identityIsValid =
        user.status === "invited" &&
        user.kind === user.role.kind &&
        (user.kind === "internal" || Boolean(user.companyId));
      if (!identityIsValid) return { ok: false, error: "invalid_token" } as const;

      const claimed = await tx.accountActivationToken.updateMany({
        where: { id: entry.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return { ok: false, error: "invalid_token" } as const;

      const activated = await tx.user.updateMany({
        where: { id: user.id, status: "invited" },
        data: {
          passwordHash,
          status: "active",
          emailVerified: now,
          updatedById: user.id,
        },
      });
      if (activated.count !== 1) throw new ActivationRaceError("activation_claim_lost");

      await tx.accountActivationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: now },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role.key,
          action: "auth.account_activated",
          entityType: "user",
          entityId: user.id,
          summary: "Invited account activated and password set",
          result: "success",
          ip: ip ?? null,
          companyId: user.companyId,
        },
      });

      return { ok: true, workspace: user.kind } as const;
    });
  } catch {
    return { ok: false, error: "server_error" };
  }
}
