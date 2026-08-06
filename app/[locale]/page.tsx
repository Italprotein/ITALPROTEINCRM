'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import {
  ArrowRight,
  Bot,
  ChefHat,
  ClipboardCheck,
  FlaskConical,
  Globe2,
  Mail,
  Package,
  Phone,
  Users,
} from 'lucide-react';

import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { Reveal } from '@/components/landing/reveal';
import { MARKERS, PARTNERS } from '@/components/landing/partners';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { InfiniteMovingCards } from '@/components/ui/infinite-moving-cards';
import WorldMap from '@/components/ui/world-map';
import { siteContact } from '@/lib/config/site';
import { Link } from '@/lib/i18n/navigation';

const OFFER_ICONS = [FlaskConical, Package, ClipboardCheck, ChefHat, Bot, Users];

export default function LandingPage() {
  const t = useTranslations('Landing');
  const offers = t.raw('features') as { title: string; desc: string }[];
  const stats = t.raw('stats') as { value: number; suffix: string; label: string }[];
  const steps = t.raw('journey') as { title: string; body: string }[];

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3 sm:h-[4.5rem]">
          <Logo tone="dark" href="/" />

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
            >
              {t('ctaExternal')}
            </Link>
            <Link
              href="/register"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
            >
              {t('ctaRegister')}
            </Link>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <LanguageSwitcher tone="dark" compact />
            <ThemeToggle tone="dark" />
            <Link
              href="/team-login"
              aria-label={t('ctaInternal')}
              className="ml-1 inline-flex min-h-10 items-center justify-center rounded-md bg-brand-navy px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-molecular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-brand-molecular dark:hover:bg-brand-blueBright dark:hover:text-brand-navy"
            >
              <span className="hidden sm:inline">{t('ctaInternal')}</span>
              <span className="sm:hidden" aria-hidden>CRM</span>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate border-b border-border/70 px-4 py-10 sm:py-14 lg:py-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(circle_at_78%_16%,rgba(37,99,235,0.10),transparent_38%)] dark:bg-[radial-gradient(circle_at_78%_16%,rgba(56,189,248,0.11),transparent_38%)]" aria-hidden />
          <div className="container grid items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(30rem,1.1fr)] lg:gap-16">
            <div className="motion-safe:animate-fade-up">
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-molecular dark:text-brand-gold">
                {t('eyebrow')}
              </p>
              <h1 className="mt-6 max-w-[18ch] text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.045em] text-brand-navy dark:text-white sm:text-5xl lg:text-[4.5rem]">
                {t('heroTitle')}
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {t('heroSubtitle')}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/team-login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-molecular px-6 text-sm font-semibold text-white shadow-md transition-[background-color,color,transform] hover:-translate-y-0.5 hover:bg-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-brand-blueBright dark:hover:text-brand-navy motion-reduce:transform-none"
                >
                  {t('ctaInternal')}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-semibold text-card-foreground shadow-xs transition-colors hover:border-brand-goldDark/60 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {t('ctaExternal')}
                </Link>
              </div>
            </div>

            <figure className="relative min-h-[29rem] overflow-hidden rounded-[1.75rem] border border-sky-300/20 bg-brand-navy shadow-[0_28px_80px_-36px_rgba(10,22,40,0.55)] motion-safe:animate-scale-in sm:min-h-[35rem] lg:min-h-[39rem]">
              <Image
                src="/marketing/powder-marble.jpg"
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover opacity-35 grayscale"
              />
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(10,22,40,0.22),rgba(10,22,40,0.62)_58%,rgba(10,22,40,0.96))]" aria-hidden />
              <div className="absolute inset-y-20 left-5 w-5 border-y border-sky-300/45 bg-[repeating-linear-gradient(to_bottom,rgba(125,211,252,0.65)_0,rgba(125,211,252,0.65)_1px,transparent_1px,transparent_18px)] sm:left-7" aria-hidden />
              <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-4 border-b border-white/15 pb-4 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-sky-200 sm:inset-x-7 sm:top-7">
                <span>Proamina®</span>
                <span className="text-right text-white/55">{stats[1]?.value}{stats[1]?.suffix} {stats[1]?.label}</span>
              </div>
              <div className="absolute inset-x-12 bottom-16 top-20 flex items-end justify-center sm:inset-x-20 sm:bottom-20">
                <Image
                  src="/marketing/proamina-bottle.png"
                  alt="Proamina®"
                  width={520}
                  height={520}
                  priority
                  sizes="(max-width: 640px) 60vw, 24rem"
                  className="h-auto w-full max-w-[20rem] drop-shadow-[0_30px_38px_rgba(0,0,0,0.38)] sm:max-w-[25rem]"
                />
              </div>
              <figcaption className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-5 border-t border-white/15 pt-4 sm:inset-x-7 sm:bottom-7">
                <span className="max-w-[28rem] font-mono text-[0.625rem] uppercase leading-relaxed tracking-[0.16em] text-white/65 sm:text-[0.6875rem]">
                  {t('heroCaption')}
                </span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-gold shadow-[0_0_0_5px_rgba(56,189,248,0.12)]" aria-hidden />
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="border-b border-border/70 bg-muted/35 px-4" aria-label={t('platformNote')}>
          <dl className="container grid grid-cols-2 lg:grid-cols-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className={`py-7 sm:py-9 ${index % 2 === 1 ? 'border-l border-border' : ''} ${index > 1 ? 'border-t border-border lg:border-t-0' : ''} ${index > 0 ? 'lg:border-l lg:border-border' : ''} sm:px-6 lg:px-8`}
              >
                <dt className="mt-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.16em] text-muted-foreground sm:text-[0.6875rem]">
                  {stat.label}
                </dt>
                <dd className="text-3xl font-semibold tracking-[-0.035em] text-brand-navy dark:text-white sm:text-4xl">
                  {stat.value}<span className="text-brand-goldDark dark:text-brand-gold">{stat.suffix}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="px-4 py-20 sm:py-24 lg:py-32">
          <div className="container">
            <Reveal>
              <div className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
                <div>
                  <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-molecular dark:text-brand-gold">
                    Proamina® / CRM
                  </p>
                  <h2 className="mt-4 max-w-[16ch] text-3xl font-semibold leading-tight tracking-[-0.035em] text-brand-navy dark:text-white sm:text-4xl lg:text-5xl">
                    {t('featuresTitle')}
                  </h2>
                </div>
                <div className="lg:pb-1">
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground">{t('platformNote')}</p>
                  <Link
                    href="/register"
                    className="mt-6 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-brand-molecular transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-brand-gold dark:hover:text-white"
                  >
                    {t('ctaRegister')} <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </Reveal>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((offer, index) => {
                const Icon = OFFER_ICONS[index] ?? FlaskConical;
                return (
                  <Reveal key={offer.title} delay={(index % 3) * 80} className="h-full">
                    <article className="group h-full border-b border-border px-0 py-8 sm:px-6 lg:px-8">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-brand-goldDark/20 bg-info-subtle text-brand-goldDark transition-colors group-hover:border-brand-molecular/45 group-hover:bg-brand-molecular group-hover:text-white dark:text-brand-gold">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <h3 className="mt-6 text-base font-semibold leading-snug text-foreground">{offer.title}</h3>
                      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{offer.desc}</p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-border/70 bg-muted/35 px-4 py-20 sm:py-24 lg:py-28">
          <div className="container">
            <Reveal>
              <div className="flex justify-center text-center">
                <h2 className="max-w-[18ch] text-3xl font-semibold leading-tight tracking-[-0.035em] text-brand-navy dark:text-white sm:text-4xl lg:text-5xl">
                  {t('reachTitle')}
                </h2>
              </div>
            </Reveal>
            <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:mt-14">
              <WorldMap markers={MARKERS} homeColor="#0284c7" marketColor="#eab308" />
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:py-24 lg:py-32">
          <div className="container">
            <Reveal>
              <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
                <div>
                  <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-molecular dark:text-brand-gold">
                    {t('journeyEyebrow')}
                  </p>
                  <h2 className="mt-4 max-w-[17ch] text-3xl font-semibold leading-tight tracking-[-0.035em] text-brand-navy dark:text-white sm:text-4xl lg:text-5xl">
                    {t('journeyTitle')}
                  </h2>
                </div>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">{t('journeySubtitle')}</p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <ol className="relative mt-12 border-t border-border sm:mt-16">
                {steps.map((step, index) => (
                  <li key={step.title} className="group grid gap-5 border-b border-border py-8 sm:grid-cols-[4.5rem_0.65fr_1.35fr] sm:gap-8 sm:py-10">
                    <span className="font-mono text-xs font-semibold tracking-[0.16em] text-brand-molecular dark:text-brand-gold" aria-hidden>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-brand-navy transition-colors group-hover:text-brand-molecular dark:text-white sm:text-2xl">
                      {step.title}
                    </h3>
                    <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{step.body}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        <section className="border-y border-border/70 bg-muted/35 py-20 sm:py-24">
          <Reveal>
            <div className="container px-4 text-center">
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-molecular dark:text-brand-gold">
                {t('partnersTitle')}
              </p>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{t('partnersSubtitle')}</p>
            </div>
          </Reveal>
          <div className="mt-10 sm:mt-12">
            <InfiniteMovingCards items={PARTNERS} direction="left" speed="slow" />
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-sky-400/20 bg-brand-navy px-4 py-20 text-white sm:py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_100%_50%,rgba(37,99,235,0.35),transparent_65%)]" aria-hidden />
          <Reveal className="container relative">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-sky-300">
                  Italprotein · Bologna
                </p>
                <h2 className="mt-5 max-w-[21ch] text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-4xl lg:text-5xl">
                  {t('ctaBannerTitle')}
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">{t('ctaBannerSubtitle')}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-semibold text-brand-navy transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy motion-reduce:transform-none"
                >
                  {t('ctaRegister')} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/team-login"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/25 bg-white/[0.04] px-6 text-sm font-semibold text-white transition-colors hover:border-sky-300/60 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
                >
                  {t('ctaInternal')}
                </Link>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="bg-brand-navy px-4 py-10 text-slate-300">
        <div className="container flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <Logo tone="light" href="/" />
          <div className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:gap-5">
            <a href={siteContact.emailHref} className="inline-flex items-center gap-2 rounded text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
              <Mail className="h-3.5 w-3.5" aria-hidden /> {siteContact.email}
            </a>
            {siteContact.phones.map((phone) => (
              <a key={phone.id} href={phone.href} className="inline-flex items-center gap-2 rounded text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
                <Phone className="h-3.5 w-3.5" aria-hidden /> {phone.display}
              </a>
            ))}
            <a href={siteContact.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded text-slate-400 transition-colors hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold">
              <Globe2 className="h-3.5 w-3.5" aria-hidden /> {siteContact.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
