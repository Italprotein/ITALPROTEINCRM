'use client';

import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { Link, usePathname } from '@/lib/i18n/navigation';
import type { Role } from '@/lib/types';
import { canView } from '@/lib/permissions';
import { INTERNAL_NAV } from '@/components/navigation/nav-config';
import { Logo } from '@/components/brand/logo';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SidebarProps {
  role: Role;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ role, collapsed, onToggle, onNavigate }: SidebarProps) {
  const t = useTranslations('Nav');
  const tc = useTranslations('Common');
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        {collapsed ? <Logo variant="mark" /> : <Logo tone="light" />}
        <button
          onClick={onToggle}
          className="hidden rounded-md p-1.5 text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white lg:block"
          aria-label={collapsed ? tc('expand') : tc('collapse')}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {INTERNAL_NAV.map((group, gi) => {
          const items = group.items.filter((item) => canView(role, item.section));
          if (items.length === 0) return null;
          return (
            <div key={gi} className="space-y-0.5">
              {group.labelKey && !collapsed && (
                <p className="px-2.5 pb-1 pt-1 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">
                  {t(group.labelKey)}
                </p>
              )}
              {group.labelKey && collapsed && gi > 0 && <div className="mx-2 my-2 border-t border-sidebar-border" />}
              {items.map((item) => {
                const active = isActive(item.href);
                const link = (
                  <Link
                    key={item.section}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      collapsed && 'justify-center',
                      active
                        ? 'bg-sidebar-active text-white'
                        : 'text-sidebar-foreground hover:bg-white/5 hover:text-white',
                    )}
                  >
                    {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-accent" />}
                    <item.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-sidebar-accent' : 'text-sidebar-muted group-hover:text-white')} />
                    {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                  </Link>
                );
                return collapsed ? (
                  <Tooltip key={item.section}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className="rounded-lg bg-white/5 px-3 py-2 text-2xs text-sidebar-muted">
            {tc('appName')}
          </div>
        </div>
      )}
    </div>
  );
}
