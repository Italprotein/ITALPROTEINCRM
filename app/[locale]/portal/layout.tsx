import { setRequestLocale } from 'next-intl/server';
import { PortalShell } from '@/components/portal/portal-shell';

export default function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  return <PortalShell>{children}</PortalShell>;
}
