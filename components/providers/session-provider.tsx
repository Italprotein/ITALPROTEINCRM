'use client';

import * as React from 'react';
import {
  SessionProvider as NextAuthSessionProvider,
  useSession as useAuthSession,
  signOut as authSignOut,
} from 'next-auth/react';
import type { UserAccount, UserSession, Role } from '@/lib/types';
import { authService } from '@/lib/mock-services';

// Real auth (Auth.js) drives the session after the backend cutover; otherwise
// the demo "sign in as" preview session is used. NEXT_PUBLIC so it is readable
// on the client — switching modes requires a rebuild / dev restart.
const isApi = (process.env.NEXT_PUBLIC_DATA_MODE ?? 'mock') === 'api';

interface SessionContextValue {
  session: UserSession | null;
  account: UserAccount | null;
  /** Resolved once the session is known on the client (avoids SSR flicker). */
  ready: boolean;
  signInAs: (accountId: string) => void;
  switchRole: (role: Role) => void;
  signOut: () => void;
  refresh: () => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

/* ── Mock / demo session (localStorage-backed preview) ─────────────────────── */
function MockSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<UserSession | null>(null);
  const [account, setAccount] = React.useState<UserAccount | null>(null);
  const [ready, setReady] = React.useState(false);

  const sync = React.useCallback(() => {
    const s = authService.getSession();
    setSession(s);
    setAccount(s ? authService.getAccount(s.accountId) ?? null : null);
    setReady(true);
  }, []);

  React.useEffect(() => {
    sync();
    const onStore = () => sync();
    window.addEventListener('italprotein-store', onStore);
    window.addEventListener('storage', onStore);
    return () => {
      window.removeEventListener('italprotein-store', onStore);
      window.removeEventListener('storage', onStore);
    };
  }, [sync]);

  const value: SessionContextValue = {
    session,
    account,
    ready,
    signInAs: (id) => { authService.signInAs(id); sync(); },
    switchRole: (role) => { authService.switchRole(role); sync(); },
    signOut: () => { authService.signOut(); sync(); },
    refresh: sync,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/* ── Real auth bridge — maps the Auth.js session into the same context shape ── */
function ApiSessionBridge({ children }: { children: React.ReactNode }) {
  const { data, status } = useAuthSession();
  const user = data?.user ?? null;

  const value = React.useMemo<SessionContextValue>(() => {
    const name = user?.name ?? user?.email ?? '';
    const session: UserSession | null = user
      ? {
          accountId: user.id,
          role: user.role,
          workspace: user.kind === 'internal' ? 'internal' : 'external',
          companyId: user.companyId ?? undefined,
          startedAt: '',
        }
      : null;
    const account: UserAccount | null = user
      ? {
          id: user.id,
          workspace: user.kind === 'internal' ? 'internal' : 'external',
          role: user.role,
          firstName: name.split(' ')[0] || 'User',
          lastName: name.split(' ').slice(1).join(' '),
          email: user.email ?? '',
          jobTitle: '',
          blurb: '',
          companyId: user.companyId ?? undefined,
        }
      : null;

    return {
      session,
      account,
      ready: status !== 'loading',
      signInAs: () => {}, // real sign-in happens via the login form (signIn)
      switchRole: () => {}, // role switching is a demo-only affordance
      signOut: () => { void authSignOut({ redirectTo: '/' }); },
      refresh: () => {}, // next-auth manages session refresh
    };
  }, [user, status]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  if (isApi) {
    return (
      <NextAuthSessionProvider>
        <ApiSessionBridge>{children}</ApiSessionBridge>
      </NextAuthSessionProvider>
    );
  }
  return <MockSessionProvider>{children}</MockSessionProvider>;
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
