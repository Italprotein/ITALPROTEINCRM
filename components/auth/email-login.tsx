'use client';

import { useState, useRef, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  ArrowRight, ShieldAlert, ChevronLeft, Mail, Lock,
  CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { signIn } from 'next-auth/react';
import { authService } from '@/lib/mock-services';
import type { Workspace } from '@/lib/types';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/* ── Floating orb ────────────────────────────────────────────────────────── */
function Orb({ className, delay = 0, duration = 8 }: { className: string; delay?: number; duration?: number }) {
  return (
    <motion.div
      className={cn('pointer-events-none absolute rounded-full blur-3xl', className)}
      animate={{ y: [0, -18, 6, -12, 0], x: [0, 8, -6, 12, 0], scale: [1, 1.07, 0.96, 1.04, 1] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/* ── Orbital ring decoration ─────────────────────────────────────────────── */
function OrbitalRings() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[280, 380, 480].map((size, i) => (
        <motion.div
          key={size}
          className="absolute left-1/2 top-1/2 rounded-full border border-white/[0.06]"
          style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 35 + i * 12, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute h-1.5 w-1.5 rounded-full bg-brand-gold/60" style={{ top: -3, left: '50%', marginLeft: -3 }} />
        </motion.div>
      ))}
    </div>
  );
}

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export interface EmailLoginProps {
  /** Which account workspace this door accepts. */
  workspace: Workspace;
  /** Translation namespace ('Login' | 'TeamLogin'). */
  ns: 'Login' | 'TeamLogin';
  /** Where to send the user after a successful sign-in. */
  redirectTo: '/admin' | '/portal';
  /** The other login page, offered when the wrong workspace email is entered. */
  altHref: string;
  /** Visual treatment. */
  variant: 'company' | 'team';
}

export function EmailLogin({ workspace, ns, redirectTo, altHref, variant }: EmailLoginProps) {
  const t = useTranslations(ns);
  const router = useRouter();
  const { signInAs } = useSession();
  const emailId = useId();
  const passwordId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [wrongWorkspace, setWrongWorkspace] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isTeam = variant === 'team';
  // Real auth (Auth.js Credentials) activates when NEXT_PUBLIC_DATA_MODE=api;
  // otherwise the local preview login is used.
  const isApi = (process.env.NEXT_PUBLIC_DATA_MODE ?? 'mock') === 'api';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === 'submitting' || state === 'success') return;
    if (isApi && !password) return;

    setState('submitting');
    setWrongWorkspace(false);

    // ── Real auth (Auth.js Credentials provider) ──
    if (isApi) {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
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
      ? 'border-destructive ring-1 ring-destructive/50'
      : state === 'success'
        ? 'border-success ring-1 ring-success/50'
        : 'border-input focus-within:border-brand-gold/60 focus-within:ring-1 focus-within:ring-brand-gold/30';

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,44%)_1fr]">
      {/* ── Brand panel ───────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-brand-navy text-white lg:flex lg:flex-col lg:justify-between lg:p-10">
        {isTeam ? (
          <>
            <Orb className="h-[420px] w-[420px] -left-32 -top-10 bg-brand-gold/12" delay={0} duration={10} />
            <Orb className="h-72 w-72 right-0 top-1/4 bg-blue-600/20" delay={2.5} duration={12} />
            <Orb className="h-80 w-80 -left-20 bottom-0 bg-brand-navy/40" delay={1} duration={9} />
          </>
        ) : (
          <>
            <Orb className="h-[420px] w-[420px] -left-32 -top-10 bg-brand-gold/15" delay={0} duration={9} />
            <Orb className="h-72 w-72 right-0 top-1/4 bg-brand-teal/20" delay={2.5} duration={11} />
            <Orb className="h-80 w-80 -left-20 bottom-0 bg-blue-600/15" delay={1} duration={8} />
          </>
        )}

        <div className="absolute inset-0 bg-grid opacity-[0.055]" aria-hidden />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <OrbitalRings />
        </div>

        <motion.div className="relative z-10" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Logo tone="light" />
        </motion.div>

        <div className="relative z-10 max-w-xs">
          <motion.h2
            className="font-display text-4xl font-bold leading-[1.1]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          >
            {t('sideTitle')}
          </motion.h2>
          <motion.p
            className="mt-4 text-sm leading-relaxed text-slate-300"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.55 }}
          >
            {t('sideSubtitle')}
          </motion.p>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, duration: 0.4 }}>
            <Badge className={cn('mt-6 border-0', isTeam ? 'bg-brand-gold/15 text-brand-goldLight' : 'bg-white/10 text-brand-goldLight')}>
              {isTeam ? <Lock className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {t('badge')}
            </Badge>
          </motion.div>
        </div>

        <motion.div className="relative z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white">
            <ChevronLeft className="h-4 w-4" />
            {t('backToSite')}
          </Link>
        </motion.div>
      </aside>

      {/* ── Form panel ────────────────────────────────────────────── */}
      <main className="flex flex-col bg-background">
        <div className="flex items-center justify-between border-b px-6 py-4 lg:hidden">
          <Logo tone="dark" />
          <LanguageSwitcher tone="dark" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
          <div className="hidden w-full max-w-sm justify-end lg:flex">
            <LanguageSwitcher tone="dark" />
          </div>

          <motion.div
            className="mt-6 w-full max-w-sm"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-8 lg:hidden">
              <Logo tone="dark" />
            </div>

            <Badge variant={isTeam ? 'gold' : 'secondary'} className="mb-4">
              {isTeam ? <Lock className="h-3 w-3" /> : null}
              {t('eyebrow')}
            </Badge>
            <h1 className="font-display text-3xl font-bold tracking-tight">{t('heading')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('subheading')}</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
              <div className="space-y-1.5">
                <label htmlFor={emailId} className="flex items-center gap-1.5 text-sm font-medium">
                  {isTeam ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <Mail className="h-3.5 w-3.5 text-muted-foreground" />}
                  {t('emailLabel')}
                </label>

                <motion.div animate={state === 'error' ? { x: [0, -7, 7, -7, 7, -4, 4, 0] } : {}} transition={{ duration: 0.45 }}>
                  <div className={cn('relative overflow-hidden rounded-lg border transition-all duration-200', borderClass)}>
                    <input
                      ref={inputRef}
                      id={emailId}
                      type="email"
                      value={email}
                      autoFocus
                      autoComplete="email"
                      disabled={state === 'submitting' || state === 'success'}
                      placeholder={t('emailPlaceholder')}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (state === 'error') { setState('idle'); setWrongWorkspace(false); }
                      }}
                      className="h-12 w-full bg-transparent px-4 pr-11 text-sm placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
                    />
                    <AnimatePresence mode="wait">
                      {state === 'success' && (
                        <motion.span key="ok" className="absolute right-3 top-1/2 -translate-y-1/2 text-success" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                          <CheckCircle2 className="h-5 w-5" />
                        </motion.span>
                      )}
                      {state === 'error' && (
                        <motion.span key="err" className="absolute right-3 top-1/2 -translate-y-1/2 text-destructive" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                          <XCircle className="h-5 w-5" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>

                <AnimatePresence mode="wait">
                  {state === 'error' && (
                    <motion.div key="errmsg" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1">
                      <p className="text-xs text-destructive">{errorMsg}</p>
                      {wrongWorkspace && (
                        <Link href={altHref} className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy underline-offset-2 hover:underline">
                          {t('altLink')} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </motion.div>
                  )}
                  {state === 'success' && (
                    <motion.p key="okmsg" className="text-xs font-medium text-success" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                      {t('successMessage')}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {isApi && (
                <div className="space-y-1.5">
                  <label htmlFor={passwordId} className="flex items-center gap-1.5 text-sm font-medium">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    {t('passwordLabel')}
                  </label>
                  <div className={cn('relative overflow-hidden rounded-lg border transition-all duration-200', borderClass)}>
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
                      className="h-12 w-full bg-transparent px-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
                    />
                  </div>
                </div>
              )}

              <Button type="submit" disabled={!email.trim() || (isApi && !password) || state === 'submitting' || state === 'success'} className="h-12 w-full gap-2 text-sm font-semibold">
                <AnimatePresence mode="wait" initial={false}>
                  {state === 'submitting' ? (
                    <motion.span key="loading" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('verifying')}
                    </motion.span>
                  ) : state === 'success' ? (
                    <motion.span key="done" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <CheckCircle2 className="h-4 w-4" />
                      {t('successMessage')}
                    </motion.span>
                  ) : (
                    <motion.span key="idle" className="flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {t('accessButton')}
                      <ArrowRight className="h-4 w-4" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </form>

            {/* Alt-login link (always visible) */}
            <div className="mt-4 text-center">
              <Link href={altHref} className="text-xs text-muted-foreground/80 underline-offset-2 transition-colors hover:text-foreground hover:underline">
                {t('altLink')}
              </Link>
            </div>

            <p className="mt-6 rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">{t('futureNote')}</p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
