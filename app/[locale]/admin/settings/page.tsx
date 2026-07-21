'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  SlidersHorizontal, Users2, Database, Save, RotateCcw, Palette, BellRing, Building2,
  ShieldCheck, KeyRound, Mail, Unplug, RefreshCw,
} from 'lucide-react';
import {
  companyService, sampleService, ndaService, documentService, taskService, userService, emailService,
} from '@/lib/mock-services';
import type { GmailConnectionStatus } from '@/lib/types';
import { changePassword } from '@/lib/services/auth.actions';
import { resetLocalData } from '@/lib/local-store';
import { INTERNAL_NAV } from '@/components/navigation/nav-config';
import { formatRelative } from '@/lib/formatting';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { isApiMode } from '@/lib/data-mode';

const NOTIF_PREFS = [
  'notifNewRegistrations', 'notifNdaStatusChanges', 'notifNewSampleRequests',
  'notifShipmentDispatchedDelivered', 'notifDeliveryDelays', 'notifFeedbackReceived',
  'notifTaskReminders', 'notifInvoiceOverdue',
] as const;

const MODULE_COUNT = INTERNAL_NAV.reduce((n, group) => n + group.items.length, 0);

const PASSWORD_ERROR_KEYS: Record<string, string> = {
  invalid_current_password: 'passwordErrorInvalidCurrent',
  weak_password: 'passwordErrorWeak',
  rate_limited: 'passwordErrorRateLimited',
};

export default function SettingsPage() {
  const t = useTranslations('AdminSettings');
  const [counts, setCounts] = React.useState<{ records: number; team: number } | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const isApi = isApiMode;

  // General form state
  const [orgName, setOrgName] = React.useState('Italprotein Srl');
  const [currency, setCurrency] = React.useState('EUR');
  const [language, setLanguage] = React.useState('en');
  const [timezone, setTimezone] = React.useState('Europe/Rome');
  const [density, setDensity] = React.useState('comfortable');

  const [gmail, setGmail] = React.useState<GmailConnectionStatus | null>(null);

  const loadGmail = React.useCallback(() => {
    emailService.status().then(setGmail);
  }, []);

  React.useEffect(() => {
    Promise.all([
      companyService.list(), sampleService.list(), ndaService.list(),
      documentService.list(), taskService.list(), userService.getStatistics(),
    ]).then(([c, s, n, d, t, u]) => {
      setCounts({ records: c.length + s.length + n.length + d.length + t.length, team: u.total });
    });
    loadGmail();
  }, [loadGmail]);

  // Toast the outcome of the Google OAuth round-trip (?gmail=connected|error|denied|not_configured).
  React.useEffect(() => {
    const result = new URLSearchParams(window.location.search).get('gmail');
    if (!result) return;
    window.history.replaceState(null, '', window.location.pathname);
    if (result === 'connected') {
      toast({ variant: 'success', title: t('gmailConnectedToastTitle'), description: t('gmailConnectedToastDescription') });
    } else if (result === 'not_configured') {
      toast({ variant: 'danger', title: t('gmailErrorToastTitle'), description: t('gmailNotConfiguredToast') });
    } else {
      toast({ variant: 'danger', title: t('gmailErrorToastTitle'), description: t('gmailErrorToastDescription') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    toast({ variant: 'success', title: t('toastSavedTitle'), description: t('toastSavedDescription') });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('statModulesEnabled')} value={MODULE_COUNT} icon={SlidersHorizontal} tone="gold" />
        <StatCard label={t('statTeamMembers')} value={counts?.team ?? 0} icon={Users2} tone="info" delay={0.05} />
        <StatCard label={t('statDataRecords')} value={counts?.records ?? 0} icon={Database} tone="success" delay={0.1} />
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general"><Building2 className="mr-1.5 h-4 w-4" /> {t('tabGeneral')}</TabsTrigger>
          {isApi && <TabsTrigger value="security"><ShieldCheck className="mr-1.5 h-4 w-4" /> {t('tabSecurity')}</TabsTrigger>}
          {isApi && <TabsTrigger value="integrations"><Mail className="mr-1.5 h-4 w-4" /> {t('tabIntegrations')}</TabsTrigger>}
          <TabsTrigger value="notifications"><BellRing className="mr-1.5 h-4 w-4" /> {t('tabNotifications')}</TabsTrigger>
          <TabsTrigger value="appearance"><Palette className="mr-1.5 h-4 w-4" /> {t('tabAppearance')}</TabsTrigger>
          {!isApi && <TabsTrigger value="demo"><Database className="mr-1.5 h-4 w-4" /> {t('tabLocalData')}</TabsTrigger>}
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader><CardTitle>{t('organisation')}</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="org">{t('organisationName')}</Label><Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>{t('defaultCurrency')}</Label>
                <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['EUR', 'USD', 'GBP', 'CHF'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>{t('defaultLanguage')}</Label>
                <Select value={language} onValueChange={setLanguage}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="it">Italiano</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="tz">{t('timezone')}</Label><Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} /></div>
              <div className="flex items-end"><Button variant="gold" onClick={save} disabled={saving}><Save /> {saving ? t('saving') : t('saveChanges')}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        {isApi && (
        <TabsContent value="security">
          <ChangePasswordCard />
        </TabsContent>
        )}

        {isApi && (
        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>{t('gmailTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground">{t('gmailDescription')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {gmail?.connected ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-3">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                    <p className="text-sm font-medium text-foreground">{t('gmailConnected', { email: gmail.email ?? '' })}</p>
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>{gmail.lastSyncedAt ? t('gmailLastSync', { time: formatRelative(gmail.lastSyncedAt) }) : t('gmailNeverSynced')}</p>
                    <p>{t('gmailInboxCount', { count: gmail.inboxCount ?? 0 })}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const res = await emailService.sync();
                        loadGmail();
                        if (res.ok) {
                          toast({ variant: 'success', title: t('gmailSyncDoneTitle'), description: t('gmailSyncDoneDescription', { created: res.created }) });
                        } else {
                          toast({ variant: 'danger', title: t('gmailErrorToastTitle'), description: t('gmailSyncFailed') });
                        }
                      }}
                    >
                      <RefreshCw /> {t('gmailSyncNow')}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        await emailService.disconnect();
                        loadGmail();
                        toast({ variant: 'info', title: t('gmailDisconnectedToast') });
                      }}
                    >
                      <Unplug /> {t('disconnectGmail')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                    {gmail?.email ? t('gmailExpired', { email: gmail.email }) : t('gmailNotConnectedHint')}
                  </p>
                  <Button variant="gold" onClick={() => { window.location.href = '/api/auth/google/start'; }}>
                    <Mail /> {gmail?.email ? t('reconnectGmail') : t('connectGmail')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        )}

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>{t('emailTriggers')}</CardTitle><p className="text-sm text-muted-foreground">{t('emailTriggersDescription')}</p></CardHeader>
            <CardContent className="divide-y">
              {NOTIF_PREFS.map((l, i) => (
                <div key={l} className="flex items-center justify-between py-3"><Label className="font-normal">{t(l)}</Label><Switch defaultChecked={i < 6} /></div>
              ))}
              <div className="pt-3"><Button variant="gold" onClick={save} disabled={saving}><Save /> {saving ? t('saving') : t('savePreferences')}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader><CardTitle>{t('appearance')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">{t('themeHint')}</div>
              <div className="space-y-1.5 max-w-xs"><Label>{t('defaultTableDensity')}</Label>
                <Select value={density} onValueChange={setDensity}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="comfortable">{t('densityComfortable')}</SelectItem><SelectItem value="compact">{t('densityCompact')}</SelectItem></SelectContent></Select>
              </div>
              <Button variant="gold" onClick={save} disabled={saving}><Save /> {saving ? t('saving') : t('save')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {!isApi && (
        <TabsContent value="demo">
          <Card>
            <CardHeader><CardTitle>{t('localData')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('localDataDescription')}
              </p>
              <Button variant="destructive" onClick={() => setResetOpen(true)}><RotateCcw /> {t('resetLocalData')}</Button>
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t('resetDialogTitle')}
        description={t('resetDialogDescription')}
        confirmLabel={t('resetDialogConfirm')}
        variant="danger"
        onConfirm={resetLocalData}
      />
    </div>
  );
}

/* ── Change password (api mode only) ────────────────────────────────────── */

function ChangePasswordCard() {
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
      setCurrent(''); setNext(''); setConfirm('');
      toast({ variant: 'success', title: t('passwordChangedTitle'), description: t('passwordChangedDescription') });
    } else {
      const key = (res.error && PASSWORD_ERROR_KEYS[res.error]) || 'passwordErrorGeneric';
      toast({ variant: 'danger', title: t('passwordErrorTitle'), description: t(key) });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> {t('securityTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('securityDescription')}</p>
      </CardHeader>
      <CardContent className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pw-current">{t('currentPassword')}</Label>
          <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-next">{t('newPassword')}</Label>
          <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-confirm">{t('confirmPassword')}</Label>
          <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button variant="gold" onClick={submit} disabled={!canSubmit}>
          <Save /> {busy ? t('changingPassword') : t('changePasswordButton')}
        </Button>
      </CardContent>
    </Card>
  );
}
