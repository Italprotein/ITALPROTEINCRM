'use client';

import { Menu } from 'lucide-react';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { AccountMenu } from '@/components/navigation/account-menu';
import { GlobalSearch } from '@/components/navigation/global-search';
import { NotificationPopover } from '@/components/navigation/notification-popover';
import { QuickCreate } from '@/components/navigation/quick-create';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
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
        <QuickCreate />
        <ThemeToggle tone="dark" />
        <LanguageSwitcher tone="dark" />
        <NotificationPopover />
        <AccountMenu />
      </div>
    </header>
  );
}
