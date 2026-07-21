"use server";

import { headers } from "next/headers";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/backend/rate-limit";
import { generateResetCode, hashOneTimeCode, verifyOneTimeCode } from "@/lib/backend/crypto";
import { buildRawEmail, getGmailAuth, sendRawMessage } from "@/lib/backend/gmail";
import { getBackendEnv } from "@/lib/backend/env";

// Password lifecycle for admin accounts: change (authenticated) and reset via
// a six-digit code emailed from the connected org mailbox. All entry points
// are rate-limited (DB-backed, fail-closed) against brute force.

const RESET_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_MAX_ATTEMPTS = 5;
const ADMIN_ROLES = ["super_admin", "crm_admin"];

export interface AuthActionResult {
  ok: boolean;
  error?:
    | "unauthenticated"
    | "rate_limited"
    | "invalid_current_password"
    | "weak_password"
    | "invalid_code"
    | "expired_code"
    | "too_many_attempts"
    | "email_unavailable"
    | "server_error";
}

/** ≥10 chars with at least one letter and one digit. */
function isStrongPassword(password: string): boolean {
  return password.length >= 10 && /[a-zA-Z]/.test(password) && /\d/.test(password);
}

async function requestIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

async function audit(
  action: string,
  summary: string,
  actorUserId: string | null,
  result: "success" | "denied" = "success",
): Promise<void> {
  await prisma.auditEvent
    .create({
      data: {
        actorUserId,
        action,
        entityType: "user",
        entityId: actorUserId,
        summary,
        result,
        ip: await requestIp(),
      },
    })
    .catch(() => undefined);
}

// ── Change password (signed-in admin) ──────────────────────────────────────

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<AuthActionResult> {
  const session = await getCurrentUser();
  if (!session || session.kind !== "internal") return { ok: false, error: "unauthenticated" };

  const limit = await checkRateLimit(`pwchange:${session.id}`, 5, 15 * 60);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  if (!isStrongPassword(newPassword)) return { ok: false, error: "weak_password" };

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user?.passwordHash) return { ok: false, error: "unauthenticated" };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    await audit("auth.password_change_failed", "Password change rejected: wrong current password", user.id, "denied");
    return { ok: false, error: "invalid_current_password" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });
  await audit("auth.password_changed", "Password changed from the admin settings page", user.id);
  return { ok: true };
}

// ── Password reset (pre-auth, emailed six-digit code) ──────────────────────

export async function requestPasswordReset(emailRaw: string): Promise<AuthActionResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: true }; // don't leak anything

  const ip = await requestIp();
  const [byIp, byEmail] = await Promise.all([
    checkRateLimit(`reset:ip:${ip}`, 6, 15 * 60),
    checkRateLimit(`reset:email:${email}`, 3, 15 * 60),
  ]);
  if (!byIp.ok || !byEmail.ok) return { ok: false, error: "rate_limited" };

  // Check the mail transport BEFORE looking the user up. Doing it afterwards
  // made the response depend on whether the account existed: a real admin
  // address returned "email_unavailable" while an unknown one returned ok —
  // a clean oracle for "is this an admin account?", which is precisely what
  // the always-ok branch below exists to prevent. It leaks today, because the
  // Gmail mailbox has not been connected yet.
  const auth = await getGmailAuth();
  if (!auth) {
    // Config problem, not an account probe — safe to surface, and now returned
    // identically for existing and non-existing addresses.
    return { ok: false, error: "email_unavailable" };
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  // Only active admin accounts can reset — but always answer "ok" so the
  // endpoint cannot be used to probe which emails exist.
  if (!user?.passwordHash || user.status !== "active" || !ADMIN_ROLES.includes(user.role.key)) {
    return { ok: true };
  }

  const code = generateResetCode();
  await prisma.passwordResetCode.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.passwordResetCode.create({
    data: {
      userId: user.id,
      email,
      codeHash: hashOneTimeCode(code),
      expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
      requestIp: ip,
    },
  });

  const env = getBackendEnv();
  const firstName = (user.name ?? "").split(/\s+/)[0] || "there";
  const text = [
    `Hi ${firstName},`,
    "",
    `Your Italprotein CRM password reset code is: ${code}`,
    "",
    "The code expires in 15 minutes. If you did not request a reset, you can ignore this email — your password stays unchanged.",
    "",
    "Italprotein Srl",
  ].join("\n");

  try {
    const sent = await sendRawMessage(
      auth,
      buildRawEmail({
        from: auth.email,
        fromName: "Italprotein CRM",
        replyTo: env.gmail.replyTo,
        to: [email],
        subject: "Your Italprotein CRM password reset code",
        text,
      }),
    );
    await prisma.emailLog
      .create({
        data: {
          trigger: "password_reset",
          templateKey: "password_reset",
          to: email,
          toAddresses: [email],
          cc: [],
          subject: "Your Italprotein CRM password reset code",
          preview: "Six-digit password reset code",
          status: "sent",
          providerMessageId: sent.id,
          recipientUserId: user.id,
          sentAt: new Date(),
        },
      })
      .catch(() => undefined);
    await audit("auth.password_reset_requested", "Password reset code emailed", user.id);
    return { ok: true };
  } catch {
    await prisma.emailLog
      .create({
        data: {
          trigger: "password_reset",
          templateKey: "password_reset",
          to: email,
          toAddresses: [email],
          cc: [],
          subject: "Your Italprotein CRM password reset code",
          preview: "Six-digit password reset code",
          status: "failed",
          error: "gmail_send_failed",
          recipientUserId: user.id,
        },
      })
      .catch(() => undefined);
    return { ok: false, error: "email_unavailable" };
  }
}

export async function confirmPasswordReset(
  emailRaw: string,
  code: string,
  newPassword: string,
): Promise<AuthActionResult> {
  const email = emailRaw.trim().toLowerCase();
  const ip = await requestIp();
  const limit = await checkRateLimit(`resetconfirm:ip:${ip}`, 10, 15 * 60);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  if (!isStrongPassword(newPassword)) return { ok: false, error: "weak_password" };

  const entry = await prisma.passwordResetCode.findFirst({
    where: { email, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!entry) return { ok: false, error: "invalid_code" };
  if (entry.expiresAt.getTime() < Date.now()) return { ok: false, error: "expired_code" };

  // Claim an attempt slot ATOMICALLY, before verifying the code. Reading
  // `attempts` and incrementing it afterwards was a read-then-write race: many
  // concurrent requests all saw attempts=0 and each got a free guess, so the
  // 5-guess cap could be bypassed at will from enough connections. A conditional
  // updateMany makes the database enforce the cap — every guess costs a slot,
  // and because all guesses target this one row the budget holds no matter how
  // many IPs an attacker spreads across (the per-IP limit above only shapes
  // volume). With requestPasswordReset capped at 3 codes per email per window,
  // that bounds an attacker to 15 guesses per 15 minutes against a 6-digit code.
  const claimed = await prisma.passwordResetCode.updateMany({
    where: { id: entry.id, usedAt: null, attempts: { lt: RESET_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return { ok: false, error: "too_many_attempts" };

  if (!/^\d{6}$/.test(code.trim()) || !verifyOneTimeCode(code.trim(), entry.codeHash)) {
    await audit("auth.password_reset_failed", "Wrong password reset code entered", entry.userId, "denied");
    return { ok: false, error: "invalid_code" };
  }

  await prisma.$transaction([
    prisma.passwordResetCode.update({ where: { id: entry.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetCode.deleteMany({ where: { userId: entry.userId, usedAt: null, id: { not: entry.id } } }),
    prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) },
    }),
  ]);
  await audit("auth.password_reset_completed", "Password reset via emailed code", entry.userId);
  return { ok: true };
}
