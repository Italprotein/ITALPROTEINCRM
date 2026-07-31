'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Button } from '@/components/ui/button';
import { useRouter } from '@/lib/i18n/navigation';

export function MfaChallenge() {
  const locale = useLocale();
  const it = locale === 'it';
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
      setError(result.error === 'CHALLENGE_EXPIRED'
        ? (it ? 'La richiesta di verifica è scaduta. Torna al login e riprova.' : 'This verification request expired. Return to sign in and try again.')
        : (it ? 'Il codice non è valido. Controlla l’app o usa un codice di recupero.' : 'That code is not valid. Check your authenticator or use a backup code.'));
      return;
    }
    const signedIn = await signIn('credentials', {
      workspace,
      loginTicket: result.loginTicket,
      redirect: false,
    });
    if (!signedIn || signedIn.error) {
      setBusy(false);
      setError(it ? 'Il ticket di accesso sicuro è scaduto. Accedi di nuovo.' : 'The secure sign-in ticket expired. Please sign in again.');
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
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-5 py-8 dark:bg-background">
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-brand-navy/[0.08] to-transparent" />
      <div className="relative mx-auto flex max-w-5xl items-center justify-between">
        <Logo tone="dark" href="/" />
        <LanguageSwitcher tone="dark" />
      </div>

      <div className="relative mx-auto mt-12 max-w-md rounded-2xl border bg-card p-6 shadow-xl shadow-brand-navy/10 sm:p-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-navy text-white">
          {backupMode ? <KeyRound className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-goldDark">{it ? 'Accesso sicuro' : 'Secure sign-in'}</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">{it ? 'Autenticazione a due fattori' : 'Two-factor authentication'}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {backupMode
            ? (it ? 'Inserisci uno dei codici di recupero salvati durante la configurazione.' : 'Enter one of the recovery codes you saved when setting up two-factor authentication.')
            : (it ? 'Apri l’app di autenticazione e inserisci il codice attuale a sei cifre.' : 'Open your authenticator app and enter the current six-digit code.')}
        </p>

        <form onSubmit={verify} className="mt-7 space-y-5">
          {backupMode ? (
            <input
              autoFocus
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              autoComplete="one-time-code"
              placeholder="XXXX-XXXX"
              className="h-12 w-full rounded-lg border bg-background px-4 font-mono uppercase tracking-widest outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
            />
          ) : (
            <div className="grid grid-cols-6 gap-2">
              {digits.map((digit, index) => (
                <input
                  key={index}
                  ref={(element) => { refs.current[index] = element; }}
                  value={digit}
                  autoFocus={index === 0}
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  aria-label={`${it ? 'Cifra' : 'Digit'} ${index + 1}`}
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
                  className="h-12 min-w-0 rounded-lg border bg-background text-center text-xl font-semibold tabular outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 sm:h-14"
                />
              ))}
            </div>
          )}

          <button type="button" onClick={() => { setBackupMode((value) => !value); setError(''); }} className="text-sm font-medium text-brand-navy underline-offset-4 hover:underline dark:text-brand-gold">
            {backupMode ? (it ? 'Usa il codice dell’app' : 'Use authenticator code instead') : (it ? 'Usa un codice di recupero' : 'Use a backup code')}
          </button>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-navy"
            />
            <span>
              <span className="block text-sm font-medium">{it ? 'Autorizza questo dispositivo per 30 giorni' : 'Trust this device for 30 days'}</span>
              <span className="block text-xs text-muted-foreground">{it ? 'Non selezionare su un dispositivo condiviso o pubblico.' : 'Do not select this on a shared or public device.'}</span>
            </span>
          </label>

          {error && <p role="alert" className="rounded-lg bg-danger-subtle p-3 text-sm text-danger">{error}</p>}
          <Button className="h-12 w-full" disabled={busy || (backupMode ? !backupCode.trim() : digits.some((digit) => !digit))}>
            {busy
              ? <><Loader2 className="animate-spin" /> {it ? 'Verifica…' : 'Verifying…'}</>
              : (it ? 'Verifica e continua' : 'Verify and continue')}
          </Button>
        </form>
      </div>
    </main>
  );
}
