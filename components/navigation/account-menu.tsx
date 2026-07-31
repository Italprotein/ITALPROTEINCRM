'use client';

import { useTranslations } from 'next-intl';
import { ChevronsUpDown, LogOut, Repeat, BadgeCheck, RotateCcw, ShieldCheck, Camera, Loader2 } from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { authService } from '@/lib/mock-services';
import { resetLocalData } from '@/lib/local-store';
import type { Role, Workspace } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/utils';
import { isApiMode } from '@/lib/data-mode';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import * as React from 'react';

const isApi = isApiMode;

function rolesFor(workspace: Workspace): Role[] {
  // In api mode the role switcher is hidden, so never touch the fixture-backed authService.
  if (isApi) return [];
  const accounts = workspace === 'internal' ? authService.listInternalAccounts() : authService.listExternalAccounts();
  return [...new Set(accounts.map((a) => a.role))];
}

export function AccountMenu({ tone = 'dark' }: { tone?: 'light' | 'dark' }) {
  const t = useTranslations('Common');
  const tr = useTranslations('Roles');
  const router = useRouter();
  const { account, switchRole, signOut } = useSession();
  const [pictureOpen, setPictureOpen] = React.useState(false);
  const [avatar, setAvatar] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!isApi || !account) return;
    void fetch('/api/profile/avatar', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setAvatar(data?.image ?? null));
  }, [account]);

  async function uploadPicture(file: File) {
    setUploading(true);
    const form = new FormData();
    form.set('image', file);
    const response = await fetch('/api/profile/avatar', { method: 'POST', body: form });
    const data = await response.json();
    setUploading(false);
    if (!response.ok) {
      toast({ variant: 'danger', title: 'Picture not changed', description: 'Use a JPG, PNG or WebP image under 2 MB.' });
      return;
    }
    setAvatar(data.image);
    setPictureOpen(false);
    toast({ variant: 'success', title: 'Profile picture updated' });
  }

  if (!account) return null;
  const roles = rolesFor(account.workspace);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent">
        <Avatar className="h-8 w-8">
          {avatar && <AvatarImage src={avatar} alt="" />}
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
              {avatar && <AvatarImage src={avatar} alt="" />}
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
        {!isApi && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger><Repeat className="mr-2 h-4 w-4" /> {t('switchRole')}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuLabel>{account.workspace === 'internal' ? t('internalWorkspace') : t('externalWorkspace')}</DropdownMenuLabel>
              {roles.map((role) => (
                <DropdownMenuItem key={role} onClick={() => switchRole(role)} className={role === account.role ? 'bg-accent' : ''}>
                  {tr(role)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {/* Own-account security (2FA). Internal only — the portal has no
            enrollment flow yet, and mock mode has no real credentials. */}
        {isApi && account.workspace === 'internal' && (
          <DropdownMenuItem onClick={() => router.push('/admin/security')}>
            <ShieldCheck className="mr-2 h-4 w-4" /> {t('security')}
          </DropdownMenuItem>
        )}
        {isApi && (
          <DropdownMenuItem onSelect={() => setPictureOpen(true)}>
            <Camera className="mr-2 h-4 w-4" /> Change picture
          </DropdownMenuItem>
        )}
        {/* "Back to home" removed: it navigated to the public marketing site,
            which is rarely what a signed-in user wants. The ITALPROTEIN lockup
            in the sidebar/header now goes to each area's own home instead. */}
        {!isApi && (
          <DropdownMenuItem onClick={() => resetLocalData()}><RotateCcw className="mr-2 h-4 w-4" /> {t('resetLocalData')}</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { signOut(); router.push(account.workspace === 'internal' ? '/team-login' : '/login'); }} className="text-danger focus:text-danger">
          <LogOut className="mr-2 h-4 w-4" /> {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <Dialog open={pictureOpen} onOpenChange={setPictureOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change profile picture</DialogTitle>
            <DialogDescription>Choose a JPG, PNG or WebP image up to 2 MB.</DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer flex-col items-center gap-4 rounded-xl border border-dashed p-8 text-center hover:bg-muted/40">
            <Avatar className="h-20 w-20">
              {avatar && <AvatarImage src={avatar} alt="" />}
              <AvatarFallback style={{ backgroundColor: account.avatarColor, color: '#fff' }}>
                {initials(`${account.firstName} ${account.lastName}`)}
              </AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline" disabled={uploading} asChild>
              <span>{uploading ? <Loader2 className="animate-spin" /> : <Camera />} {uploading ? 'Uploading…' : 'Choose picture'}</span>
            </Button>
            <input
              className="hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadPicture(file);
              }}
            />
          </label>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}
