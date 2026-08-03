import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Module } from '@/components/public/module';
import { PublicShell } from '@/components/public/public-shell';
import { Link } from '@/lib/i18n/navigation';

/**
 * The locale-scoped 404 — rendered whenever a page under `[locale]` calls
 * `notFound()`, so it always renders inside the locale layout and its
 * translations are available.
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
 */
export default function NotFound() {
  const t = useTranslations('Errors');
  const tCommon = useTranslations('Common');

  return (
    <PublicShell>
      <Module designation="404">
        <div className="max-w-lg">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t('notFoundTitle')}
          </h1>
          <p className="mt-4 leading-relaxed text-slate-400">{t('notFoundBody')}</p>
          <Link
            href="/"
            className={
              'mt-8 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 ' +
              'text-sm font-medium text-white transition-colors hover:border-sky-400/40 hover:bg-white/[0.06] ' +
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy'
            }
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
            {tCommon('backToHome')}
          </Link>
        </div>
      </Module>
    </PublicShell>
  );
}
