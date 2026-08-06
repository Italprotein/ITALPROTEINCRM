'use client';

import { useState, useId, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowRight, Mail, Lock,
  CheckCircle2, XCircle, Loader2, ShieldCheck,
} from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { signIn } from 'next-auth/react';
import { authService } from '@/lib/mock-services';
import type { Workspace } from '@/lib/types';
import { Module } from '@/components/public/module';
import { PublicShell } from '@/components/public/public-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { isApiMode } from '@/lib/data-mode';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export interface EmailLoginProps {
  /** Which account workspace this door accepts. */
  workspace: Workspace;
  /** Translation namespace ('Login' | 'TeamLogin'). */
  ns: 'Login' | 'TeamLogin';
  /** Where to send the user after a successful sign-in. Internal staff land on
   *  the Companies (Aziende) list — the CRM's home base — not the overview. */
  redirectTo: '/admin/companies' | '/portal';
  /** The other login page, offered when the wrong workspace email is entered. */
  altHref: string;
  /** Visual treatment. */
  variant: 'company' | 'team';
}

/**
 * The form used by `/login`, `/team-login` and `/register`, rendered inside
 * the shared `PublicShell` (Task 1) instead of its own split-screen shell.
 *
 * This used to build a `grid lg:grid-cols-[minmax(0,44%)_1fr]` layout with a
 * navy `<aside>` carrying the logo, a headline and a link back to the site,
 * plus animated `Orb`/`OrbitalRings` decoration. The rail (`PublicShell` →
 * `Rail`) now covers all of that permanently — identity, both doors, contact
 * — so the aside, its decorations and the framer-motion entrance animations
 * that dressed this screen are gone; only the form itself remains, as one
 * `Module` in the column. None of the auth logic below changed — same
 * sign-in calls, same destinations, same MFA hand-off, same error handling.
 */
export function EmailLogin({ workspace, ns, redirectTo, altHref, variant }: EmailLoginProps) {
  const t = useTranslations(ns);
  const router = useRouter();
  const { signInAs } = useSession();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [wrongWorkspace, setWrongWorkspace] = useState(false);

  const isTeam = variant === 'team';
  // Real auth (Auth.js Credentials) activates when NEXT_PUBLIC_DATA_MODE=api;
  // otherwise the local preview login is used.
  const isApi = isApiMode;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === 'submitting' || state === 'success') return;
    if (isApi && !password) return;

    setState('submitting');
    setWrongWorkspace(false);

    // ── Real auth (Auth.js Credentials provider) ──
    if (isApi) {
      const checked = await fetch('/api/auth/login-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, workspace }),
      });
      const check = await checked.json();
      if (!checked.ok) {
        setState('error');
        setErrorMsg(t('errorInvalid'));
        setTimeout(() => setState('idle'), 3200);
        return;
      }
      if (rememberMe) localStorage.setItem(`italprotein-login-email:${workspace}`, email.trim().toLowerCase());
      else localStorage.removeItem(`italprotein-login-email:${workspace}`);
      if (check.mfaRequired) {
        router.push(`/verify?workspace=${workspace}&next=${encodeURIComponent(redirectTo)}`);
        return;
      }
      const res = await signIn('credentials', {
        workspace,
        loginTicket: check.loginTicket,
        redirect: false,
      });
      if (!res || res.error) {
        setState('error');
        setErrorMsg(t('errorInvalid'));
        setTimeout(() => setState('idle'), 3200);
        return;
      }
      setState('success');
      await new Promise((r) => setTimeout(r, 400));
      router.push(redirectTo);
      return;
    }

    // ── Local preview login (sign in to a seeded account by email) ──
    await new Promise((r) => setTimeout(r, 750));

    const account = authService.getAccountByEmail(email);

    if (!account) {
      setState('error');
      setErrorMsg(t('errorNotFound'));
      setTimeout(() => setState('idle'), 3200);
      return;
    }
    if (account.workspace !== workspace) {
      setState('error');
      setErrorMsg(t('errorWrongWorkspace'));
      setWrongWorkspace(true);
      return;
    }

    setState('success');
    await new Promise((r) => setTimeout(r, 650));
    signInAs(account.id);
    router.push(redirectTo);
  }

  const borderClass =
    state === 'error'
      ? 'border-destructive bg-danger-subtle/40 ring-2 ring-destructive/15'
      : state === 'success'
        ? 'border-success bg-success-subtle/40 ring-2 ring-success/15'
        : 'border-input bg-background/70 hover:border-brand-goldDark/35 focus-within:border-brand-goldDark focus-within:ring-2 focus-within:ring-brand-goldDark/15 dark:focus-within:border-brand-gold';

  useEffect(() => {
    if (!isApi) return;
    const saved = localStorage.getItem(`italprotein-login-email:${workspace}`);
    if (!saved) return;
    const frame = requestAnimationFrame(() => {
      setEmail(saved);
      setRememberMe(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [isApi, workspace]);

  return (
    <PublicShell>
      <Module designation={t('eyebrow')}>
        <div className="max-w-lg">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted-foreground">
                {isTeam ? 'ITALPROTEIN / CRM' : 'PROAMINA® / B2B'}
              </p>
              <h1 className="mt-3 max-w-[16ch] font-display text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[2.75rem]">
                {t('heading')}
              </h1>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-goldDark/20 bg-info-subtle text-brand-goldDark dark:text-brand-gold" aria-hidden>
              <ShieldCheck className="h-5 w-5" />
            </span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{t('subheading')}</p>

        <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-5" noValidate>
          <div className="space-y-1.5">
            <label htmlFor={emailId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {isTeam ? <Lock className="h-3.5 w-3.5 text-brand-goldDark dark:text-brand-gold" /> : <Mail className="h-3.5 w-3.5 text-brand-goldDark dark:text-brand-gold" />}
              {t('emailLabel')}
            </label>

            <div className={cn('relative overflow-hidden rounded-xl border transition-all duration-200 motion-reduce:transition-none', borderClass)}>
              <input
                id={emailId}
                type="email"
                value={email}
                autoComplete="email"
                disabled={state === 'submitting' || state === 'success'}
                placeholder={t('emailPlaceholder')}
                aria-invalid={state === 'error'}
                aria-describedby={state === 'error' || state === 'success' ? `${emailId}-status` : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state === 'error') { setState('idle'); setWrongWorkspace(false); }
                }}
                className="h-12 w-full bg-transparent px-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground/75 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-13"
              />
              {state === 'success' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
              )}
              {state === 'error' && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive">
                  <XCircle className="h-5 w-5" />
                </span>
              )}
            </div>

            {state === 'error' && (
              <div id={`${emailId}-status`} className="space-y-1" role="alert" aria-live="polite">
                <p className="text-xs font-medium text-destructive">{errorMsg}</p>
                {wrongWorkspace && (
                  <Link href={altHref} className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-brand-molecular underline-offset-4 hover:text-brand-navy hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-brand-gold dark:hover:text-white">
                    {t('altLink')} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )}
            {state === 'success' && (
              <p id={`${emailId}-status`} className="text-xs font-medium text-success" role="status">{t('successMessage')}</p>
            )}
          </div>

          {isApi && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={passwordId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lock className="h-3.5 w-3.5 text-brand-goldDark dark:text-brand-gold" />
                  {t('passwordLabel')}
                </label>
                <Link
                  href={`/forgot-password?workspace=${workspace}`}
                  className="inline-flex min-h-9 items-center text-xs font-medium text-muted-foreground underline-offset-4 hover:text-brand-molecular hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-brand-gold"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <div className={cn('relative overflow-hidden rounded-xl border transition-all duration-200 motion-reduce:transition-none', borderClass)}>
                <input
                  id={passwordId}
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  disabled={state === 'submitting' || state === 'success'}
                  placeholder={t('passwordPlaceholder')}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (state === 'error') setState('idle');
                  }}
                  className="h-12 w-full bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground/75 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-13"
                />
              </div>
            </div>
          )}

          {isApi && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 rounded border-input accent-brand-goldDark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:accent-brand-gold"
              />
              Remember my email on this device
            </label>
          )}

          <Button
            type="submit"
            disabled={!email.trim() || (isApi && !password) || state === 'submitting' || state === 'success'}
            className="h-12 w-full gap-2 bg-brand-navy text-sm font-semibold text-white shadow-md shadow-brand-navy/10 transition-[background-color,color,transform,box-shadow] hover:bg-brand-molecular hover:shadow-lg focus-visible:ring-brand-molecular dark:bg-brand-molecular dark:hover:bg-brand-blueBright dark:hover:text-brand-navy sm:h-13"
          >
            {state === 'submitting' ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                {t('verifying')}
              </span>
            ) : state === 'success' ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t('successMessage')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {t('accessButton')}
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </form>

        {/* The always-visible "wrong door?" link that used to sit below the
            form is gone — the rail's two doors (Task 1) are always on
            screen, so repeating a link to `altHref` here would just restate
            them. The link tied to the wrong-workspace error above stays: it
            is part of that error's feedback, not decorative navigation. */}
          <div className="mt-7 flex max-w-md items-start gap-3 border-t border-border pt-5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-xs leading-relaxed text-muted-foreground">{t('futureNote')}</p>
          </div>
        </div>
      </Module>
    </PublicShell>
  );
}
