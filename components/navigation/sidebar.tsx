'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeft, ChevronRight } from 'lucide-react';
import { Link, usePathname } from '@/lib/i18n/navigation';
import type { Role } from '@/lib/types';
import { canView } from '@/lib/permissions';
import { INTERNAL_NAV } from '@/components/navigation/nav-config';
import { Logo } from '@/components/brand/logo';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { readStore, writeStore } from '@/lib/mock-services/storage';
import { cn } from '@/lib/utils';

/** Per-group collapse preference, `{[labelKey]: true}` meaning collapsed. Default: all expanded. */
const NAV_GROUPS_KEY = 'ui:nav-groups';

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
  const [groupCollapse, setGroupCollapse] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setGroupCollapse(readStore<Record<string, boolean>>(NAV_GROUPS_KEY, {}));
  }, []);

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(href + '/');
  }

  function toggleGroup(labelKey: string) {
    setGroupCollapse((prev) => {
      const next = { ...prev, [labelKey]: !prev[labelKey] };
      writeStore(NAV_GROUPS_KEY, next);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
        {collapsed ? <Logo variant="mark" href="/admin/companies" /> : <Logo tone="light" href="/admin/companies" />}
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

          // The active route's group must never end up invisible: this is a
          // render-time override only — it never writes back to the stored
          // preference, so a collapsed group that happens to contain the
          // current page still shows as collapsed everywhere else.
          const groupHasActive = items.some((item) => isActive(item.href));
          const storedCollapsed = !!(group.labelKey && groupCollapse[group.labelKey]);
          const expanded = !storedCollapsed || groupHasActive;
          const showItems = collapsed || expanded;
          const listId = `nav-group-${group.labelKey ?? gi}`;

          return (
            <div key={gi} className="space-y-0.5">
              {group.labelKey && !collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.labelKey!)}
                  aria-expanded={expanded}
                  aria-controls={listId}
                  className="flex w-full items-center gap-1 rounded-md px-2.5 pb-1 pt-1 text-2xs font-semibold uppercase tracking-wider text-sidebar-muted transition-colors hover:text-white"
                >
                  <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform duration-200', expanded && 'rotate-90')} />
                  <span className="truncate">{t(group.labelKey)}</span>
                </button>
              )}
              {group.labelKey && collapsed && gi > 0 && <div className="mx-2 my-2 border-t border-sidebar-border" />}
              {showItems && (
                <div id={listId} className="space-y-0.5">
                  {items.map((item) => {
                    const active = isActive(item.href);
                    const iconColor = active ? 'text-sidebar-accent' : cn(item.tint ?? 'text-sidebar-muted', 'group-hover:text-white');
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
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', iconColor)} />
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
              )}
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
