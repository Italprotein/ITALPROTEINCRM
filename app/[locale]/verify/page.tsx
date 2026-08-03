import { Suspense } from 'react';

import { MfaChallenge } from '@/components/auth/mfa-challenge';
import { PublicShell } from '@/components/public/public-shell';

/**
 * This page owns the shell; `MfaChallenge` returns only its `Module`, so the
 * rail renders exactly once. It was briefly rendered in both places, which put
 * two fixed asides on the screen and offset the column by `26rem` twice.
 *
 * The shell sits outside `Suspense` deliberately: `MfaChallenge` reads search
 * params, so it is the only part that needs to wait: the rail, the doors and
 * contact paint immediately.
 *
 * `MfaChallenge`'s behaviour — the verification request, the sign-in handoff
 * and every error branch — is untouched; only its copy and its wrapper moved.
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
