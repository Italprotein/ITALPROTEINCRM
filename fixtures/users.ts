import type { UserAccount } from '@/lib/types';

/**
 * The Italprotein admin team — the only people with system access. These mirror
 * the real users seeded into the database (see prisma/seed.ts + data/admins.json);
 * passwords live only in the database, never here.
 */
export const TEAM_ACCOUNTS: UserAccount[] = [
  { id: 'u_medamine', workspace: 'internal', role: 'super_admin', firstName: 'Amine', lastName: 'Abidi', email: 'labidimedamine53@gmail.com', jobTitle: 'Administrator', avatarColor: '#e11d48', blurb: 'Full system access — Italprotein admin.' },
  { id: 'u_ahmed', workspace: 'internal', role: 'super_admin', firstName: 'Ahmed', lastName: 'Abid', email: 'ahmedabuniv@gmail.com', jobTitle: 'Administrator', avatarColor: '#0eb89a', blurb: 'Full system access — Italprotein admin.' },
  { id: 'u_simone', workspace: 'internal', role: 'super_admin', firstName: 'Simone', lastName: 'Coletta', email: 'simocolett@gmail.com', jobTitle: 'Administrator', avatarColor: '#1e3a5f', blurb: 'Full system access — Italprotein admin.' },
  { id: 'u_giuseppe', workspace: 'internal', role: 'super_admin', firstName: 'Giuseppe', lastName: 'Minelli', email: 'giuseppeminelli@wefin.it', jobTitle: 'Administrator', avatarColor: '#c9a227', blurb: 'Full system access — Italprotein admin.' },
  { id: 'u_tomasso', workspace: 'internal', role: 'super_admin', firstName: 'Tomasso', lastName: 'Pitarello', email: 'tpittarello@gmail.com', jobTitle: 'Administrator', avatarColor: '#2563eb', blurb: 'Full system access — Italprotein admin.' },
  { id: 'u_matteo', workspace: 'internal', role: 'super_admin', firstName: 'Matteo', lastName: 'Pitarello', email: 'matteo.pittarello@gmail.com', jobTitle: 'Administrator', avatarColor: '#6f8a6b', blurb: 'Full system access — Italprotein admin.' },
  { id: 'u_ludwig', workspace: 'internal', role: 'super_admin', firstName: 'Ludwig', lastName: 'Becker', email: 'ludwigvanbecker.3@gmail.com', jobTitle: 'Administrator', avatarColor: '#a07c1a', blurb: 'Full system access — Italprotein admin.' },

  /* ───────── External portal demo — registered company (mock mode only) ─────────
   * Scoped to the showcase company c_proteinworks. Lets you preview the /portal
   * side by signing in with this email at /login. No such account exists in the
   * real database; provisioning happens when a registration is approved. */
  { id: 'u_pw_owner', workspace: 'external', role: 'company_owner', companyId: 'c_proteinworks', firstName: 'Sofia', lastName: 'Wade', email: 'owner@theproteinworks.com', jobTitle: 'Head of Product', avatarColor: '#1f6feb', blurb: 'Portal owner — The Protein Works (demo company).' },
];

export function getTeamAccounts(): UserAccount[] {
  return TEAM_ACCOUNTS;
}
