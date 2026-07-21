'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Bell } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { isExternal, canView } from '@/lib/permissions';
import { companyService } from '@/lib/mock-services';
import type { Company } from '@/lib/types';
import { PORTAL_NAV } from '@/components/navigation/nav-config';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { AccountMenu } from '@/components/navigation/account-menu';
import { Amina } from '@/components/assistant/amina';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { setLabelLocale } from '@/lib/labels';

export function PortalShell({ children }: { children: React.ReactNode }) {
  setLabelLocale(useLocale()); // keep data-value labels (statuses, stages, types) in sync with the UI locale
  const t = useTranslations('PortalNav');
  const tc = useTranslations('Common');
  const { session, account, ready } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [company, setCompany] = React.useState<Company | null>(null);

  React.useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/login');
    else if (!isExternal(session.role)) router.replace('/admin');
  }, [ready, session, router]);

  React.useEffect(() => {
    if (session?.companyId) companyService.get(session.companyId).then((c) => setCompany(c ?? null));
  }, [session?.companyId]);

  if (!ready || !session || !account || !isExternal(session.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Logo tone="dark" />
      </div>
    );
  }

  const navItems = PORTAL_NAV.filter((item) => canView(session.role, item.section));
  function isActive(href: string) {
    if (href === '/portal') return pathname === '/portal';
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center gap-4">
          <Logo tone="dark" />
          <Badge variant="secondary" className="hidden sm:inline-flex">{tc('externalWorkspace')}</Badge>
          {company && (
            <span className="hidden truncate text-sm font-medium text-muted-foreground md:inline">
              {company.tradingName ?? company.legalName}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle tone="dark" />
            <LanguageSwitcher tone="dark" />
            <Link href="/portal/notifications" className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent" aria-label={tc('notifications')}>
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
            </Link>
            <AccountMenu />
          </div>
        </div>
        {/* Horizontal nav */}
        <div className="border-t">
          <nav className="scrollbar-hide container flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.section}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-brand-gold text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="container py-8">{children}</div>
      </main>

      <footer className="border-t bg-background py-6">
        <div className="container text-2xs text-muted-foreground">
          {tc('company')} — Proamina® {new Date().getFullYear()}
        </div>
      </footer>

      {/* Amina Partner — the API scopes every answer to this user's company. */}
      <Amina />
    </div>
  );
}
