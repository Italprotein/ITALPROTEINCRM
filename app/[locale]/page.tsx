import { useTranslations } from 'next-intl';
import { Bot, ChefHat, ClipboardCheck, FlaskConical, Package, Users } from 'lucide-react';

import { FeatureRadar } from '@/components/landing/feature-radar';
import { PartnerMarquee } from '@/components/landing/partner-marquee';
import { Reveal } from '@/components/landing/reveal';
import { Designation, Module } from '@/components/public/module';
import { PublicShell } from '@/components/public/public-shell';

/*
 * Public landing page — laboratory-instrument direction, rebuilt as modules
 * inside the shared `PublicShell`.
 *
 * The previous two versions of this page were a standard marketing stack —
 * hero, stats, features, CTA — with the call to action repeated three times
 * on the way down. `PublicShell`'s fixed rail now carries the two doors and
 * contact permanently, so this column never needs to repeat one: it holds
 * an opening headline and four content modules, and nothing that links to
 * `/team-login`, `/login` or `/register`.
 *
 * Every string below comes from the existing `Landing` namespace — no new
 * copy, no new keys. `heroTitle` is the one piece of copy that states what
 * ITALPROTEIN makes, so it renders as a real `<h1>` with display weight —
 * the first thing in the column — rather than through the small mono
 * `Designation` label every other module uses. `radarTitle`/`featuresTitle`/
 * `partnersTitle` double as their module's mono designation, the same
 * treatment the previous version already gave `featuresTitle` and
 * `partnersTitle` directly.
 *
 * A server component; its only client code is the scroll reveal (`Reveal`)
 * and the wordmark scan, which now lives in the rail.
 */

const CAPABILITY_ICONS = [FlaskConical, Package, ClipboardCheck, ChefHat, Bot, Users];

export default function LandingPage() {
  const t = useTranslations('Landing');
  const features = t.raw('features') as { title: string; desc: string }[];
  const stats = t.raw('stats') as { value: number; suffix: string; label: string }[];

  return (
    <PublicShell>
      {/* 1 — Headline. A first-time visitor needs to know what ITALPROTEIN
          makes without hovering anything, so this carries real display
          weight and is a genuine <h1> — not routed through `Module`'s mono
          designation, which would bury it at 11px. First thing in the
          column, so it paints immediately rather than waiting on Reveal. */}
      <div className="border-b border-white/10 pb-14 sm:pb-16">
        <h1 className="max-w-[20ch] text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
          {t('heroTitle')}
        </h1>
        <p className="mt-6 max-w-[56ch] leading-relaxed text-slate-400">{t('heroSubtitle')}</p>
      </div>

      {/* 2 — Platform radar. */}
      <Module designation={t('radarTitle')}>
        <Reveal>
          <p className="max-w-[54ch] leading-relaxed text-slate-400">{t('radarSubtitle')}</p>
        </Reveal>
        <Reveal delay={90} className="mt-10">
          <FeatureRadar />
        </Reveal>
      </Module>

      {/* 3 — Readings: the four stats as mono figures with their units. No
          designation of its own, matching the previous version, which never
          gave this strip a title either. */}
      <div className="border-b border-white/10 py-14 sm:py-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 60}>
              <p className="font-mono text-3xl font-semibold tabular-nums text-white sm:text-4xl">
                {stat.value}
                <span className="ml-0.5 text-lg text-sky-400">{stat.suffix || '·'}</span>
              </p>
              <Designation className="mt-2 text-slate-500">{stat.label}</Designation>
            </Reveal>
          ))}
        </div>
      </div>

      {/* 4 — Capabilities, as a specification list. */}
      <Module designation={t('featuresTitle')}>
        <dl className="divide-y divide-white/10 border-y border-white/10">
          {features.map((feature, i) => {
            const Icon = CAPABILITY_ICONS[i] ?? FlaskConical;
            return (
              <Reveal key={feature.title} delay={(i % 3) * 70}>
                <div className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-12 sm:gap-8">
                  <dt className="flex items-start gap-3 sm:col-span-5">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                    <span className="font-semibold text-white">{feature.title}</span>
                  </dt>
                  <dd className="text-sm leading-relaxed text-slate-400 sm:col-span-7">{feature.desc}</dd>
                </div>
              </Reveal>
            );
          })}
        </dl>
      </Module>

      {/* 5 — Partners. No CTA anywhere in this column — the rail's doors
          are the only call to action in the public face. */}
      <Module designation={t('partnersTitle')}>
        <Reveal>
          <p className="max-w-md text-sm text-slate-400">{t('partnersSubtitle')}</p>
        </Reveal>
        <Reveal delay={90} className="mt-12">
          <PartnerMarquee />
        </Reveal>
      </Module>

      <footer className="py-10 text-center font-mono text-xs tracking-wide text-slate-500">
        Creato Da : Amine , con {'<3'}
      </footer>
    </PublicShell>
  );
}
