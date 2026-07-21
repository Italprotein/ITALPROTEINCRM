import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/crm/app-shell';
import { getCurrentUser } from '@/lib/backend/session';
import { isApiMode } from '@/lib/data-mode';

export default async function AdminLayout({
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
    if (!user) redirect(`/${locale}/team-login`);
    if (user.kind !== 'internal') redirect(`/${locale}/portal`);
  }
  return <AppShell>{children}</AppShell>;
}
