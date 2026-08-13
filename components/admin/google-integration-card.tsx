'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Mail, RefreshCw, ShieldCheck, Unplug, CalendarDays } from 'lucide-react';

import { emailService } from '@/lib/mock-services';
import type { GmailConnectionStatus } from '@/lib/types';
import { useSession } from '@/components/providers/session-provider';
import { can } from '@/lib/permissions';
import { formatRelative } from '@/lib/formatting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

/*
 * The shared ad@italprotein.com Google connection.
 *
 * One mailbox for the whole company, not one per user: sync, NDA auto-filing
 * and outbound mail all run from it. Any CRM admin can connect or reconnect —
 * that is operational work — but only super_admin can disconnect, since doing so
 * breaks the integration for everyone.
 */
export function GoogleIntegrationCard() {
  const t = useTranslations('AdminSettings');
  const { session } = useSession();
  const role = session?.role;
  const canManage = !!role && can(role, 'integrations.manage');
  const canDisconnect = !!role && can(role, 'settings.edit');

  const [gmail, setGmail] = React.useState<GmailConnectionStatus | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    emailService.status().then(setGmail).catch(() => undefined);
  }, []);
  React.useEffect(load, [load]);

  async function sync() {
    setBusy(true);
    const res = await emailService.sync();
    setBusy(false);
    load();
    if (res.ok) {
      toast({
        variant: 'success',
        title: t('gmailSyncDoneTitle'),
        description: t('gmailSyncDoneDescription', { created: res.created }),
      });
    } else {
      toast({ variant: 'danger', title: t('gmailErrorToastTitle'), description: t('gmailSyncFailed') });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Mail className="h-4 w-4" /> {t('gmailTitle')}
          <Badge variant="secondary" className="gap-1">
            <CalendarDays className="h-3 w-3" /> + Calendar
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('gmailDescription')}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {gmail?.connected ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-3">
              <ShieldCheck className="h-4 w-4 shrink-0 text-success-text" />
              <p className="text-sm font-medium text-foreground">
                {t('gmailConnected', { email: gmail.email ?? '' })}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <p>
                {gmail.lastSyncedAt
                  ? t('gmailLastSync', { time: formatRelative(gmail.lastSyncedAt) })
                  : t('gmailNeverSynced')}
              </p>
              <p>{t('gmailInboxCount', { count: gmail.inboxCount ?? 0 })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <>
                  <Button variant="outline" onClick={sync} disabled={busy}>
                    <RefreshCw className={busy ? 'animate-spin' : undefined} /> {t('gmailSyncNow')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.location.href = '/api/auth/google/start';
                    }}
                  >
                    <Mail /> {t('reconnectGmail')}
                  </Button>
                </>
              )}
              {canDisconnect && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    await emailService.disconnect();
                    load();
                    toast({ variant: 'info', title: t('gmailDisconnectedToast') });
                  }}
                >
                  <Unplug /> {t('disconnectGmail')}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              {gmail?.email ? t('gmailExpired', { email: gmail.email }) : t('gmailNotConnectedHint')}
            </p>
            {canManage ? (
              <Button
                variant="gold"
                onClick={() => {
                  window.location.href = '/api/auth/google/start';
                }}
              >
                <Mail /> {gmail?.email ? t('reconnectGmail') : t('connectGmail')}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t('gmailNoPermission')}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
