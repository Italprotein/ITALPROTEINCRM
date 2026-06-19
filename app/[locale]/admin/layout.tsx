import { setRequestLocale } from 'next-intl/server';
import { AppShell } from '@/components/crm/app-shell';

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);
  return <AppShell>{children}</AppShell>;
}
