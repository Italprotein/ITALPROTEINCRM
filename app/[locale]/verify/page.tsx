import { Suspense } from 'react';

import { MfaChallenge } from '@/components/auth/mfa-challenge';
import { PublicShell } from '@/components/public/public-shell';

/**
 * `MfaChallenge` itself is untouched — its own header, card and copy are its
 * own concern and out of this task's scope (no touching the MFA component or
 * its wiring). This only adds the shared rail around it, same as every other
 * public screen.
 */
export default function VerifyPage() {
  return (
    <PublicShell>
      <Suspense>
        <MfaChallenge />
      </Suspense>
    </PublicShell>
  );
}
