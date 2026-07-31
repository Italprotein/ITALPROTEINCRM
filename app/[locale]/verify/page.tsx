import { Suspense } from 'react';

import { MfaChallenge } from '@/components/auth/mfa-challenge';

export default function VerifyPage() {
  return (
    <Suspense>
      <MfaChallenge />
    </Suspense>
  );
}
