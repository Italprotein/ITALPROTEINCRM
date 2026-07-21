import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing, type Locale } from '@/lib/i18n/routing';
import { SessionProvider } from '@/components/providers/session-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import '../globals.css';

/** Applies the persisted theme before paint to avoid a light→dark flash. */
const themeScript = `(function(){try{var t=localStorage.getItem('ui:theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'ITALPROTEIN CRM · Proamina®',
    template: '%s · ITALPROTEIN CRM',
  },
  description:
    'Bilingual B2B CRM for Italprotein Srl and the Proamina® protein-sweetener business — companies, NDAs, samples, logistics, technical feedback and analytics.',
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as Locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>
            <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
            <Toaster />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
