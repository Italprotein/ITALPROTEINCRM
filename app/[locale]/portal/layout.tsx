import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { PortalShell } from '@/components/portal/portal-shell';
import { getCurrentUser } from '@/lib/backend/session';
import { isApiMode } from '@/lib/data-mode';

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (isApiMode) {
    const user = await getCurrentUser();
    if (!user) redirect(`/${locale}/login`);
    if (user.kind !== 'external') redirect(`/${locale}/admin`);
  }
  return <PortalShell>{children}</PortalShell>;
}
