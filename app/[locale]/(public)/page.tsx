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
import { SpotlightCard } from '@/components/landing/spotlight-card';
import { MARKERS, PARTNERS } from '@/components/landing/partners';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { InfiniteMovingCards } from '@/components/ui/infinite-moving-cards';
import WorldMap from '@/components/ui/world-map';
import { siteContact } from '@/lib/config/site';
import { Link } from '@/lib/i18n/navigation';

const OFFER_ICONS = [FlaskConical, Package, ClipboardCheck, ChefHat, Bot, Users];

/*
 * Blue discipline on the public surface.
 *
 * Four blues used to compete here: brand-navy #0A1628, brand-blue #0284C7,
 * brand-blueBright #38BDF8 and brand-molecular #2563EB, plus raw Tailwind
 * `sky-*` in the hero figure, the CTA band and the footer — where one link
 * carried `hover:text-sky-300` beside `focus-visible:ring-brand-gold`, two
 * different blues for two states of the same control.
 *
 * Each blue now has one job, and the split is driven by contrast rather than
 * taste — measured against `--background` light (#FAFBFC):
 *
 *   brand-navy      #0A1628  17.5:1  structure: the blue the client named in
 *                                    the footer, now also the CTA band, the
 *                                    hero figure and the primary button
 *   brand-molecular #2563EB   4.99:1  accent that CARRIES TEXT in light mode —
 *                                    eyebrows, links, icons, solid fills
 *   brand-blueBright#38BDF8           the same accent lifted for dark surfaces
 *   brand-blue      #0284C7   3.95:1  DECORATION ONLY — washes, tints, borders,
 *                                    glows, rules. Never put text in it.
 *
 * That last line is the trap: brand-blue is the prettier blue and reads as the
 * obvious accent, but at 3.95:1 on the page background — and 4.10:1 under white
 * button text — it fails AA both ways. brand-molecular is the one that passes.
 *
 * `brand-blueSoft` is the pale end, used only on navy. Yellow is reserved for
 * the map markers and appears nowhere else.
 *
 * Note for future edits: `brand-goldDark` IS `brand-blue` and `brand-gold` IS
 * `brand-blueBright` — literal aliases kept in tailwind.config.ts from the
 * gold-to-blue re-theme. The blue-named tokens are used here so the code reads
 * as what it paints.
 */

/**
 * The tinted band. Alternating sections used to be flat `bg-muted/35` grey; the
 * page now breathes plain / tinted / plain / tinted, so blue carries the
 * section rhythm itself rather than only the small accents inside it. A wash
 * this faint stays under text contrast requirements in both themes.
 */
const BAND = 'bg-gradient-to-b from-brand-blue/[0.06] to-transparent dark:from-brand-blueBright/[0.05]';

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

          <nav className="flex items-center gap-1 sm:gap-2" aria-label={t('navPrimary')}>
            <Link
              href="/login"
              className="hidden min-h-11 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
            >
              {t('ctaExternal')}
            </Link>
            <Link
              href="/register"
              className="hidden min-h-11 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
            >
              {t('ctaRegister')}
            </Link>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
            <LanguageSwitcher tone="dark" compact />
            <ThemeToggle tone="dark" />
            <Link
              href="/team-login"
              aria-label={t('ctaInternal')}
              className="ml-1 inline-flex min-h-11 items-center justify-center rounded-md bg-brand-navy px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-molecular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-brand-molecular dark:hover:bg-brand-blueBright dark:hover:text-brand-navy"
            >
              <span className="hidden sm:inline">{t('ctaInternal')}</span>
              <span className="sm:hidden" aria-hidden>CRM</span>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative isolate border-b border-border/70 px-4 py-10 sm:py-14 lg:py-16">
          {/* Two composed backdrop layers, both static: the dot field gives the
              surface a texture to catch the light, the radial glow above it
              gives that texture a source. The dot field is masked to the same
              top-right quadrant the glow already occupies and dissolves before
              it reaches the headline, so it never competes with the text it
              sits behind. Nothing here moves or reacts. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-dot-grid [mask-image:radial-gradient(60%_55%_at_75%_18%,black,transparent_75%)]" aria-hidden />
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(circle_at_78%_16%,rgba(2,132,199,0.10),transparent_38%)] dark:bg-[radial-gradient(circle_at_78%_16%,rgba(56,189,248,0.11),transparent_38%)]" aria-hidden />
          <div className="container grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,1fr)] lg:gap-16">
            <div className="motion-safe:animate-fade-up">
              <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-molecular dark:text-brand-blueBright">
                {t('eyebrow')}
              </p>
              <h1 className="mt-6 max-w-[18ch] text-balance text-4xl font-semibold leading-[1.03] tracking-[-0.045em] text-brand-navy dark:text-white sm:text-5xl lg:text-6xl xl:text-[4.5rem] [overflow-wrap:anywhere]">
                {t('heroTitle')}
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {t('heroSubtitle')}
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/team-login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-brand-navy px-6 text-sm font-semibold text-white shadow-md shadow-brand-blue/20 transition-[background-color,color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-brand-molecular hover:shadow-blue-halo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:bg-brand-molecular dark:hover:bg-brand-blueBright dark:hover:text-brand-navy motion-reduce:transform-none"
                >
                  {t('ctaInternal')}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-semibold text-card-foreground shadow-xs transition-colors hover:border-brand-blue/60 hover:text-brand-molecular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:border-brand-blueBright/60 dark:hover:text-brand-blueBright"
                >
                  {t('ctaExternal')}
                </Link>
              </div>
            </div>

            <SpotlightCard className="relative min-h-[29rem] overflow-hidden rounded-[1.75rem] border border-brand-blueBright/20 bg-brand-navy shadow-[0_28px_80px_-36px_rgba(2,132,199,0.45)] motion-safe:animate-scale-in sm:min-h-[35rem] lg:min-h-[39rem]">
              <Image
                src="/marketing/powder-marble.jpg"
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover opacity-35 grayscale"
              />
              <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(10,22,40,0.22),rgba(10,22,40,0.62)_58%,rgba(10,22,40,0.96))]" aria-hidden />
              <div className="absolute inset-y-20 left-5 w-5 border-y border-brand-blueBright/45 bg-[repeating-linear-gradient(to_bottom,rgba(125,211,252,0.65)_0,rgba(125,211,252,0.65)_1px,transparent_1px,transparent_18px)] sm:left-7" aria-hidden />
              <div className="absolute inset-x-5 top-5 flex items-start justify-between gap-4 border-b border-white/15 pb-4 font-mono text-[0.625rem] uppercase tracking-[0.18em] text-brand-blueSoft sm:inset-x-7 sm:top-7">
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
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-blueBright shadow-[0_0_0_5px_rgba(56,189,248,0.12)]" aria-hidden />
              </figcaption>
            </SpotlightCard>
          </div>
        </section>

        <section className={`border-b border-border/70 px-4 ${BAND}`} aria-label={t('statsRegion')}>
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
                  {stat.value}<span className="text-brand-molecular dark:text-brand-blueBright">{stat.suffix}</span>
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
                  <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-molecular dark:text-brand-blueBright">
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
                    className="mt-6 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-brand-molecular transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-brand-blueBright dark:hover:text-white"
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
                    {/* Hover is a colour change and a 5% lift on the icon tile —
                        no translate, no tilt, no 3D. The card is a bordered
                        cell in a grid, and moving it would shear the rules it
                        shares with its neighbours. The blue tint is a 3% wash
                        (decoration, hence brand-blue); the title moves to
                        brand-molecular, the accent that carries text. */}
                    <article className="group h-full border-b border-border px-0 py-8 transition-colors duration-150 hover:border-brand-blue/40 hover:bg-brand-blue/[0.03] dark:hover:border-brand-blueBright/40 dark:hover:bg-brand-blueBright/[0.04] sm:px-6 lg:px-8">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-brand-blue/25 bg-brand-blue/10 text-brand-molecular transition-[background-color,border-color,color,transform] duration-150 group-hover:scale-105 group-hover:border-brand-molecular group-hover:bg-brand-molecular group-hover:text-white motion-reduce:transform-none dark:border-brand-blueBright/25 dark:bg-brand-blueBright/10 dark:text-brand-blueBright dark:group-hover:border-brand-blueBright dark:group-hover:bg-brand-blueBright dark:group-hover:text-brand-navy">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <h3 className="mt-6 text-base font-semibold leading-snug text-foreground transition-colors duration-150 group-hover:text-brand-molecular dark:group-hover:text-brand-blueBright">{offer.title}</h3>
                      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">{offer.desc}</p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        <section className={`border-y border-border/70 px-4 py-20 sm:py-24 lg:py-28 ${BAND}`}>
          <div className="container">
            <Reveal>
              <div className="flex justify-center text-center">
                <h2 className="max-w-[18ch] text-3xl font-semibold leading-tight tracking-[-0.035em] text-brand-navy dark:text-white sm:text-4xl lg:text-5xl">
                  {t('reachTitle')}
                </h2>
              </div>
            </Reveal>
            {/* The frame is tinted rather than neutral so it holds the map
                instead of boxing it. `homeColor` is not passed: no entry in
                MARKERS sets `home`, so it only ever painted a colour nothing
                used. */}
            <Reveal delay={80} className="mt-10 overflow-hidden rounded-2xl border border-brand-blue/20 bg-card shadow-blue-halo dark:border-brand-blueBright/20 sm:mt-14">
              <WorldMap
                markers={MARKERS}
                marketColor="#eab308"
                label={t('mapLabel')}
                markersLabel={t('mapMarkers', { count: MARKERS.length })}
              />
            </Reveal>
          </div>
        </section>

        <section className="px-4 py-20 sm:py-24 lg:py-32">
          <div className="container">
            <Reveal>
              <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
                <div>
                  <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-molecular dark:text-brand-blueBright">
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
                  // The spine: a transparent left rule that lights blue on the
                  // hovered step, so the sequence reads as one run rather than
                  // five stacked rows.
                  <li
                    key={step.title}
                    className="group grid gap-5 border-b border-l-2 border-border border-l-transparent py-8 pl-4 transition-colors duration-300 hover:border-l-brand-blue dark:hover:border-l-brand-blueBright sm:grid-cols-[4.5rem_0.65fr_1.35fr] sm:gap-8 sm:py-10 sm:pl-5"
                  >
                    <span className="font-mono text-xs font-semibold tracking-[0.16em] text-brand-molecular dark:text-brand-blueBright" aria-hidden>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-brand-navy transition-colors group-hover:text-brand-molecular dark:text-white dark:group-hover:text-brand-blueBright sm:text-2xl">
                      {step.title}
                    </h3>
                    <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{step.body}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>
        </section>

        <section className={`border-y border-border/70 px-4 py-20 sm:py-24 ${BAND}`}>
          <Reveal>
            <div className="container text-center">
              <h2 className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-molecular dark:text-brand-blueBright">
                {t('partnersTitle')}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{t('partnersSubtitle')}</p>
            </div>
          </Reveal>
          <div className="mt-10 sm:mt-12">
            <InfiniteMovingCards
              items={PARTNERS}
              direction="left"
              speed="slow"
              ariaLabel={t('partnersRegion')}
            />
          </div>
        </section>

        <section className="relative overflow-hidden border-b border-brand-blueBright/20 bg-brand-navy px-4 py-20 text-white sm:py-24 lg:py-28">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_100%_50%,rgba(2,132,199,0.42),transparent_65%)]" aria-hidden />
          {/* The only continuous motion on the page: a pale diagonal strip
              drifting across the navy every 9s. It sits on the band's own
              layer, under the `relative` content, so it lights the surface
              without washing the copy. `motion-reduce:animate-none` parks it —
              at rest the strip is outside the visible window, so reduced-motion
              visitors see plain navy rather than a frozen streak. */}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_42%,rgba(186,230,253,0.10)_50%,transparent_58%)] bg-[length:250%_100%] animate-sheen motion-reduce:animate-none" aria-hidden />
          <Reveal className="container relative">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-brand-blueBright">
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
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-6 text-sm font-semibold text-brand-navy transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-brand-blueSoft/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy motion-reduce:transform-none"
                >
                  {t('ctaRegister')} <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/team-login"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/25 bg-white/[0.04] px-6 text-sm font-semibold text-white transition-colors hover:border-brand-blueBright/60 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy"
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
            <a href={siteContact.emailHref} className="inline-flex items-center gap-2 rounded text-slate-400 transition-colors hover:text-brand-blueBright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blueBright">
              <Mail className="h-3.5 w-3.5" aria-hidden /> {siteContact.email}
            </a>
            {siteContact.phones.map((phone) => (
              <a key={phone.id} href={phone.href} className="inline-flex items-center gap-2 rounded text-slate-400 transition-colors hover:text-brand-blueBright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blueBright">
                <Phone className="h-3.5 w-3.5" aria-hidden /> {phone.display}
              </a>
            ))}
            <a href={siteContact.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded text-slate-400 transition-colors hover:text-brand-blueBright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blueBright">
              <Globe2 className="h-3.5 w-3.5" aria-hidden /> {siteContact.website.replace(/^https?:\/\//, '')}
            </a>
          </div>
        </div>
        {/* Restored: the rebuild in a9588ed dropped this credit, which was added
            deliberately in 3f2c56d. The footer is navy in both themes, so the
            slate/white values here are correct rather than un-themed. */}
        <div className="container mt-8 border-t border-white/10 pt-6 text-center text-xs tracking-wide text-slate-400">
          Creato Da : Amine , con {'<3'}
        </div>
      </footer>
    </div>
  );
}
