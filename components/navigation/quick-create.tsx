'use client';

import { useTranslations } from 'next-intl';
import { Plus, Building2, ListChecks, Workflow, FlaskConical, type LucideIcon } from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { can, canEdit } from '@/lib/permissions';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface QuickCreateEntry {
  key: 'company' | 'task' | 'opportunity' | 'sample';
  href: string;
  icon: LucideIcon;
  allowed: boolean;
}

/**
 * Topbar "+" menu — jumps straight to a module's own create dialog via
 * `?new=1` (see the four admin pages, which open their existing dialog and
 * strip the param on mount). Each entry is gated by the exact same check the
 * target page uses for its own create button, so nothing appears here that
 * the page itself would refuse.
 */
export function QuickCreate() {
  const t = useTranslations('QuickCreate');
  const router = useRouter();
  const { session } = useSession();
  const role = session?.role;

  const allEntries: QuickCreateEntry[] = [
    { key: 'company', href: '/admin/companies', icon: Building2, allowed: !!role && can(role, 'company.create') },
    { key: 'task', href: '/admin/tasks', icon: ListChecks, allowed: !!role && canEdit(role, 'tasks') },
    { key: 'opportunity', href: '/admin/pipeline', icon: Workflow, allowed: !!role && canEdit(role, 'pipeline') },
    { key: 'sample', href: '/admin/samples', icon: FlaskConical, allowed: !!role && canEdit(role, 'samples') },
  ];
  const entries = allEntries.filter((entry) => entry.allowed);

  if (entries.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex h-9 min-h-11 w-9 min-w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors',
          'hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent',
        )}
        aria-label={t('label')}
      >
        <Plus className="h-5 w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
        {entries.map((entry) => (
          <DropdownMenuItem key={entry.key} onSelect={() => router.push(`${entry.href}?new=1`)}>
            <entry.icon />
            {t(entry.key)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
