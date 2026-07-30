'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';

import { getPasswordChangeRequired } from '@/lib/services/auth.actions';
import { ChangePasswordCard } from '@/components/admin/change-password-card';
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/30 p-4">
      <Logo tone="dark" />

      <div className="flex max-w-2xl items-start gap-3 rounded-lg border border-warning/40 bg-warning-subtle p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
        <div className="text-sm">
          <p className="font-semibold text-warning-foreground">Choose your own password to continue</p>
          <p className="mt-1 text-muted-foreground">
            This account still uses the password it was set up with. Because that password was
            shared with you rather than chosen by you, the CRM stays locked until you replace it.
            You will be signed out afterwards — sign back in with the new one.
          </p>
        </div>
      </div>

      <ChangePasswordCard />
    </div>
  );
}
