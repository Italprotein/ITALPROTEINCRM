import type { DemoAccount, DemoSession, Role } from '@/lib/types';
import { DEMO_ACCOUNTS } from '@/fixtures/users';
import { workspaceOf } from '@/lib/permissions';
import { readStore, writeStore, clearStore } from './storage';

const SESSION_KEY = 'session';

/**
 * Demo authentication. There is NO real auth in this phase — the user simply
 * "signs in as" a seeded account to preview a role. The real backend will
 * replace this with invitation-based access, email verification, MFA and
 * server-side sessions (see docs/BACKEND_HANDOFF.md).
 */
export const authService = {
  listAccounts(): DemoAccount[] {
    return DEMO_ACCOUNTS;
  },

  listInternalAccounts(): DemoAccount[] {
    return DEMO_ACCOUNTS.filter((a) => a.workspace === 'internal');
  },

  listExternalAccounts(): DemoAccount[] {
    return DEMO_ACCOUNTS.filter((a) => a.workspace === 'external');
  },

  getAccount(id: string): DemoAccount | undefined {
    return DEMO_ACCOUNTS.find((a) => a.id === id);
  },

  getSession(): DemoSession | null {
    return readStore<DemoSession | null>(SESSION_KEY, null);
  },

  getCurrentAccount(): DemoAccount | null {
    const session = this.getSession();
    if (!session) return null;
    return this.getAccount(session.accountId) ?? null;
  },

  signInAs(accountId: string): DemoSession | null {
    const account = this.getAccount(accountId);
    if (!account) return null;
    const session: DemoSession = {
      accountId: account.id,
      role: account.role,
      workspace: account.workspace,
      companyId: account.companyId,
      startedAt: new Date().toISOString(),
    };
    writeStore(SESSION_KEY, session);
    return session;
  },

  switchRole(role: Role): DemoSession | null {
    // Convenience for the in-app role switcher: jump to the first demo account
    // with the requested role (same company for external roles).
    const current = this.getSession();
    const candidates = DEMO_ACCOUNTS.filter((a) => a.role === role);
    const match =
      current?.companyId && workspaceOf(role) === 'external'
        ? candidates.find((a) => a.companyId === current.companyId) ?? candidates[0]
        : candidates[0];
    return match ? this.signInAs(match.id) : null;
  },

  getAccountByEmail(email: string): DemoAccount | undefined {
    const e = email.trim().toLowerCase();
    return DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === e);
  },

  signInByEmail(email: string): DemoSession | null {
    const account = this.getAccountByEmail(email);
    return account ? this.signInAs(account.id) : null;
  },

  signOut(): void {
    clearStore(SESSION_KEY);
  },
};

export type AuthService = typeof authService;
