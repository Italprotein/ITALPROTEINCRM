'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { ArrowRight, ChevronLeft, KeyRound, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { confirmPasswordReset, requestPasswordReset } from '@/lib/services/auth.actions';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Step = 'email' | 'code' | 'done';

const ERROR_KEYS: Record<string, string> = {
  rate_limited: 'errorRateLimited',
  email_unavailable: 'errorEmailUnavailable',
  invalid_code: 'errorInvalidCode',
  expired_code: 'errorExpiredCode',
  too_many_attempts: 'errorTooManyAttempts',
  weak_password: 'errorWeakPassword',
};

/** Password reset for admin accounts: email → six-digit code → new password. */
export default function ForgotPasswordPage() {
  const t = useTranslations('ForgotPassword');
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isApi = (process.env.NEXT_PUBLIC_DATA_MODE ?? 'mock') === 'api';

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError('');
    const res = await requestPasswordReset(email.trim()).catch(() => ({ ok: false as const, error: undefined }));
    setBusy(false);
    if (res.ok) {
      setStep('code');
    } else {
      setError(t(ERROR_KEYS[res.error ?? ''] ?? 'errorGeneric'));
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setError(t('errorMismatch'));
      return;
    }
    setBusy(true);
    setError('');
    const res = await confirmPasswordReset(email.trim(), code.trim(), password).catch(() => ({
      ok: false as const,
      error: undefined,
    }));
    setBusy(false);
    if (res.ok) {
      setStep('done');
      setTimeout(() => router.push('/team-login'), 2500);
    } else {
      setError(t(ERROR_KEYS[res.error ?? ''] ?? 'errorGeneric'));
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <Logo tone="dark" />
        <LanguageSwitcher tone="dark" />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <Badge variant="gold" className="mb-4">
            <KeyRound className="h-3 w-3" /> {t('eyebrow')}
          </Badge>
          <h1 className="font-display text-3xl font-bold tracking-tight">{t('heading')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === 'email' ? t('subheadingEmail') : step === 'code' ? t('subheadingCode', { email }) : t('subheadingDone')}
          </p>

          {!isApi && (
            <p className="mt-6 rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
              {t('mockModeNote')}
            </p>
          )}

          {step === 'email' && (
            <form onSubmit={submitEmail} className="mt-8 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="fp-email">{t('emailLabel')}</Label>
                <Input
                  id="fp-email"
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="h-12"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" disabled={!email.trim() || busy || !isApi} className="h-12 w-full gap-2 text-sm font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {busy ? t('sendingCode') : t('sendCode')}
              </Button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={submitCode} className="mt-8 space-y-4" noValidate>
              <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
                <MailCheck className="h-4 w-4 shrink-0 text-success" />
                <span>{t('codeSentNotice')}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-code">{t('codeLabel')}</Label>
                <Input
                  id="fp-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                  className="h-12 text-center font-mono text-lg tracking-[0.4em]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-password">{t('newPasswordLabel')}</Label>
                <Input
                  id="fp-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">{t('passwordHint')}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fp-confirm">{t('confirmPasswordLabel')}</Label>
                <Input
                  id="fp-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  className="h-12"
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button
                type="submit"
                disabled={code.length !== 6 || !password || !confirm || busy}
                className="h-12 w-full gap-2 text-sm font-semibold"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {busy ? t('resetting') : t('resetPassword')}
              </Button>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                {t('resendCode')}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
                <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
                <span>{t('doneNotice')}</span>
              </div>
              <Button onClick={() => router.push('/team-login')} className="h-12 w-full gap-2 text-sm font-semibold">
                {t('backToLogin')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/team-login"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <ChevronLeft className="h-3 w-3" /> {t('backToLogin')}
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
