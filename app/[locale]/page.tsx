'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { LANES, PARTNERS } from '@/components/landing/partners';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { InfiniteMovingCards } from '@/components/ui/infinite-moving-cards';
import { Spotlight } from '@/components/ui/spotlight-new';
import { TextGenerateEffect } from '@/components/ui/text-generate-effect';
import { Timeline } from '@/components/ui/timeline';
import WorldMap from '@/components/ui/world-map';

/*
 * Public landing page, rebuilt on the Aceternity component set.
 *
 * Nothing from the previous versions survives except the brand palette and the
 * partner logos. The rail, the modules, the wordmark scan and the editorial
 * hero are all gone.
 *
 * The thesis is reach. With no product photograph, the most characteristic true
 * thing about an ingredient house in Bologna is who buys from it and where it
 * ships — so the world map is the signature, and every arc ends somewhere
 * Proamina® actually goes. The timeline earns its ordering because first
 * contact → NDA → sample → testing → supply is a real sequence: it is the
 * pipeline this CRM tracks.
 *
 * Palette unchanged: brand-navy #0a1628 field, brand-gold #38bdf8 (a sky blue
 * despite the token name) as the accent, brand-teal #0eb89a as the second.
 */

export default function LandingPage() {
  const t = useTranslations('Landing');
  const stats = t.raw('stats') as { value: number; suffix: string; label: string }[];
  const steps = t.raw('journey') as { title: string; body: string }[];

  return (
    <main className="min-h-screen bg-brand-navy text-white">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-4 py-20">
        <Spotlight
          gradientFirst="radial-gradient(68% 68% at 50% 30%, rgba(56,189,248,0.10) 0%, rgba(56,189,248,0.03) 50%, transparent 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, rgba(14,184,154,0.08) 0%, transparent 80%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, rgba(56,189,248,0.06) 0%, transparent 80%)"
        />

        <p className="relative z-10 font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-sky-300/80">
          {t('eyebrow')}
        </p>

        <TextGenerateEffect
          words={t('heroTitle')}
          className="relative z-10 mt-8 max-w-4xl text-center text-4xl font-extrabold tracking-[-0.03em] text-white sm:text-5xl lg:text-6xl"
          duration={0.6}
        />

        <p className="relative z-10 mt-7 max-w-2xl text-center text-base leading-relaxed text-slate-400 sm:text-lg">
          {t('heroSubtitle')}
        </p>

        <div className="relative z-10 mt-11 flex flex-wrap items-center justify-center gap-4">
          {/* Link wraps the gradient rather than being passed as `as`: the
              component's props do not forward href, so `as={Link}` typechecks
              only by accident and drops the navigation. */}
          <Link href="/team-login" className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
            <HoverBorderGradient
              as="span"
              containerClassName="rounded-full"
              className="block bg-brand-navy px-6 py-3 text-sm font-medium text-white"
            >
              {t('ctaInternal')}
            </HoverBorderGradient>
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-sky-400/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {t('ctaExternal')}
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-sky-300 underline-offset-4 transition-colors hover:text-sky-200 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {t('ctaRegister')}
          </Link>
        </div>

        {/* Figures, small and factual, directly under the doors. */}
        <dl className="relative z-10 mt-16 grid w-full max-w-3xl grid-cols-2 gap-y-8 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="font-mono text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                  {stat.value}
                  <span className="text-sky-400">{stat.suffix}</span>
                </span>
                <span className="mt-1.5 block font-mono text-[0.625rem] uppercase tracking-[0.16em] text-slate-500">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Signature: where Proamina® goes ──────────────────────────── */}
      <section className="border-t border-white/10 py-20 sm:py-28">
        <div className="container">
          <p className="text-center font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-sky-300/80">
            {t('reachEyebrow')}
          </p>
          <h2 className="mx-auto mt-5 max-w-[22ch] text-center text-2xl font-extrabold tracking-[-0.025em] sm:text-3xl lg:text-4xl">
            {t('reachTitle')}
          </h2>
        </div>
        <div className="mt-10">
          <WorldMap dots={LANES} lineColor="#38bdf8" />
        </div>
      </section>

      {/* ── Partners: the logos, the one asset kept ──────────────────── */}
      <section className="border-t border-white/10 py-20 sm:py-24">
        <div className="container">
          <p className="text-center font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-sky-300/80">
            {t('partnersTitle')}
          </p>
          <p className="mx-auto mt-4 max-w-md text-center text-sm text-slate-400">
            {t('partnersSubtitle')}
          </p>
        </div>
        <div className="mt-12 flex justify-center">
          <InfiniteMovingCards items={PARTNERS} direction="left" speed="slow" />
        </div>
      </section>

      {/* ── How a supply relationship actually starts ────────────────── */}
      <section className="border-t border-white/10">
        <Timeline
          data={steps.map((step) => ({
            title: step.title,
            content: (
              <p className="max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
                {step.body}
              </p>
            ),
          }))}
        />
      </section>

      {/* ── Close ────────────────────────────────────────────────────── */}
      <section className="border-t border-white/10 px-4 py-24 text-center sm:py-32">
        <h2 className="mx-auto max-w-[20ch] text-2xl font-extrabold tracking-[-0.025em] sm:text-3xl lg:text-4xl">
          {t('ctaBannerTitle')}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-slate-400">{t('ctaBannerSubtitle')}</p>
        <div className="mt-10 flex justify-center">
          <Link href="/register" className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
            <HoverBorderGradient
              as="span"
              containerClassName="rounded-full"
              className="block bg-brand-navy px-7 py-3 text-sm font-medium text-white"
            >
              {t('ctaRegister')}
            </HoverBorderGradient>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center font-mono text-xs tracking-wide text-slate-500">
        Creato Da : Amine , con {'<3'}
      </footer>
    </main>
  );
}
