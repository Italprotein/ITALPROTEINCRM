import { auth } from "@/auth";
import { can, canView, type Action, type Section } from "@/lib/permissions";
import type { Role } from "@/lib/types";

export interface SessionUser {
  id: string;
  role: Role;
  kind: "internal" | "external";
  companyId: string | null;
  name?: string | null;
  email?: string | null;
}

/** Returns the authenticated user (from the verified session) or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** Server-side guard: throws UNAUTHENTICATED if there is no session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
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

/** Server-side section guard (route/handler authorization). */
export async function requireSection(section: Section): Promise<SessionUser> {
  const user = await requireUser();
  if (!canView(user.role, section)) throw new Error("FORBIDDEN");
  return user;
}
