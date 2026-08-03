'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

import { useRouter } from '@/lib/i18n/navigation';
import { acceptAccountInvitation } from '@/lib/services/auth.actions';
import { Module } from '@/components/public/module';
import { PublicShell } from '@/components/public/public-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ERROR_KEYS: Record<string, string> = {
  invalid_token: 'errorInvalidToken',
  expired_token: 'errorExpiredToken',
  weak_password: 'errorWeakPassword',
  rate_limited: 'errorRateLimited',
  server_error: 'errorGeneric',
};

function ActivationForm() {
  const t = useTranslations('ActivateAccount');
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? '' : t('errorInvalidToken'));
  const [loginPath, setLoginPath] = useState<'/team-login' | '/login' | null>(null);

  useEffect(() => {
    if (!loginPath) return;
    const timeout = window.setTimeout(() => router.push(loginPath), 1800);
    return () => window.clearTimeout(timeout);
  }, [loginPath, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || busy) return;
    if (password !== confirm) {
      setError(t('errorMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    const result = await acceptAccountInvitation(token, password).catch(() => ({
      ok: false as const,
      error: 'server_error' as const,
    }));
    setBusy(false);
    if (!result.ok) {
      setError(t(ERROR_KEYS[result.error] ?? 'errorGeneric'));
      return;
    }
    const destination = result.workspace === 'internal' ? '/team-login' : '/login';
    setLoginPath(destination);
  }

  return (
    <PublicShell>
      <Module designation={t('eyebrow')}>
        <div className="max-w-sm">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('heading')}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {loginPath ? t('subheadingDone') : t('subheading')}
          </p>

          {loginPath ? (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                <span>{t('doneNotice')}</span>
              </div>
              <Button onClick={() => router.push(loginPath)} className="h-12 w-full">
                {t('continueToLogin')}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="activation-password" className="text-slate-200">{t('passwordLabel')}</Label>
                <Input
                  id="activation-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError(''); }}
                  disabled={!token || busy}
                  className="h-12"
                />
                <p className="text-xs text-slate-400">{t('passwordHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="activation-confirm" className="text-slate-200">{t('confirmLabel')}</Label>
                <Input
                  id="activation-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => { setConfirm(event.target.value); setError(''); }}
                  disabled={!token || busy}
                  className="h-12"
                />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
              <Button
                type="submit"
                disabled={!token || !password || !confirm || busy}
                className="h-12 w-full gap-2 text-sm font-semibold"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {busy ? t('activating') : t('activate')}
              </Button>
            </form>
          )}
        </div>
      </Module>
    </PublicShell>
  );
}

export default function ActivatePage() {
  return (
    <Suspense fallback={null}>
      <ActivationForm />
    </Suspense>
  );
}
