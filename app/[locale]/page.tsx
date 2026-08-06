'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  ArrowRight, Bot, ChefHat, ClipboardCheck, FlaskConical, Package, Users,
} from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { MARKERS, PARTNERS } from '@/components/landing/partners';
import { InfiniteMovingCards } from '@/components/ui/infinite-moving-cards';
import { Timeline } from '@/components/ui/timeline';
import WorldMap from '@/components/ui/world-map';

/*
 * Public landing page — light corporate layout, following the reference the
 * client supplied: white field, navy type, one blue accent; a centred hero over
 * a soft banner; a "what we offer" grid sitting beside the product image; a
 * saturated blue call-to-action band before the footer.
 *
 * The palette is still the brand's, only inverted: brand-navy #0a1628 is now
 * type rather than background, brand-goldDark #0284c7 is the accent that reads
 * on white, and brand-gold #38bdf8 lights the CTA band.
 *
 * Kept from before: the partner logos, the Proamina® bottle, and the presence
 * map (Italy blue, other markets yellow, no lines).
 *
 * Never put operational figures on this page. A rendering of the CRM overview
 * briefly lived in the hero carrying real company counts and pipeline
 * conversion rates; the four figures in the strip are published marketing
 * claims and are the only numbers that belong here.
 */

const OFFER_ICONS = [FlaskConical, Package, ClipboardCheck, ChefHat, Bot, Users];

export default function LandingPage() {
  const t = useTranslations('Landing');
  const offers = t.raw('features') as { title: string; desc: string }[];
  const stats = t.raw('stats') as { value: number; suffix: string; label: string }[];
  const steps = t.raw('journey') as { title: string; body: string }[];

  return (
    <div className="min-h-screen bg-white text-brand-navy">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo tone="dark" href="/" />
          <nav className="flex items-center gap-2 sm:gap-5">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-goldDark sm:inline"
            >
              {t('ctaExternal')}
            </Link>
            <Link
              href="/register"
              className="hidden text-sm font-medium text-slate-600 transition-colors hover:text-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-goldDark sm:inline"
            >
              {t('ctaRegister')}
            </Link>
            <LanguageSwitcher tone="dark" />
            <Link
              href="/team-login"
              className="rounded-md bg-brand-goldDark px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-goldDark focus-visible:ring-offset-2"
            >
              {t('ctaInternal')}
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero: centred over a soft banner ─────────────────────────── */}
      <section className="px-4 pt-10 sm:pt-14">
        <div className="container">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-b from-slate-100 via-slate-50 to-white px-6 py-20 text-center sm:px-12 sm:py-28">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(2,132,199,0.10),transparent_70%)]"
              aria-hidden
            />
            <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-brand-goldDark">
              {t('eyebrow')}
            </p>
            <h1 className="relative mx-auto mt-6 max-w-[24ch] text-3xl font-bold tracking-[-0.02em] text-brand-navy sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08]">
              {t('heroTitle')}
            </h1>
            <p className="relative mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              {t('heroSubtitle')}
            </p>
            <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/team-login"
                className="rounded-md bg-brand-goldDark px-7 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-goldDark focus-visible:ring-offset-2"
              >
                {t('ctaInternal')}
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-slate-300 px-7 py-3 text-sm font-semibold text-brand-navy transition-colors hover:border-brand-goldDark hover:text-brand-goldDark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-goldDark focus-visible:ring-offset-2"
              >
                {t('ctaExternal')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── What we offer: product image beside a card grid ──────────── */}
      <section className="px-4 py-20 sm:py-24">
        <div className="container grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <div className="relative mx-auto max-w-sm rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-10 shadow-sm">
              <Image
                src="/marketing/proamina-bottle.png"
                alt="Proamina®"
                width={520}
                height={520}
                priority
                sizes="(max-width: 1024px) 60vw, 22rem"
                className="mx-auto h-auto w-[13rem] drop-shadow-xl sm:w-[16rem]"
              />
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Heading cell, as in the reference. */}
              <div className="flex flex-col justify-center rounded-xl border border-slate-200 bg-slate-50 p-6">
                <h2 className="text-2xl font-bold leading-tight tracking-[-0.02em] text-brand-navy">
                  {t('featuresTitle')}
                </h2>
                <Link
                  href="/register"
                  className="mt-5 inline-flex w-fit items-center gap-1.5 rounded-md bg-brand-goldDark px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors hover:bg-brand-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-goldDark focus-visible:ring-offset-2"
                >
                  {t('ctaRegister')} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {offers.slice(0, 5).map((offer, i) => {
                const Icon = OFFER_ICONS[i] ?? FlaskConical;
                return (
                  <div
                    key={offer.title}
                    className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
                  >
                    <Icon className="mx-auto h-6 w-6 text-brand-goldDark" />
                    <h3 className="mt-4 text-xs font-bold uppercase tracking-[0.1em] text-brand-navy">
                      {offer.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">{offer.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Figures ──────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-slate-50 px-4 py-14">
        <dl className="container grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="text-3xl font-bold tabular-nums text-brand-navy sm:text-4xl">
                  {stat.value}
                  <span className="text-brand-goldDark">{stat.suffix}</span>
                </span>
                <span className="mt-2 block text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Presence map ─────────────────────────────────────────────── */}
      <section className="px-4 py-20 sm:py-24">
        <div className="container text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-goldDark">
            {t('reachEyebrow')}
          </p>
          <h2 className="mx-auto mt-5 max-w-[22ch] text-2xl font-bold tracking-[-0.02em] text-brand-navy sm:text-3xl lg:text-4xl">
            {t('reachTitle')}
          </h2>
        </div>
        <div className="container mt-10">
          <WorldMap markers={MARKERS} homeColor="#0284c7" marketColor="#eab308" />
        </div>
      </section>

      {/* ── How a supply relationship starts ─────────────────────────── */}
      {/* Timeline brings its own white container, so this section adds none. */}
      <section className="border-t border-slate-200">
        <Timeline
          data={steps.map((step) => ({
            title: step.title,
            content: (
              <p className="max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                {step.body}
              </p>
            ),
          }))}
        />
      </section>

      {/* ── Partners ─────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 px-4 py-20">
        <div className="container text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-goldDark">
            {t('partnersTitle')}
          </p>
          <p className="mx-auto mt-4 max-w-md text-sm text-slate-500">{t('partnersSubtitle')}</p>
        </div>
        <div className="mt-12 flex justify-center">
          <InfiniteMovingCards items={PARTNERS} direction="left" speed="slow" />
        </div>
      </section>

      {/* ── Blue call-to-action band, as in the reference ─────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-r from-brand-navy via-brand-goldDark to-brand-gold px-4 py-20 text-center text-white sm:py-24">
        <div className="absolute inset-0 bg-grid opacity-[0.08]" aria-hidden />
        <div className="container relative">
          <h2 className="mx-auto max-w-[24ch] text-2xl font-bold tracking-[-0.02em] sm:text-3xl lg:text-4xl">
            {t('ctaBannerTitle')}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm text-white/85 sm:text-base">
            {t('ctaBannerSubtitle')}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/register"
              className="rounded-md bg-white px-7 py-3 text-sm font-semibold text-brand-navy shadow-md transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-goldDark"
            >
              {t('ctaRegister')}
            </Link>
            <Link
              href="/team-login"
              className="rounded-md border border-white/50 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-goldDark"
            >
              {t('ctaInternal')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-brand-navy px-4 py-10 text-center">
        <p className="text-xs tracking-wide text-slate-400">
          Creato Da : Amine , con {'<3'}
        </p>
      </footer>
    </div>
  );
}
