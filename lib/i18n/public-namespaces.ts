/**
 * Namespace allow-lists for the payload splits behind the (public) and
 * portal route groups. The root layout used to hand every route the full
 * 51-namespace message catalogue (~97 KB serialized) via one
 * `NextIntlClientProvider` — the public landing/auth screens only ever read
 * ~10 KB of it, and the admin-only namespaces (`AdminCompanies`,
 * `AdminSettings`, …) have no business shipping to an anonymous visitor at
 * all. Each route group now mounts its own provider, scoped to the
 * namespaces that group's client components actually consume, via
 * `pickMessages`.
 *
 * The internal CRM (`admin/layout.tsx`) keeps the full catalogue — it
 * genuinely uses all of it.
 */

/** Landing page + the six auth screens (login, team-login, register, verify, forgot-password, activate). */
export const PUBLIC_NAMESPACES = [
  'Common',
  'Landing',
  'Public',
  'Access',
  'Login',
  'TeamLogin',
  'Register',
  'Verify',
  'ForgotPassword',
  'ActivateAccount',
  'Errors',
] as const;

/** The external company portal. */
export const PORTAL_NAMESPACES = ['PortalNav', 'Common', 'Roles', 'Amina'] as const;

/**
 * Plain filter — keeps only the top-level namespace keys named in
 * `namespaces` that are actually present on `messages`. No lodash: this is
 * the entire dependency.
 */
export function pickMessages<M extends Record<string, unknown>>(
  messages: M,
  namespaces: readonly string[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const namespace of namespaces) {
    if (Object.prototype.hasOwnProperty.call(messages, namespace)) {
      picked[namespace] = messages[namespace];
    }
  }
  return picked;
}
