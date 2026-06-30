'use client';

import { useTranslations } from 'next-intl';
import { Menu, Bell } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { AccountMenu } from '@/components/navigation/account-menu';
import { GlobalSearch } from '@/components/navigation/global-search';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const tc = useTranslations('Common');

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur">
      <button
        onClick={onMenuClick}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Global search (Cmd/Ctrl+K) */}
      <GlobalSearch />

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle tone="dark" />
        <LanguageSwitcher tone="dark" />
        <Link
          href="/admin/notifications"
          className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent"
          aria-label={tc('notifications')}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
        </Link>
        <AccountMenu />
      </div>
    </header>
  );
}
