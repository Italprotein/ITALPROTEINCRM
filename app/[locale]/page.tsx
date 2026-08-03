'use client';

import { useTranslations } from 'next-intl';

import Image from 'next/image';

import { Link } from '@/lib/i18n/navigation';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';

import { MARKERS, PARTNERS } from '@/components/landing/partners';
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
 * The hero leads with the product: the Proamina® bottle beside the claim. It
 * briefly showed a rendering of the CRM overview instead, which put real
 * company counts and pipeline conversion rates on a public page — never put
 * operational figures here. The four numbers in the strip below are published
 * marketing claims and are fine.
 *
 * Reach is the second thesis: the map marks every country Proamina® is present
 * in — Italy in the brand's sky blue, each other market in yellow, with nothing
 * drawn between them, so it states presence rather than implying routes. The
 * timeline earns its ordering because first contact → NDA → sample → testing →
 * supply is a real sequence — it is the pipeline this CRM tracks.
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

      {/* ── Header ───────────────────────────────────────────────────────
          The rebuild dropped the header entirely, so the page opened on a
          band of empty navy with no logo and no way to change language. */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-navy/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo tone="light" href="/" />
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher tone="light" />
            <Link
              href="/login"
              className="hidden text-sm font-medium text-slate-300 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:inline"
            >
              {t('ctaExternal')}
            </Link>
            <Link
              href="/team-login"
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:border-sky-400/50 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {t('ctaInternal')}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────
          Two columns: the claim on the left, the thing being claimed on the
          right. The previous single centred column left the fold two-thirds
          empty. */}
      <section className="relative overflow-hidden px-4 py-16 sm:py-24">
        <Spotlight
          gradientFirst="radial-gradient(68% 68% at 50% 30%, rgba(56,189,248,0.10) 0%, rgba(56,189,248,0.03) 50%, transparent 80%)"
          gradientSecond="radial-gradient(50% 50% at 50% 50%, rgba(14,184,154,0.08) 0%, transparent 80%)"
          gradientThird="radial-gradient(50% 50% at 50% 50%, rgba(56,189,248,0.06) 0%, transparent 80%)"
        />

        <div className="container relative z-10 grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-6">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.28em] text-sky-300/80">
              {t('eyebrow')}
            </p>

            <TextGenerateEffect
              words={t('heroTitle')}
              className="mt-6 text-4xl font-extrabold tracking-[-0.03em] text-white sm:text-5xl"
              duration={0.6}
            />

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              {t('heroSubtitle')}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              {/* Link wraps the gradient rather than being passed as `as`: the
                  component's props do not forward href, so `as={Link}`
                  typechecks only by accident and drops the navigation. */}
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
          </div>

          {/* The product itself. This column briefly held a rendering of the
              CRM overview carrying real counts and pipeline conversion rates —
              business figures that must not sit on a public page. */}
          <div className="relative lg:col-span-6">
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_68%)] blur-2xl"
              aria-hidden
            />
            <Image
              src="/marketing/proamina-bottle.png"
              alt="Proamina®"
              width={520}
              height={520}
              priority
              sizes="(max-width: 1024px) 70vw, 30rem"
              className="relative mx-auto h-auto w-[16rem] drop-shadow-2xl sm:w-[22rem] lg:w-[26rem]"
            />
          </div>
        </div>
      </section>

      {/* ── Figures ──────────────────────────────────────────────────── */}
      <section className="border-t border-white/10 py-12">
        <dl className="container grid grid-cols-2 gap-y-8 sm:grid-cols-4">
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
          <WorldMap markers={MARKERS} />
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
