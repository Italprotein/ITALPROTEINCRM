import Image from 'next/image';
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
 * copy, no new keys. `radarTitle`/`featuresTitle`/`partnersTitle` double as
 * their module's mono designation, the same treatment the previous version
 * already gave `featuresTitle` and `partnersTitle` directly.
 *
 * The headline states the *product*, not the software. `heroTitle` ("the
 * operating system for the ITALPROTEIN business") describes this CRM, and
 * when it held the display slot a first-time visitor learned only that the
 * company sells itself internal software — what Italprotein actually makes
 * survived in an 11px caption and one trailing clause. So `heroSubtitle` is
 * split at its em dash: the product half leads at display weight beside the
 * Proamina® bottle, and the platform (`heroTitle` + `platformNote`) follows
 * behind a hairline as the supporting note it is. Split rather than rewritten
 * because the copy is fixed — see the "no new copy" rule above.
 *
 * A server component; its only client code is the scroll reveal (`Reveal`)
 * and the wordmark scan, which now lives in the rail.
 */

const CAPABILITY_ICONS = [FlaskConical, Package, ClipboardCheck, ChefHat, Bot, Users];

export default function LandingPage() {
  const t = useTranslations('Landing');
  const tCommon = useTranslations('Common');
  const features = t.raw('features') as { title: string; desc: string }[];
  const stats = t.raw('stats') as { value: number; suffix: string; label: string }[];

  /* `heroSubtitle` is one sentence hinged on an em dash: the platform clause,
     then what the product is ("… Proamina® — Italprotein's patented 100%
     protein sweetener."). Both locales carry the hinge; if a future
     translation drops it the whole sentence simply becomes the definition
     line, which still reads. */
  const subtitle = t('heroSubtitle');
  const hinge = subtitle.lastIndexOf(' — ');
  const productLine = hinge === -1 ? subtitle : subtitle.slice(hinge + 3);

  return (
    <PublicShell>
      {/* 1 — Headline. The largest type on the page names the product and
          says what it is, next to a photograph of it: a first-time visitor
          must learn what this company makes without hovering anything or
          reading to the end of a paragraph. First thing in the column and
          outside `Reveal`, so it paints on the first frame. */}
      {/* Two columns only from `xl`: at exactly `lg` the rail has already
          taken 26rem, so a 17rem product column would leave the headline
          about 18rem to sit in. Below that the bottle stacks under the
          text. */}
      <div className="grid items-center gap-10 border-b border-white/10 py-12 sm:py-16 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-14">
        <div>
          <Designation className="text-sky-300/90">{t('eyebrow')}</Designation>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl xl:text-6xl">
            {tCommon('productName')}
            <span className="mt-4 block max-w-[22ch] text-xl font-semibold leading-snug tracking-[-0.01em] text-slate-200 sm:text-2xl">
              {productLine}
            </span>
          </h1>

          {/* The platform, deliberately subordinate: behind a hairline, at
              body size. It is what this site runs on, not what the company
              sells. */}
          <div className="mt-8 max-w-[52ch] border-l border-white/15 pl-4">
            <p className="text-sm font-medium text-slate-300">{t('heroTitle')}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t('platformNote')}</p>
          </div>
        </div>

        {/* The product itself. `priority`: it is the largest above-the-fold
            element on the page. */}
        <div className="relative mx-auto w-full max-w-[14rem] sm:max-w-[16rem] xl:mx-0 xl:w-[17rem] xl:max-w-none">
          <div
            className="absolute left-1/2 top-1/2 h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,theme(colors.brand.gold/0.18),transparent_65%)] blur-2xl"
            aria-hidden
          />
          <Image
            src="/marketing/proamina-bottle.png"
            alt={t('heroCaption')}
            width={500}
            height={500}
            priority
            sizes="(max-width: 1024px) 60vw, 17rem"
            className="relative z-10 h-auto w-full drop-shadow-2xl"
          />
        </div>
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
