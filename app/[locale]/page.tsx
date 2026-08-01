import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  ArrowRight, Building2, FlaskConical, Package, ClipboardCheck,
  ChefHat, Bot, Users, Globe2, Mail, Phone,
} from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { AccessMenu } from '@/components/landing/access-menu';
import { FeatureRadar } from '@/components/landing/feature-radar';
import { PartnerMarquee } from '@/components/landing/partner-marquee';
import { Reveal } from '@/components/landing/reveal';
import { Button } from '@/components/ui/button';
import { siteContact } from '@/lib/config/site';
import { cn } from '@/lib/utils';

/*
 * Public landing page. A server component on purpose: its own client code is
 * just the access dropdown, the language switcher and the scroll-reveal
 * wrapper. Nothing on it animates on a loop except the partner marquee, which
 * is CSS. The previous version was one 481-line client component that ran more
 * than twenty animations forever — three orbs per dark band, a rotating ring, a
 * pulsing gradient, a bobbing bottle and seal, and thirteen more in the radar.
 *
 * Note: framer-motion still reaches this route, because the locale layout wraps
 * every page in MotionConfig and renders Toaster. Getting it off the marketing
 * page means moving both out of the shared layout, which is an app-wide change.
 *
 * Typography does the work: Playfair at display scale for voice, Inter at
 * 0.2em tracking for the technical register an ingredient house speaks in.
 */

const FEATURE_ICONS = [FlaskConical, Package, ClipboardCheck, ChefHat, Bot, Users];

/** The technical register: section labels, units, captions. */
function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('text-[0.6875rem] font-semibold uppercase tracking-[0.2em]', className)}>
      {children}
    </p>
  );
}

export default function LandingPage() {
  const t = useTranslations('Landing');
  const features = t.raw('features') as { title: string; desc: string }[];
  const stats = t.raw('stats') as { value: number; suffix: string; label: string }[];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">

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
          Deliberately not wrapped in Reveal: above the fold, so it paints
          on the first frame instead of waiting for hydration. */}
      <section className="relative overflow-hidden bg-brand-navy text-white">
        <div className="absolute inset-0 bg-grid opacity-[0.055]" aria-hidden />
        <div
          className="pointer-events-none absolute -right-48 -top-40 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.16),transparent_68%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-40 top-1/2 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(14,184,154,0.13),transparent_70%)]"
          aria-hidden
        />

        <div className="container relative grid grid-cols-1 items-center gap-16 py-20 sm:py-28 lg:grid-cols-12 lg:gap-10 lg:py-36">
          <div className="lg:col-span-7">
            <Kicker className="text-brand-goldLight">{t('eyebrow')}</Kicker>

            <h1 className="mt-6 max-w-[16ch] font-display text-[2.6rem] font-bold leading-[1.04] tracking-[-0.02em] sm:text-6xl lg:text-[4.25rem]">
              {t('heroTitle')}
            </h1>

            <p className="mt-7 max-w-[54ch] text-lg leading-relaxed text-slate-300">
              {t('heroSubtitle')}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button asChild variant="gold" size="lg">
                <Link href="/team-login">
                  {t('ctaInternal')} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/register">{t('ctaRegister')}</Link>
              </Button>
            </div>

            <p className="mt-9 max-w-[52ch] border-l border-white/15 pl-4 text-sm leading-relaxed text-slate-400">
              {t('platformNote')}
            </p>
          </div>

          {/* Signature: the bottle presented as a catalogue plate — stood in a
              light shaft, ruled off, captioned in the technical register. */}
          <figure className="relative mx-auto flex w-full max-w-sm flex-col lg:col-span-5">
            <div className="relative flex min-h-[20rem] items-end justify-center">
              <div
                className="absolute inset-y-0 left-1/2 w-[64%] -translate-x-1/2 border-x border-white/[0.07] bg-gradient-to-b from-brand-gold/[0.16] via-brand-gold/[0.04] to-transparent"
                aria-hidden
              />
              <Image
                src="/marketing/proamina-bottle.png"
                alt="Proamina®"
                width={380}
                height={380}
                priority
                sizes="(max-width: 1024px) 60vw, 22rem"
                className="relative z-10 h-auto w-[15rem] drop-shadow-2xl sm:w-[19rem]"
              />
              <Image
                src="/brand/proamina-seal.png"
                alt=""
                aria-hidden
                width={96}
                height={96}
                loading="lazy"
                className="absolute -left-1 bottom-0 z-20 hidden h-24 w-24 rounded-2xl bg-white object-contain p-2 shadow-xl sm:block"
              />
            </div>
            <figcaption className="mt-7 border-t border-white/15 pt-3.5">
              <Kicker className="text-center text-slate-400">{t('heroCaption')}</Kicker>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── Figures ────────────────────────────────────────────────── */}
      <section className="border-b bg-brand-cream/40">
        <div className="container py-14 sm:py-16">
          <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-border/70">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} delay={i * 70} className="px-4 text-center">
                <p className="font-display text-4xl font-bold leading-none tracking-[-0.02em] text-foreground tabular-nums sm:text-5xl">
                  {stat.value}
                  <span className="align-super text-2xl text-brand-goldDark sm:text-3xl">{stat.suffix}</span>
                </p>
                <Kicker className="mt-3 text-muted-foreground">{stat.label}</Kicker>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Platform ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-navy py-20 text-white sm:py-28">
        <div className="absolute inset-0 bg-grid opacity-[0.05]" aria-hidden />
        <div
          className="pointer-events-none absolute -left-32 top-0 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.12),transparent_70%)]"
          aria-hidden
        />
        <div className="container relative grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div>
            <Reveal>
              <Kicker className="text-brand-goldLight">{t('radarBadge')}</Kicker>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-5 max-w-[18ch] font-display text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl lg:text-5xl">
                {t('radarTitle')}
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-[52ch] leading-relaxed text-slate-300">{t('radarSubtitle')}</p>
            </Reveal>
            <Reveal delay={240}>
              <Button asChild variant="gold" size="lg" className="mt-9">
                <Link href="/team-login">
                  {t('ctaInternal')} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <FeatureRadar />
          </Reveal>
        </div>
      </section>

      {/* ── Two doors ──────────────────────────────────────────────── */}
      <section className="border-b bg-background py-20 sm:py-28">
        <div className="container">
          <Reveal>
            <Kicker className="text-brand-goldDark">{t('productsTitle')}</Kicker>
          </Reveal>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
            {[
              {
                href: '/team-login',
                icon: <Building2 className="h-5 w-5" />,
                title: t('internalTitle'),
                desc: t('internalDesc'),
                cta: t('ctaInternal'),
                tone: 'bg-brand-navy text-white',
              },
              {
                href: '/login',
                icon: <FlaskConical className="h-5 w-5" />,
                title: t('externalTitle'),
                desc: t('externalDesc'),
                cta: t('ctaExternal'),
                tone: 'bg-brand-gold/15 text-brand-goldDark',
              },
            ].map((door, i) => (
              <Reveal key={door.href} delay={i * 110} className="h-full">
                <Link
                  href={door.href}
                  className="group flex h-full flex-col rounded-2xl border bg-card p-8 shadow-sm transition-shadow duration-300 hover:shadow-lg sm:p-10"
                >
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-xl', door.tone)}>
                    {door.icon}
                  </span>
                  <h3 className="mt-6 font-display text-2xl font-bold tracking-[-0.01em]">{door.title}</h3>
                  <p className="mt-3 flex-1 leading-relaxed text-muted-foreground">{door.desc}</p>
                  <span className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand-goldDark">
                    {door.cta}
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────────────── */}
      <section className="border-b bg-background py-20 sm:py-28">
        <div className="container">
          <Reveal>
            <h2 className="max-w-[20ch] font-display text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
              {t('featuresTitle')}
            </h2>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? FlaskConical;
              return (
                <Reveal key={f.title} delay={(i % 3) * 90}>
                  <span className="block h-px w-10 bg-brand-goldDark" aria-hidden />
                  <Icon className="mt-5 h-5 w-5 text-brand-goldDark" />
                  <h3 className="mt-4 font-display text-xl font-bold tracking-[-0.01em]">{f.title}</h3>
                  <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Partners ───────────────────────────────────────────────── */}
      <section className="border-b bg-background py-20 sm:py-24">
        <div className="container">
          <Reveal className="text-center">
            <Kicker className="text-brand-goldDark">{t('partnersTitle')}</Kicker>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{t('partnersSubtitle')}</p>
          </Reveal>
        </div>
        <div className="mt-12">
          <PartnerMarquee />
        </div>
      </section>

      {/* ── Closing ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-navy py-20 text-white sm:py-28">
        <div className="absolute inset-0 bg-grid opacity-[0.06]" aria-hidden />
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.13),transparent_70%)]"
          aria-hidden
        />
        <div className="container relative text-center">
          <Reveal>
            <Globe2 className="mx-auto h-9 w-9 text-brand-gold/70" />
          </Reveal>
          <Reveal delay={90}>
            <h2 className="mx-auto mt-6 max-w-[20ch] font-display text-3xl font-bold leading-[1.1] tracking-[-0.02em] sm:text-4xl lg:text-5xl">
              {t('ctaBannerTitle')}
            </h2>
          </Reveal>
          <Reveal delay={170}>
            <p className="mx-auto mt-5 max-w-xl leading-relaxed text-slate-300">{t('ctaBannerSubtitle')}</p>
          </Reveal>
          <Reveal delay={250}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild variant="gold" size="lg">
                <Link href="/team-login">
                  {t('ctaInternal')} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/25 bg-white/5 text-white hover:bg-white/10"
              >
                <Link href="/register">{t('ctaRegister')}</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t bg-brand-navy py-10 text-slate-400">
        <div className="container flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Logo tone="light" href="/" />
            <p className="max-w-xl text-xs leading-relaxed">{t('footerNote')}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 lg:min-w-[34rem]">
            <a
              href={siteContact.emailHref}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-300 transition-colors hover:border-brand-gold/50 hover:text-brand-gold"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="min-w-0 truncate">{siteContact.email}</span>
            </a>
            {siteContact.phones.map((phone) => (
              <a
                key={phone.id}
                href={phone.href}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-300 transition-colors hover:border-brand-gold/50 hover:text-brand-gold"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>{phone.display}</span>
              </a>
            ))}
            <a
              href={siteContact.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-slate-300 transition-colors hover:border-brand-gold/50 hover:text-brand-gold"
            >
              <Globe2 className="h-3.5 w-3.5" />
              <span>{t('contactWebsite')}</span>
            </a>
          </div>
        </div>
        <div className="container mt-8 border-t border-white/10 pt-6 text-center text-xs tracking-wide text-slate-400">
          Creato Da : Amine , con {'<3'}
        </div>
      </footer>
    </div>
  );
}
