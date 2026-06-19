'use client';

import { useTranslations } from 'next-intl';
import { ChevronsUpDown, LogOut, Repeat, Home, BadgeCheck, RotateCcw } from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { authService } from '@/lib/mock-services';
import { resetDemoData } from '@/lib/demo';
import type { Role, Workspace } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/utils';

function rolesFor(workspace: Workspace): Role[] {
  const accounts = workspace === 'internal' ? authService.listInternalAccounts() : authService.listExternalAccounts();
  return [...new Set(accounts.map((a) => a.role))];
}

export function AccountMenu({ tone = 'dark' }: { tone?: 'light' | 'dark' }) {
  const t = useTranslations('Common');
  const tr = useTranslations('Roles');
  const router = useRouter();
  const { account, switchRole, signOut } = useSession();

  if (!account) return null;
  const roles = rolesFor(account.workspace);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent">
        <Avatar className="h-8 w-8">
          <AvatarFallback style={{ backgroundColor: account.avatarColor, color: '#fff' }} className="text-2xs">
            {initials(`${account.firstName} ${account.lastName}`)}
          </AvatarFallback>
        </Avatar>
        <div className="hidden text-left md:block">
          <p className="text-sm font-medium leading-none">{account.firstName} {account.lastName}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">{tr(account.role)}</p>
        </div>
        <ChevronsUpDown className="hidden h-4 w-4 text-muted-foreground md:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="normal-case">
          <div className="flex items-center gap-3 py-1">
            <Avatar className="h-9 w-9">
              <AvatarFallback style={{ backgroundColor: account.avatarColor, color: '#fff' }} className="text-2xs">
                {initials(`${account.firstName} ${account.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{account.firstName} {account.lastName}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{account.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <div className="px-2 pb-1.5">
          <Badge variant={account.workspace === 'internal' ? 'secondary' : 'gold'}>
            <BadgeCheck className="h-3 w-3" /> {tr(account.role)}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger><Repeat className="mr-2 h-4 w-4" /> {t('demoMode')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            <DropdownMenuLabel>{account.workspace === 'internal' ? t('internalWorkspace') : t('externalWorkspace')}</DropdownMenuLabel>
            {roles.map((role) => (
              <DropdownMenuItem key={role} onClick={() => switchRole(role)} className={role === account.role ? 'bg-accent' : ''}>
                {tr(role)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={() => router.push('/')}><Home className="mr-2 h-4 w-4" /> {t('backToHome')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => resetDemoData()}><RotateCcw className="mr-2 h-4 w-4" /> Reset demo data</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { signOut(); router.push('/login'); }} className="text-danger focus:text-danger">
          <LogOut className="mr-2 h-4 w-4" /> {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
