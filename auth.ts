import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/backend/prisma";
import {
  checkRateLimit,
  clientIpFromHeaders,
  peekRateLimit,
  resetRateLimit,
} from "@/lib/backend/rate-limit";
import { mfaRequiredForRole, hasActiveSecondFactor, verifySecondFactor } from "@/lib/backend/mfa";
import type { Role } from "@/lib/types";

// Full Auth.js config (Node runtime). Email + password via the Credentials
// provider, verified against User.passwordHash with bcrypt. Sessions are JWT
// (required for Credentials). Sign-in attempts are rate-limited per email and
// per IP (DB-backed fixed windows, fail-closed) to blunt brute-force/DoS.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        workspace: { label: "Workspace", type: "text" },
        totp: { label: "Authentication code", type: "text" },
      },
      authorize: async (credentials, request) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        const workspace = String(credentials?.workspace ?? "");
        const totp = String(credentials?.totp ?? "");
        if (!email || !password || (workspace !== "internal" && workspace !== "external")) return null;

        const ip = clientIpFromHeaders(request?.headers);
        // Volumetric guard: every attempt spends per-IP quota.
        const byIp = await checkRateLimit(`login:ip:${ip}`, 30, 15 * 60);
        if (!byIp.ok) return null;

        // Per-account guard counts FAILURES only — peek here, consume on the
        // failure path below, clear on success. Counting successful sign-ins
        // (the previous behaviour) meant an admin could lock themselves out by
        // logging in normally, and let anyone deny login AND password reset to
        // a known admin with ~11 junk requests. All 7 addresses are guessable.
        const failKey = `login:fail:${email}`;
        const byEmail = await peekRateLimit(failKey, 8, 15 * 60);
        if (!byEmail.ok) return null;

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true },
        });
        if (!user || !user.passwordHash || user.status !== "active") return null;

        // Both login doors use this provider, so the requested door is part of
        // the credential contract. Role, user kind and door must agree; portal
        // users additionally need a company scope before they can authenticate.
        if (
          user.kind !== workspace ||
          user.role.kind !== user.kind ||
          (user.kind === "external" && !user.companyId)
        ) {
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          // Only a wrong password spends the per-account budget.
          await checkRateLimit(failKey, 8, 15 * 60);
          await prisma.auditEvent
            .create({
              data: {
                actorUserId: user.id,
                action: "auth.login_failed",
                entityType: "user",
                entityId: user.id,
                summary: "Sign-in rejected: wrong password",
                result: "denied",
                ip,
              },
            })
            .catch(() => undefined);
          return null;
        }

        // ── Second factor ──
        // Required for roles in the MFA policy (super_admin), and always
        // enforced for anyone who has voluntarily enrolled. Checked only after
        // the password is correct, so a code can never be probed without it.
        const roleKey = user.role.key as Role;
        const enrolled = await hasActiveSecondFactor(user.id);

        // Bootstrap: a role that REQUIRES a second factor but has not enrolled
        // yet must still be able to sign in — otherwise the very first deploy
        // locks the super_admin out of the account they need in order to set MFA
        // up. The session is allowed and audited; the UI then blocks the way
        // forward with a mandatory enrollment prompt (see MfaEnrollmentNotice).
        if (mfaRequiredForRole(roleKey) && !enrolled) {
          await prisma.auditEvent
            .create({
              data: {
                actorUserId: user.id,
                actorRole: roleKey,
                action: "auth.mfa_enrollment_pending",
                entityType: "user",
                entityId: user.id,
                summary: "Signed in without a second factor — enrollment is required for this role",
                result: "success",
                ip,
              },
            })
            .catch(() => undefined);
        }

        // Once a factor exists it is always enforced, for every role.
        if (enrolled) {
          // Codes get their own budget: a correct password must not grant
          // unlimited attempts at the 6-digit space.
          const mfaKey = `login:mfa:${user.id}`;
          const mfaBudget = await checkRateLimit(mfaKey, 8, 15 * 60);
          if (!mfaBudget.ok) return null;

          if (!(await verifySecondFactor(user.id, totp))) {
            await prisma.auditEvent
              .create({
                data: {
                  actorUserId: user.id,
                  actorRole: roleKey,
                  action: "auth.mfa_failed",
                  entityType: "user",
                  entityId: user.id,
                  summary: totp
                    ? "Sign-in rejected: invalid two-factor code"
                    : "Sign-in rejected: two-factor code missing",
                  result: "denied",
                  ip,
                },
              })
              .catch(() => undefined);
            return null;
          }
          await resetRateLimit(mfaKey);
        }

        // Correct password: wipe the failure budget so earlier typos (or an
        // attacker burning it) never lock the real owner out.
        await resetRateLimit(failKey);

        // Best-effort last-login stamp; never block sign-in on this.
        await prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => undefined);

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          role: user.role.key,
          kind: user.kind,
          companyId: user.companyId ?? null,
          authVersion: user.authVersion,
        };
      },
    }),
  ],
});
