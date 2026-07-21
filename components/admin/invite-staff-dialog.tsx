'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, MailPlus } from 'lucide-react';

import type { InternalRole } from '@/lib/types';
import type { StaffMember } from '@/fixtures/staff';
import { getLabel } from '@/lib/labels';
import { inviteStaff } from '@/lib/services/user.actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { useSession } from '@/components/providers/session-provider';

const ROLES: InternalRole[] = [
  'super_admin',
  'crm_admin',
  'business_dev',
  'rnd_technical',
  'logistics',
  'finance',
  'management_readonly',
];

export function InviteStaffDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (user: StaffMember) => void;
}) {
  const t = useTranslations('AdminUsers');
  const { account } = useSession();
  const availableRoles = account?.role === 'super_admin'
    ? ROLES
    : ROLES.filter((item) => item !== 'super_admin');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<InternalRole>('business_dev');
  const [busy, setBusy] = React.useState(false);

  function reset() {
    setFirstName('');
    setLastName('');
    setEmail('');
    setRole('business_dev');
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await inviteStaff({ firstName, lastName, email, role });
      onInvited(result.user);
      onOpenChange(false);
      reset();
      toast({
        variant: result.delivery.ok ? 'success' : 'warning',
        title: result.delivery.ok ? t('inviteSentTitle') : t('invitePendingTitle'),
        description: result.delivery.ok
          ? t('inviteSentDescription', { email: result.user.email })
          : t('invitePendingDescription', { email: result.user.email }),
      });
    } catch {
      toast({
        variant: 'danger',
        title: t('inviteFailedTitle'),
        description: t('inviteFailedDescription'),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('inviteDialogTitle')}</DialogTitle>
          <DialogDescription>{t('inviteDialogDescription')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-first-name">{t('firstNameLabel')}</Label>
              <Input
                id="invite-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                autoComplete="given-name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-last-name">{t('lastNameLabel')}</Label>
              <Input
                id="invite-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                autoComplete="family-name"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">{t('emailLabel')}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('roleLabel')}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as InternalRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableRoles.map((item) => (
                  <SelectItem key={item} value={item}>{getLabel('role', item)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!firstName.trim() || !lastName.trim() || !email.trim() || busy}
              className="gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
              {busy ? t('sendingInvite') : t('sendInvite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
