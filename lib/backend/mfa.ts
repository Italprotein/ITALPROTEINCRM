import "server-only";

import { prisma } from "@/lib/backend/prisma";
import { decryptSecret, verifyOneTimeCode } from "@/lib/backend/crypto";
import { verifyTotp, normaliseBackupCode } from "@/lib/backend/totp";
import type { Role } from "@/lib/types";

/*
 * Second-factor policy and verification.
 *
 * Deliberately NOT a "use server" module. Everything here takes a userId rather
 * than a session — because it runs during sign-in, before a session exists — and
 * exporting that as a server action would publish an endpoint that lets anyone
 * brute-force six-digit codes (and burn recovery codes) for a known user id.
 * auth.ts imports these directly; nothing reaches them over the network.
 */

/**
 * Roles that must present a second factor.
 *
 * super_admin only, for now: it is the one role that can add or remove admins
 * and change settings, so compromising it compromises everything else. The other
 * internal roles can enroll voluntarily. Widen this set — ideally to every
 * internal role — before external company accounts exist.
 */
const MFA_REQUIRED_ROLES: ReadonlySet<Role> = new Set<Role>(["super_admin"]);

export function mfaRequiredForRole(role: Role): boolean {
  return MFA_REQUIRED_ROLES.has(role);
}

/**
 * True when this user has a usable second factor configured. Used to decide
 * whether a code is expected at sign-in.
 */
export async function hasActiveSecondFactor(userId: string): Promise<boolean> {
  const factor = await prisma.mfaFactor.findFirst({
    where: { userId, type: "totp", status: "active" },
    select: { id: true },
  });
  return Boolean(factor);
}

/**
 * Verifies a TOTP code, falling back to a single-use recovery code.
 * Recovery codes are revoked the moment they succeed.
 */
export async function verifySecondFactor(userId: string, token: string): Promise<boolean> {
  const supplied = (token ?? "").trim();
  if (!supplied) return false;

  const totp = await prisma.mfaFactor.findFirst({
    where: { userId, type: "totp", status: "active" },
  });
  if (totp?.secret && verifyTotp(decryptSecret(totp.secret), supplied)) {
    await prisma.mfaFactor
      .update({ where: { id: totp.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
    return true;
  }

  const normalised = normaliseBackupCode(supplied);
  if (!normalised) return false;
  const codes = await prisma.mfaFactor.findMany({
    where: { userId, type: "recovery_code", status: "active" },
  });
  for (const candidate of codes) {
    if (candidate.secret && verifyOneTimeCode(normalised, candidate.secret)) {
      await prisma.mfaFactor.update({
        where: { id: candidate.id },
        data: { status: "revoked", lastUsedAt: new Date() },
      });
      return true;
    }
  }
  return false;
}
