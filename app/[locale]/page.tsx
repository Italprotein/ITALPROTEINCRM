import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  ArrowRight, Bot, ChefHat, ClipboardCheck, FlaskConical,
  Globe2, Mail, Package, Phone, Users,
} from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { AccessMenu } from '@/components/landing/access-menu';
import { FeatureRadar } from '@/components/landing/feature-radar';
import { PartnerMarquee } from '@/components/landing/partner-marquee';
import { Reveal } from '@/components/landing/reveal';
import { WordmarkScan } from '@/components/landing/wordmark-scan';
import { Button } from '@/components/ui/button';
import { siteContact } from '@/lib/config/site';
import { cn } from '@/lib/utils';

/*
 * Public landing page — laboratory-instrument direction.
 *
 * An ingredient house sells on its numbers, so the page is built like a panel:
 * one dark field, values in monospace with their units, hairline module rules,
 * and no decorative colour. Playfair is deliberately absent — a measuring
 * instrument does not speak in a Renaissance serif — so the display voice is
 * Inter at its heaviest with tight tracking, and every label and figure is set
 * in the system monospace stack, which costs no download.
 *
 * Motion is spent in exactly one place: the wordmark scan. Nothing on this page
 * animates on a loop except the partner marquee, which is CSS.
 *
 * A server component; its only client code is the access dropdown, the language
 * switcher, the scroll reveal and the scan itself.
 */

const CAPABILITY_ICONS = [FlaskConical, Package, ClipboardCheck, ChefHat, Bot, Users];

/** Instrument label voice: small, wide-tracked, monospace. */
function Designation({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('font-mono text-[0.6875rem] uppercase tracking-[0.18em]', className)}>
      {children}
    </p>
  );
}

/** A module rule: hairline with a lit tick at its head. */
function ModuleRule({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-2.5 w-px bg-sky-400" aria-hidden />
      <Designation className="text-sky-300/90">{label}</Designation>
      <span className="h-px flex-1 bg-white/10" aria-hidden />
    </div>
  );
}

export default function LandingPage() {
  const t = useTranslations('Landing');
  const capabilities = t.raw('features') as { title: string; desc: string }[];
  const readings = t.raw('stats') as { value: number; suffix: string; label: string }[];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-brand-navy text-slate-200">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-navy/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo tone="light" href="/" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher tone="light" />
            <AccessMenu tone="light" />
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────
          Not wrapped in Reveal: above the fold, so it paints immediately. */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-grid opacity-[0.07]" aria-hidden />
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.14),transparent_70%)]"
          aria-hidden
        />

        <div className="container relative py-14 sm:py-20">
          <Designation className="text-sky-300/90">{t('eyebrow')}</Designation>

          {/* Signature: the wordmark under a densitometer. */}
          <div className="mt-8">
            <WordmarkScan caption={t('heroCaption')} />
          </div>

          <div className="mt-14 grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-7">
              <h1 className="max-w-[20ch] text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-4xl lg:text-5xl">
                {t('heroTitle')}
              </h1>
              <p className="mt-6 max-w-[56ch] leading-relaxed text-slate-400">{t('heroSubtitle')}</p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild variant="gold" size="lg">
                  <Link href="/team-login">
                    {t('ctaInternal')} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/[0.04] text-white hover:bg-white/10"
                >
                  <Link href="/register">{t('ctaRegister')}</Link>
                </Button>
              </div>
            </div>

            {/* Specimen plate. */}
            <div className="relative lg:col-span-5">
              <div className="relative flex items-end justify-center rounded-xl border border-white/10 bg-white/[0.02] px-6 pb-6 pt-10">
                <div
                  className="pointer-events-none absolute inset-x-10 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(56,189,248,0.16),transparent_70%)]"
                  aria-hidden
                />
                <Image
                  src="/marketing/proamina-bottle.png"
                  alt="Proamina®"
                  width={380}
                  height={380}
                  priority
                  sizes="(max-width: 1024px) 55vw, 20rem"
                  className="relative z-10 h-auto w-[12rem] drop-shadow-2xl sm:w-[15rem]"
                />
              </div>
              <p className="mt-3 border-l border-sky-400/30 pl-3 font-mono text-[0.6875rem] leading-relaxed text-slate-500">
                {t('platformNote')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Readings ───────────────────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="container py-12">
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {readings.map((reading, i) => (
              <Reveal key={reading.label} delay={i * 60}>
                <p className="font-mono text-3xl font-semibold tabular-nums text-white sm:text-4xl">
                  {reading.value}
                  <span className="ml-0.5 text-lg text-sky-400">{reading.suffix || '·'}</span>
                </p>
                <Designation className="mt-2 text-slate-500">{reading.label}</Designation>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform ───────────────────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="container py-20 sm:py-24">
          <Reveal><ModuleRule label={t('radarBadge')} /></Reveal>
          <div className="mt-10 grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
            <div>
              <Reveal>
                <h2 className="max-w-[20ch] text-2xl font-extrabold leading-[1.12] tracking-[-0.025em] text-white sm:text-3xl lg:text-4xl">
                  {t('radarTitle')}
                </h2>
              </Reveal>
              <Reveal delay={90}>
                <p className="mt-5 max-w-[54ch] leading-relaxed text-slate-400">{t('radarSubtitle')}</p>
              </Reveal>
              <Reveal delay={170}>
                <Button asChild variant="gold" size="lg" className="mt-8">
                  <Link href="/team-login">
                    {t('ctaInternal')} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </Reveal>
            </div>
            <Reveal delay={120}><FeatureRadar /></Reveal>
          </div>
        </div>
      </section>

      {/* ── Access channels ────────────────────────────────────────── */}
      <section className="border-b border-white/10">
        <div className="container py-20 sm:py-24">
          <Reveal><ModuleRule label={t('productsTitle')} /></Reveal>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { href: '/team-login', title: t('internalTitle'), desc: t('internalDesc'), cta: t('ctaInternal'), code: 'CRM' },
              { href: '/login', title: t('externalTitle'), desc: t('externalDesc'), cta: t('ctaExternal'), code: 'PORTALE' },
            ].map((channel, i) => (
              <Reveal key={channel.href} delay={i * 110} className="h-full">
                <Link
                  href={channel.href}
                  className="group flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.025] p-7 transition-colors duration-300 hover:border-sky-400/40 hover:bg-white/[0.05] sm:p-9"
                >
                  <Designation className="text-sky-300/80">{channel.code}</Designation>
                  <h3 className="mt-5 text-xl font-extrabold tracking-[-0.02em] text-white">{channel.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-400">{channel.desc}</p>
                  <span className="mt-7 inline-flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-sky-300">
                    {channel.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities, as a specification list ──────────────────── */}
      <section className="border-b border-white/10">
        <div className="container py-20 sm:py-24">
          <Reveal><ModuleRule label={t('featuresTitle')} /></Reveal>
          <dl className="mt-10 divide-y divide-white/10 border-y border-white/10">
            {capabilities.map((capability, i) => {
              const Icon = CAPABILITY_ICONS[i] ?? FlaskConical;
              return (
                <Reveal key={capability.title} delay={(i % 3) * 70}>
                  <div className="grid grid-cols-1 gap-2 py-6 sm:grid-cols-12 sm:gap-8">
                    <dt className="flex items-start gap-3 sm:col-span-5">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      <span className="font-semibold text-white">{capability.title}</span>
                    </dt>
                    <dd className="text-sm leading-relaxed text-slate-400 sm:col-span-7">
                      {capability.desc}
                    </dd>
                  </div>
                </Reveal>
              );
            })}
          </dl>
        </div>
      </section>

      {/* ── Partners ───────────────────────────────────────────────── */}
      <section className="border-b border-white/10 py-20 sm:py-24">
        <div className="container">
          <Reveal>
            <ModuleRule label={t('partnersTitle')} />
            <p className="mt-4 max-w-md text-sm text-slate-400">{t('partnersSubtitle')}</p>
          </Reveal>
        </div>
        <div className="mt-12">
          <PartnerMarquee />
        </div>
      </section>

      {/* ── Closing ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-grid opacity-[0.07]" aria-hidden />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12),transparent_70%)]"
          aria-hidden
        />
        <div className="container relative py-20 text-center sm:py-24">
          <Reveal>
            <h2 className="mx-auto max-w-[22ch] text-2xl font-extrabold leading-[1.12] tracking-[-0.025em] text-white sm:text-3xl lg:text-4xl">
              {t('ctaBannerTitle')}
            </h2>
          </Reveal>
          <Reveal delay={90}>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-slate-400">{t('ctaBannerSubtitle')}</p>
          </Reveal>
          <Reveal delay={170}>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild variant="gold" size="lg">
                <Link href="/team-login">
                  {t('ctaInternal')} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/20 bg-white/[0.04] text-white hover:bg-white/10"
              >
                <Link href="/register">{t('ctaRegister')}</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="py-10 text-slate-500">
        <div className="container flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Logo tone="light" href="/" />
            <p className="max-w-xl text-xs leading-relaxed">{t('footerNote')}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 lg:min-w-[34rem]">
            <a
              href={siteContact.emailHref}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-mono text-slate-400 transition-colors hover:border-sky-400/40 hover:text-sky-300"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="min-w-0 truncate">{siteContact.email}</span>
            </a>
            {siteContact.phones.map((phone) => (
              <a
                key={phone.id}
                href={phone.href}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-mono text-slate-400 transition-colors hover:border-sky-400/40 hover:text-sky-300"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{phone.display}</span>
              </a>
            ))}
            <a
              href={siteContact.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 font-mono text-slate-400 transition-colors hover:border-sky-400/40 hover:text-sky-300"
            >
              <Globe2 className="h-3.5 w-3.5" />
              <span>{t('contactWebsite')}</span>
            </a>
          </div>
        </div>
        <div className="container mt-8 border-t border-white/10 pt-6 text-center font-mono text-xs tracking-wide text-slate-500">
          Creato Da : Amine , con {'<3'}
        </div>
      </footer>
    </div>
  );
}
