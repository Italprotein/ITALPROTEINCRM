"use server";

import QRCode from "qrcode";

import { prisma } from "@/lib/backend/prisma";
import { requireUser } from "@/lib/backend/session";
import { encryptSecret, decryptSecret, hashOneTimeCode } from "@/lib/backend/crypto";
import { checkRateLimit } from "@/lib/backend/rate-limit";
import {
  generateTotpSecret,
  totpAuthUri,
  verifyTotp,
  generateBackupCodes,
  normaliseBackupCode,
} from "@/lib/backend/totp";
import { mfaRequiredForRole } from "@/lib/backend/mfa";

/*
 * Two-factor authentication (TOTP).
 *
 * Storage reuses the MfaFactor table that the schema already models:
 *   - type "totp"          -> one factor, secret encrypted at rest (AES-256-GCM)
 *   - type "recovery_code" -> one row per single-use code, stored as a keyed
 *                             hash and revoked on use
 *
 * The secret is only ever revealed once, during enrollment, and the factor stays
 * `pending` until the user proves possession by entering a live code — so a
 * half-finished enrollment can never lock anybody out.
 */

export interface MfaStatus {
  enrolled: boolean;
  required: boolean;
  backupCodesRemaining: number;
  enrolledAt: string | null;
}

export interface EnrollmentChallenge {
  /** Base32 secret, for manual entry when a QR cannot be scanned. */
  secret: string;
  /** data: URL of the QR code encoding the otpauth:// URI. */
  qrDataUrl: string;
}

export interface MfaActionResult {
  ok: boolean;
  error?: "invalid_code" | "not_enrolled" | "already_enrolled" | "rate_limited";
  /** Returned exactly once, on successful enrollment. */
  backupCodes?: string[];
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const user = await requireUser();
  const [totp, remaining] = await Promise.all([
    prisma.mfaFactor.findFirst({
      where: { userId: user.id, type: "totp", status: "active" },
      select: { verifiedAt: true },
    }),
    prisma.mfaFactor.count({
      where: { userId: user.id, type: "recovery_code", status: "active" },
    }),
  ]);
  return {
    enrolled: Boolean(totp),
    required: mfaRequiredForRole(user.role),
    backupCodesRemaining: remaining,
    enrolledAt: totp?.verifiedAt?.toISOString() ?? null,
  };
}

/**
 * Starts (or restarts) enrollment. Any previous *pending* factor is discarded so
 * an abandoned attempt cannot be resumed with a stale secret. An already-active
 * factor is left untouched — disabling is a separate, code-protected action.
 */
export async function beginTotpEnrollment(): Promise<EnrollmentChallenge | { error: "already_enrolled" }> {
  const user = await requireUser();

  const active = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, type: "totp", status: "active" },
    select: { id: true },
  });
  if (active) return { error: "already_enrolled" };

  await prisma.mfaFactor.deleteMany({ where: { userId: user.id, type: "totp", status: "pending" } });

  const secret = generateTotpSecret();
  await prisma.mfaFactor.create({
    data: {
      userId: user.id,
      type: "totp",
      status: "pending",
      label: "Authenticator app",
      secret: encryptSecret(secret),
      createdById: user.id,
    },
  });

  const uri = totpAuthUri(secret, user.email ?? user.id);
  return { secret, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

/**
 * Completes enrollment by proving possession of the secret. Only on success does
 * the factor become active, the backup codes get issued, and the user flip to
 * enrolled — all in one transaction.
 */
export async function confirmTotpEnrollment(code: string): Promise<MfaActionResult> {
  const user = await requireUser();

  const limit = await checkRateLimit(`mfa:enroll:${user.id}`, 10, 15 * 60);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  const pending = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, type: "totp", status: "pending" },
    orderBy: { createdAt: "desc" },
  });
  if (!pending?.secret) return { ok: false, error: "not_enrolled" };

  if (!verifyTotp(decryptSecret(pending.secret), code)) {
    return { ok: false, error: "invalid_code" };
  }

  const backupCodes = generateBackupCodes(10);
  const now = new Date();

  await prisma.$transaction([
    // Retire any earlier factor so exactly one TOTP secret is ever active.
    prisma.mfaFactor.updateMany({
      where: { userId: user.id, type: "totp", status: "active" },
      data: { status: "revoked" },
    }),
    prisma.mfaFactor.update({
      where: { id: pending.id },
      data: { status: "active", verifiedAt: now, updatedById: user.id },
    }),
    prisma.mfaFactor.deleteMany({ where: { userId: user.id, type: "recovery_code" } }),
    prisma.mfaFactor.createMany({
      data: backupCodes.map((c) => ({
        userId: user.id,
        type: "recovery_code" as const,
        status: "active" as const,
        secret: hashOneTimeCode(normaliseBackupCode(c)),
        createdById: user.id,
      })),
    }),
    prisma.user.update({ where: { id: user.id }, data: { mfaEnrolled: true } }),
    prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "auth.mfa_enrolled",
        entityType: "user",
        entityId: user.id,
        summary: "Two-factor authentication enabled (TOTP)",
      },
    }),
  ]);

  return { ok: true, backupCodes };
}

/**
 * Turns MFA off. Requires a current code: a stolen session must not be enough to
 * strip the second factor off the account. Refused outright for roles where MFA
 * is mandatory.
 */
export async function disableMfa(code: string): Promise<MfaActionResult> {
  const user = await requireUser();
  if (mfaRequiredForRole(user.role)) return { ok: false, error: "invalid_code" };

  const limit = await checkRateLimit(`mfa:disable:${user.id}`, 10, 15 * 60);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, type: "totp", status: "active" },
  });
  if (!factor?.secret) return { ok: false, error: "not_enrolled" };
  if (!verifyTotp(decryptSecret(factor.secret), code)) return { ok: false, error: "invalid_code" };

  await prisma.$transaction([
    prisma.mfaFactor.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { mfaEnrolled: false } }),
    prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "auth.mfa_disabled",
        entityType: "user",
        entityId: user.id,
        summary: "Two-factor authentication disabled",
        result: "success",
      },
    }),
  ]);

  return { ok: true };
}

/** Issues a fresh set of recovery codes, invalidating the old ones. */
export async function regenerateBackupCodes(code: string): Promise<MfaActionResult> {
  const user = await requireUser();

  const limit = await checkRateLimit(`mfa:codes:${user.id}`, 10, 15 * 60);
  if (!limit.ok) return { ok: false, error: "rate_limited" };

  const factor = await prisma.mfaFactor.findFirst({
    where: { userId: user.id, type: "totp", status: "active" },
  });
  if (!factor?.secret) return { ok: false, error: "not_enrolled" };
  if (!verifyTotp(decryptSecret(factor.secret), code)) return { ok: false, error: "invalid_code" };

  const backupCodes = generateBackupCodes(10);
  await prisma.$transaction([
    prisma.mfaFactor.deleteMany({ where: { userId: user.id, type: "recovery_code" } }),
    prisma.mfaFactor.createMany({
      data: backupCodes.map((c) => ({
        userId: user.id,
        type: "recovery_code" as const,
        status: "active" as const,
        secret: hashOneTimeCode(normaliseBackupCode(c)),
        createdById: user.id,
      })),
    }),
    prisma.auditEvent.create({
      data: {
        actorUserId: user.id,
        actorRole: user.role,
        action: "auth.mfa_backup_codes_regenerated",
        entityType: "user",
        entityId: user.id,
        summary: "New two-factor recovery codes issued",
      },
    }),
  ]);

  return { ok: true, backupCodes };
}

// NOTE: sign-in-time verification deliberately lives in lib/backend/mfa.ts, not
// here. It takes a userId instead of a session (no session exists yet at that
// point), and exporting it from a "use server" module would publish an endpoint
// anyone could use to brute-force codes for a known user id.
