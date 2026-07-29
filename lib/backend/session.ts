import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/backend/prisma";
import { can, canView, canEdit, isInternal, type Action, type Section } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export interface SessionUser {
  id: string;
  role: Role;
  kind: "internal" | "external";
  companyId: string | null;
  authVersion: number;
  name?: string | null;
  email?: string | null;
}

/**
 * Returns the authenticated user (from the verified session) or null.
 *
 * Memoised per request with React's cache(). Almost every action resolves the
 * session at least twice — once through a require* guard and again through the
 * module's scopeWhere() — and each resolution costs a JWT verification plus a
 * User+Role query. Deduplicating collapses that to one, which removes a database
 * round-trip from roughly eighty actions without changing any semantics: within
 * a single request the answer cannot legitimately differ.
 *
 * Scope is per request, so suspension, role changes and authVersion bumps still
 * take effect on the very next request — the revocation guarantee is unchanged.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const tokenUser = session?.user as SessionUser | undefined;
  if (!tokenUser?.id) return null;

  // JWT claims are a sign-in snapshot. Re-read the identity row so suspension,
  // disablement, role changes and company reassignment take effect immediately
  // on every protected server action instead of waiting for JWT expiry.
  const current = await prisma.user.findUnique({
    where: { id: tokenUser.id },
    include: { role: true },
  });
  if (
    !current ||
    current.status !== "active" ||
    tokenUser.authVersion !== current.authVersion ||
    current.kind !== current.role.kind ||
    (current.kind === "external" && !current.companyId)
  ) {
    return null;
  }

  return {
    id: current.id,
    role: current.role.key as Role,
    kind: current.kind,
    companyId: current.companyId,
    authVersion: current.authVersion,
    name: current.name,
    email: current.email,
  };
})

/** Server-side guard: throws UNAUTHENTICATED if there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/**
 * Server-side guard for internal-only data (e.g. the staff directory used for
 * owner name/avatar resolution and assignment pickers). Every internal role may
 * read it — that is a lookup, not user administration, so do NOT gate this on
 * the `users` section: business_dev/logistics/finance/rnd have it hidden and
 * would silently lose owner names across the whole app. External (client
 * portal) users are refused outright.
 */
export async function requireInternal(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isInternal(user.role)) throw new Error("FORBIDDEN");
  return user;
}

/**
 * Server-side action guard. Mirrors the lib/permissions matrix on the server —
 * the UI hides what a role cannot do, but the server is the authority.
 */
export async function requireAction(action: Action): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, action)) throw new Error("FORBIDDEN");
  return user;
}

/** Server-side section guard (route/handler authorization). Read access. */
export async function requireSection(section: Section): Promise<SessionUser> {
  const user = await requireUser();
  if (!canView(user.role, section)) throw new Error("FORBIDDEN");
  return user;
}

/**
 * Write guard for domains with no matching `Action` in the permissions enum
 * (tasks, products, activities, …). Requires edit-or-full on the section, so
 * management_readonly and view-only roles are refused.
 */
export async function requireSectionEdit(section: Section): Promise<SessionUser> {
  const user = await requireUser();
  if (!canEdit(user.role, section)) throw new Error("FORBIDDEN");
  return user;
}
