'use client';

import { EmailLogin } from '@/components/auth/email-login';

/** Italprotein team login — accepts internal staff accounts (approved emails) only. */
export default function TeamLoginPage() {
  return (
    <EmailLogin
      workspace="internal"
      ns="TeamLogin"
      redirectTo="/admin"
      altHref="/login"
      variant="team"
    />
  );
}
