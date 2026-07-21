'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { isInternal } from '@/lib/permissions';
import { readStore, writeStore } from '@/lib/mock-services/storage';
import { Sidebar } from '@/components/navigation/sidebar';
import { Topbar } from '@/components/navigation/topbar';
import { Amina } from '@/components/assistant/amina';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/utils';
import { setLabelLocale } from '@/lib/labels';

const COLLAPSE_KEY = 'ui:sidebar-collapsed';

export function AppShell({ children }: { children: React.ReactNode }) {
  setLabelLocale(useLocale()); // keep data-value labels (statuses, stages, types) in sync with the UI locale
  const { session, account, ready } = useSession();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => { setCollapsed(readStore<boolean>(COLLAPSE_KEY, false)); }, []);

  // Demo route guard (client-side only — real enforcement is server-side later).
  React.useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/team-login');
    else if (!isInternal(session.role)) router.replace('/portal');
  }, [ready, session, router]);

  function toggleCollapse() {
    setCollapsed((c) => { writeStore(COLLAPSE_KEY, !c); return !c; });
  }

  if (!ready || !session || !account || !isInternal(session.role)) {
    return <ShellLoading />;
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:block',
          collapsed ? 'w-[4.75rem]' : 'w-64',
        )}
      >
        <Sidebar role={session.role} collapsed={collapsed} onToggle={toggleCollapse} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 shadow-xl animate-fade-in">
            <Sidebar role={session.role} collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1">{children}</main>
      </div>

      {/* Amina Team — the API derives the internal audience from the session. */}
      <Amina />
    </div>
  );
}

function ShellLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-navy">
      <div className="flex flex-col items-center gap-4">
        <Logo tone="light" />
        <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-shimmer rounded-full bg-brand-gold" />
        </div>
      </div>
    </div>
  );
}
