'use client';

import * as React from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';

import { Link, usePathname } from '@/lib/i18n/navigation';
import { getMfaStatus } from '@/lib/services/mfa.actions';

/*
 * Sign-in allows a required-but-not-yet-enrolled admin through, otherwise the
 * first deploy would lock the super_admin out of the account they need in order
 * to set MFA up. This banner is the other half of that bargain: it makes the
 * outstanding enrollment impossible to miss on every admin screen until done.
 */
export function MfaEnrollmentNotice() {
  const pathname = usePathname();
  const [outstanding, setOutstanding] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    getMfaStatus()
      .then((status) => {
        if (alive) setOutstanding(status.required && !status.enrolled);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // Re-check on navigation so the banner clears as soon as setup completes.
  }, [pathname]);

  // Never shown on the page that fixes it.
  if (!outstanding || pathname.startsWith('/admin/security')) return null;

  return (
    <div className="border-b border-warning/40 bg-warning-subtle px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <ShieldAlert className="h-4 w-4 shrink-0 text-warning-foreground" />
        <span className="text-warning-foreground">
          <strong>Two-factor authentication is required for your role</strong> and is not set up yet.
        </span>
        <Link
          href="/admin/security"
          className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline"
        >
          Set it up now <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
