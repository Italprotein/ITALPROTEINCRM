'use client';

import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/shared/page-header';
import { GoogleIntegrationCard } from '@/components/admin/google-integration-card';

/**
 * Connected services, reachable by every CRM admin.
 *
 * The Google connection used to live only on /admin/settings, which is
 * super_admin-only — so the people who actually run the mailbox could not
 * connect or re-sync it.
 */
export default function IntegrationsPage() {
  const t = useTranslations('Nav');

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('integrations')}
        subtitle="Services the CRM connects to on behalf of Italprotein."
      />
      <div className="max-w-3xl">
        <GoogleIntegrationCard />
      </div>
    </div>
  );
}
