'use client';

import * as React from 'react';
import type { DemoAccount, DemoSession, Role } from '@/lib/types';
import { authService } from '@/lib/mock-services';

interface SessionContextValue {
  session: DemoSession | null;
  account: DemoAccount | null;
  /** Resolved once we've read localStorage on the client (avoids SSR flicker). */
  ready: boolean;
  signInAs: (accountId: string) => void;
  switchRole: (role: Role) => void;
  signOut: () => void;
  refresh: () => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<DemoSession | null>(null);
  const [account, setAccount] = React.useState<DemoAccount | null>(null);
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

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
