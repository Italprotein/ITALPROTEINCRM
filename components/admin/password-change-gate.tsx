'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { getPasswordChangeRequired } from '@/lib/services/auth.actions';
import { ChangePasswordCard } from '@/components/admin/change-password-card';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Logo } from '@/components/brand/logo';

/*
 * First-sign-in password gate.
 *
 * Accounts seeded from data/admins.json hold a password an operator chose and
 * handed over out of band (email, chat). This replaces the whole CRM with a
 * change-password screen until the owner sets their own, so a shared credential
 * is a one-time bootstrap rather than a standing password.
 *
 * The real enforcement is server-side: requireUser() throws
 * PASSWORD_CHANGE_REQUIRED, so every guarded action refuses regardless of what
 * the browser does. This component exists so the user sees why, and has the one
 * control that resolves it — not as the security boundary itself.
 */
export function PasswordChangeGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations('PasswordGate');
  const [required, setRequired] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let alive = true;
    getPasswordChangeRequired()
      .then((value) => alive && setRequired(value))
      // Fail open on a network error: the server still blocks every action, so
      // a false negative here cannot grant access — it would only hide the form.
      .catch(() => alive && setRequired(false));
    return () => {
      alive = false;
    };
  }, []);

  // Render the app while the check is in flight to avoid a flash for the
  // overwhelming majority of sign-ins, where no change is pending.
  if (required !== true) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 p-4">
      {/* The gate replaces the whole shell, so the usual header is gone with it.
          Without a switcher here an Italian colleague would be stuck reading
          English at the one screen they cannot navigate away from. */}
      <div className="flex justify-end">
        <LanguageSwitcher tone="dark" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <Logo tone="dark" />

        <div className="flex max-w-2xl items-start gap-3 rounded-lg border border-warning/40 bg-warning-subtle p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
          <div className="text-sm">
            <p className="font-semibold text-warning-foreground">{t('title')}</p>
            <p className="mt-1 text-muted-foreground">{t('body')}</p>
          </div>
        </div>

        <ChangePasswordCard />
      </div>
    </div>
  );
}
