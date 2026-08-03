'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';

import { Module } from '@/components/public/module';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/i18n/navigation';

/**
 * The two-factor challenge, rendered in the public column.
 *
 * It returns a `Module` and **not** a `PublicShell`: `app/[locale]/verify/
 * page.tsx` owns the shell, the same way every other public screen's page
 * owns it. Rendering one here too put two fixed rails on `/verify`, two logos
 * and a doubled `26rem` column offset.
 *
 * Copy runs through the `Verify` namespace. Behaviour — the verify request,
 * the `signIn` handoff and every error branch — is untouched.
 */
export function MfaChallenge() {
  const t = useTranslations('Verify');
  const params = useSearchParams();
  const router = useRouter();
  const workspace = params.get('workspace') === 'external' ? 'external' : 'internal';
  const next = params.get('next') === '/portal' ? '/portal' : '/admin/companies';
  const [digits, setDigits] = React.useState(['', '', '', '', '', '']);
  const [backupMode, setBackupMode] = React.useState(false);
  const [backupCode, setBackupCode] = React.useState('');
  const [rememberDevice, setRememberDevice] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const refs = React.useRef<Array<HTMLInputElement | null>>([]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const code = backupMode ? backupCode.trim() : digits.join('');
    if (!code) return;
    setBusy(true);
    setError('');
    const response = await fetch('/api/auth/mfa-verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, rememberDevice }),
    });
    const result = await response.json();
    if (!response.ok) {
      setBusy(false);
      setError(result.error === 'CHALLENGE_EXPIRED' ? t('errorExpired') : t('errorInvalid'));
      return;
    }
    const signedIn = await signIn('credentials', {
      workspace,
      loginTicket: result.loginTicket,
      redirect: false,
    });
    if (!signedIn || signedIn.error) {
      setBusy(false);
      setError(t('errorTicket'));
      return;
    }
    router.push(next);
  }

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits((current) => current.map((item, itemIndex) => itemIndex === index ? digit : item));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  }

  return (
    <Module designation={t('designation')}>
      <div className="max-w-md">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
          {backupMode ? <KeyRound className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          {backupMode ? t('introBackup') : t('introApp')}
        </p>

        <form onSubmit={verify} className="mt-7 space-y-5">
          {backupMode ? (
            <input
              autoFocus
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              autoComplete="one-time-code"
              placeholder="XXXX-XXXX"
              className="h-12 w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 font-mono uppercase tracking-widest text-white outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            />
          ) : (
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { refs.current[index] = element; }}
                  value={digit}
                  autoFocus={index === 0}
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={t('digitLabel', { index: index + 1 })}
                  onChange={(event) => setDigit(index, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Backspace' && !digit && index > 0) refs.current[index - 1]?.focus();
                  }}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                    if (pasted.length === 6) {
                      event.preventDefault();
                      setDigits(pasted.split(''));
                      refs.current[5]?.focus();
                    }
                  }}
                  maxLength={1}
                  className="h-12 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] px-0 text-center text-lg font-semibold text-white tabular outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 sm:h-14 sm:text-xl"
                />
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => { setBackupMode((value) => !value); setError(''); }}
            className="text-sm font-medium text-brand-goldLight underline-offset-4 hover:underline"
          >
            {backupMode ? t('useApp') : t('useBackup')}
          </button>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-gold"
            />
            <span>
              <span className="block text-sm font-medium text-white">{t('trustDevice')}</span>
              <span className="block text-xs text-slate-400">{t('trustDeviceHint')}</span>
            </span>
          </label>

          {error && <p role="alert" className="rounded-lg bg-danger-subtle p-3 text-sm text-danger">{error}</p>}
          <Button className="h-12 w-full" disabled={busy || (backupMode ? !backupCode.trim() : digits.some((digit) => !digit))}>
            {busy
              ? <><Loader2 className="animate-spin" /> {t('verifying')}</>
              : t('verifyContinue')}
          </Button>
        </form>
      </div>
    </Module>
  );
}
