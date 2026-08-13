'use client';

import { EmailLogin } from '@/components/auth/email-login';

/** Company portal login — accepts external (client/partner) accounts only. */
export default function LoginPage() {
  return (
    <EmailLogin
      workspace="external"
      ns="Login"
      redirectTo="/portal"
      altHref="/team-login"
      variant="company"
    />
  );
}
