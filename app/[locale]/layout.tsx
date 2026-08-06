import type { Metadata } from 'next';
import { IBM_Plex_Sans_Condensed, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { MotionConfig } from 'framer-motion';
import { routing, type Locale } from '@/lib/i18n/routing';
import { SessionProvider } from '@/components/providers/session-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import '../globals.css';

/** Applies the stored or system theme before paint to avoid a wrong-theme flash. */
const themeScript = `(function(){var r=document.documentElement,t;try{t=localStorage.getItem('ui:theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';r.classList.toggle('dark',t==='dark');r.dataset.theme=t;r.style.colorScheme=t})();`;

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

const plexDisplay = IBM_Plex_Sans_Condensed({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
    <html lang={locale} className={`${inter.variable} ${plexDisplay.variable}`} suppressHydrationWarning>
      <head>
        {/* Anti-flash theme init. suppressHydrationWarning: the content is a
            static, deterministic string, so any server/client diff here comes
            from a third party (a browser extension injecting into <head>), not
            from us — React should not try to reconcile it. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <NextIntlClientProvider messages={messages}>
          <SessionProvider>
            {/* reducedMotion="user": every framer-motion animation in the app
                collapses to a fade for people with OS-level reduced motion. */}
            <MotionConfig reducedMotion="user">
              <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
            </MotionConfig>
            <Toaster />
          </SessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
