import { ArrowLeft } from 'lucide-react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';

import { Module } from '@/components/public/module';
import { PublicShell } from '@/components/public/public-shell';
import { Link } from '@/lib/i18n/navigation';
import { pickMessages, PUBLIC_NAMESPACES } from '@/lib/i18n/public-namespaces';
import { routing } from '@/lib/i18n/routing';

/**
 * The locale-scoped 404 — rendered whenever a page under `[locale]` calls
 * `notFound()`, so it always renders inside the locale layout, after
 * `setRequestLocale` has already run for this request.
 *
 * It is a public screen, so it wears the same shell as the landing page and
 * the auth screens instead of its own centred one-off layout: a visitor who
 * lands here still has the rail, and therefore both doors and contact, without
 * needing to find their way home first.
 *
 * The copy comes from the existing `Errors` namespace rather than the previous
 * hardcoded English-and-Italian-at-once line, and the home link is the
 * locale-aware `Link`, which keeps an Italian visitor in Italian — the old
 * `next/link` to `/en` sent them to the English site.
 *
 * This file sits directly under `app/[locale]/`, not inside `(public)`, so
 * (unlike the routes `(public)/layout.tsx` covers) it has no ancestor
 * `NextIntlClientProvider` of its own — the root layout no longer mounts one.
 * `PublicShell` renders `Rail`, a Client Component that calls
 * `useTranslations`, and Client Components can only read messages from that
 * provider's React context, not from the server request config directly
 * (unlike this component's own `t`/`tCommon` below, which can). So this
 * component mounts its own provider, scoped to `PUBLIC_NAMESPACES` like
 * every other public route.
 *
 * `not-found.tsx` receives no `params`, so the locale comes from
 * `getLocale()` instead of a prop. The try/catch here is NOT a
 * general-purpose "something went wrong" handler: `getLocale()`/
 * `getMessages()` talk to Next.js by throwing, not just by rejecting —
 * `notFound()`/`redirect()` elsewhere in the tree, and Next bailing this
 * boundary out of static rendering (`DYNAMIC_SERVER_USAGE`, so an Italian
 * visitor doesn't get served the English default from a stale static
 * shell), both surface as an `Error` carrying a `digest` string that the
 * framework needs to see propagate, not get swallowed. So the catch
 * re-throws anything with a `digest` first, and only treats genuinely
 * digest-less failures — no request-scoped locale to read at all, or a
 * broken request config — as the fallback case: default locale, messages
 * loaded the same way `lib/i18n/request.ts` does.
 *
 * `t`/`tCommon` use `getTranslations` (async, like
 * `(public)/register/page.tsx`), not `useTranslations`: this component has
 * to be async to `await` the locale/messages above, and
 * `eslint-plugin-react-hooks` flags any `useXxx` call — including
 * next-intl's non-hook Server Component build of `useTranslations` — inside
 * an async function. Passing the already-resolved `locale` explicitly also
 * means these calls don't depend on the same request-locale lookup that the
 * try/catch above exists to guard against.
 */
export default async function NotFound() {
  let locale: string;
  let messages: Record<string, unknown>;
  try {
    locale = await getLocale();
    messages = await getMessages();
  } catch (error) {
    // Next's own control-flow errors (dynamic-render bailout, notFound(),
    // redirect(), ...) carry a `digest` string and MUST propagate — this
    // fallback is only for genuinely digest-less failures.
    if ((error as { digest?: string })?.digest) throw error;
    locale = routing.defaultLocale;
    messages = (await import(`@/messages/${locale}.json`)).default;
  }

  const t = await getTranslations({ locale, namespace: 'Errors' });
  const tCommon = await getTranslations({ locale, namespace: 'Common' });

  return (
    <NextIntlClientProvider locale={locale} messages={pickMessages(messages, PUBLIC_NAMESPACES)}>
      <PublicShell>
        <Module designation="404">
          <div className="max-w-lg">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t('notFoundTitle')}
            </h1>
            <p className="mt-4 leading-relaxed text-muted-foreground">{t('notFoundBody')}</p>
            <Link
              href="/"
              className={
                'mt-8 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 ' +
                'text-sm font-medium text-foreground transition-colors hover:border-brand-blue/45 hover:bg-accent ' +
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              }
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-brand-molecular dark:text-brand-blueBright" aria-hidden />
              {tCommon('backToHome')}
            </Link>
          </div>
        </Module>
      </PublicShell>
    </NextIntlClientProvider>
  );
}
