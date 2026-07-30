'use client';

import * as React from 'react';
import { KeyRound, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { changePassword } from '@/lib/services/auth.actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

/*
 * Change your own password.
 *
 * Lives here rather than inside the Settings page because `settings` is hidden
 * for every role except super_admin — which meant the six crm_admin users had no
 * way to change their own password at all. /admin/security is reachable by every
 * internal role, so this belongs beside the two-factor setup.
 */

const PASSWORD_ERROR_KEYS: Record<string, string> = {
  invalid_current_password: 'passwordErrorCurrent',
  weak_password: 'passwordErrorWeak',
  rate_limited: 'passwordErrorRateLimited',
  unauthenticated: 'passwordErrorGeneric',
};

export function ChangePasswordCard() {
  const t = useTranslations('AdminSettings');
  const [current, setCurrent] = React.useState('');
  const [next, setNext] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const canSubmit = current.length > 0 && next.length > 0 && confirm.length > 0 && !busy;

  async function submit() {
    if (!canSubmit) return;
    if (next !== confirm) {
      toast({ variant: 'danger', title: t('passwordErrorTitle'), description: t('passwordErrorMismatch') });
      return;
    }
    setBusy(true);
    const res = await changePassword(current, next).catch(() => ({ ok: false as const, error: undefined }));
    setBusy(false);
    if (res.ok) {
      setCurrent('');
      setNext('');
      setConfirm('');
      toast({ variant: 'success', title: t('passwordChangedTitle'), description: t('passwordChangedDescription') });
    } else {
      const key = (res.error && PASSWORD_ERROR_KEYS[res.error]) || 'passwordErrorGeneric';
      toast({ variant: 'danger', title: t('passwordErrorTitle'), description: t(key) });
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> {t('securityTitle')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('securityDescription')}</p>
      </CardHeader>
      <CardContent className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">{t('currentPassword')}</Label>
          <Input
            id="pw-current"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-next">{t('newPassword')}</Label>
          <Input
            id="pw-next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">{t('confirmPassword')}</Label>
          <Input
            id="pw-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button variant="gold" onClick={submit} disabled={!canSubmit}>
          <Save /> {busy ? t('changingPassword') : t('changePasswordButton')}
        </Button>
      </CardContent>
    </Card>
  );
}
