import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { pickMessages, PUBLIC_NAMESPACES } from '@/lib/i18n/public-namespaces';

/**
 * The public route group: the landing page and the six auth screens (login,
 * team-login, register, verify, forgot-password, activate).
 *
 * This is the only layout between these routes and the root layout, so it
 * owns their `NextIntlClientProvider` — scoped to `PUBLIC_NAMESPACES` rather
 * than the full message catalogue the root layout used to hand every route.
 * The admin and portal layouts mount their own providers with their own
 * (larger) namespace sets; see `lib/i18n/public-namespaces.ts`.
 */
export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={pickMessages(messages, PUBLIC_NAMESPACES)}>
      {children}
    </NextIntlClientProvider>
  );
}
