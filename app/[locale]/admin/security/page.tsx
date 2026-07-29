import { MfaSetup } from '@/components/admin/mfa-setup';

/** Per-account security settings. Available to every internal user — unlike
 *  /admin/settings, which is super_admin only, this manages your OWN account. */
export default function SecurityPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <MfaSetup />
    </div>
  );
}
