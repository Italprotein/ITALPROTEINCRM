import { setRequestLocale } from 'next-intl/server';
import { PortalShell } from '@/components/portal/portal-shell';

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PortalShell>{children}</PortalShell>;
}
