'use client';

import Image from 'next/image';
import { useRef, useEffect, useState } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  ArrowRight, Building2, FlaskConical, Package, ClipboardCheck,
  ChefHat, Bot, Users, Globe2, Star,
} from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { Logo } from '@/components/brand/logo';
import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { AccessMenu } from '@/components/landing/access-menu';
import { FeatureRadar } from '@/components/landing/feature-radar';
import { PartnerMarquee } from '@/components/landing/partner-marquee';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/* ─────────────────────────── Animation helpers ─────────────────────────── */

const ease = [0.22, 1, 0.36, 1] as const;

function FadeUp({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FloatOrb({ className, delay = 0, dur = 8 }: { className: string; delay?: number; dur?: number }) {
  return (
    <motion.div
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      animate={{ y: [0, -20, 8, -14, 0], x: [0, 10, -6, 14, 0], scale: [1, 1.06, 0.97, 1.04, 1] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const step = Math.ceil(target / 28);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(timer);
    }, 48);
    return () => clearInterval(timer);
  }, [isInView, target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

function AnimatedTitle({ text, className }: { text: string; className?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const words = text.split(' ');
  return (
    <h1 ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className="mr-[0.25em] inline-block"
          initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.5, delay: i * 0.06, ease }}
        >
          {w}
        </motion.span>
      ))}
    </h1>
  );
}

const ICON_TONES = [
  'bg-brand-navy text-brand-gold',
  'bg-brand-teal/15 text-brand-teal',
  'bg-brand-gold/15 text-brand-goldDark',
  'bg-blue-600/10 text-blue-600',
  'bg-brand-navy text-brand-gold',
  'bg-brand-teal/15 text-brand-teal',
];

function FeatureIcon({ Icon, index }: { Icon: React.ElementType; index: number }) {
  return (
    <motion.div
      className={`flex h-11 w-11 items-center justify-center rounded-xl ${ICON_TONES[index % ICON_TONES.length]}`}
      whileHover={{ scale: 1.12, rotate: 6 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
    >
      <Icon className="h-5 w-5" />
    </motion.div>
  );
}

function ProductCard({
  href, icon, title, desc, cta, accent, index,
}: { href: string; icon: React.ReactNode; title: string; desc: string; cta: string; accent?: boolean; index: number }) {
  return (
    <FadeUp delay={0.1 + index * 0.12}>
      <motion.div
        whileHover={{ y: -4, boxShadow: '0 20px 48px -8px rgba(10,22,40,0.18)' }}
        transition={{ type: 'spring', stiffness: 350, damping: 22 }}
        className="group h-full"
      >
        <Link href={href} className="relative flex h-full flex-col rounded-2xl border bg-card p-7 shadow-sm">
          {accent && (
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-gold/5 via-transparent to-brand-teal/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" aria-hidden />
          )}
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent ? 'bg-brand-gold/15 text-brand-goldDark' : 'bg-brand-navy text-white'}`}>
            {icon}
          </div>
          <h3 className="mt-5 font-display text-xl font-bold tracking-tight">{title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-navy transition-all duration-200 group-hover:gap-3">
            {cta} <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </motion.div>
    </FadeUp>
  );
}

function StatCard({ target, suffix, label, index }: { target: number; suffix: string; label: string; index: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ delay: index * 0.1, duration: 0.5, ease }}
      className="flex flex-col items-center gap-1 text-center"
    >
      <p className="font-display text-4xl font-bold text-brand-goldDark">
        <Counter target={target} suffix={suffix} />
      </p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
}

/* ─────────────────────────── Page ───────────────────────────────────────── */
const FEATURE_ICONS = [FlaskConical, Package, ClipboardCheck, ChefHat, Bot, Users];

export default function LandingPage() {
  const t = useTranslations('Landing');
  const features = t.raw('features') as { title: string; desc: string }[];

  const { scrollY } = useScroll();
  const orbY = useTransform(scrollY, [0, 400], [0, -60]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <motion.header
        className="sticky top-0 z-30 border-b border-white/10 bg-brand-navy/95 backdrop-blur"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease }}
      >
        <div className="container flex h-16 items-center justify-between">
          <Logo tone="light" />
          <div className="flex items-center gap-2">
            <LanguageSwitcher tone="light" />
            <AccessMenu tone="light" />
          </div>
        </div>
      </motion.header>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-navy text-white">
        <motion.div className="pointer-events-none absolute inset-0" style={{ y: orbY }}>
          <FloatOrb className="h-[500px] w-[500px] -right-40 -top-24 bg-brand-gold/12" delay={0} dur={10} />
          <FloatOrb className="h-96 w-96 -left-20 top-1/3 bg-brand-teal/15" delay={2} dur={12} />
          <FloatOrb className="h-64 w-64 right-1/4 bottom-0 bg-blue-500/10" delay={1.2} dur={9} />
        </motion.div>
        <div className="absolute inset-0 bg-grid opacity-[0.065]" aria-hidden />
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-gold/5 via-transparent to-brand-teal/5"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />

        <div className="container relative grid gap-12 py-24 lg:grid-cols-2 lg:items-center lg:py-32">
          {/* Copy */}
          <div>
            <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <Badge className="mb-5 border-0 bg-white/10 text-brand-goldLight">
                <Star className="h-3 w-3" />
                {t('eyebrow')}
              </Badge>
            </motion.div>

            <AnimatedTitle
              text={t('heroTitle')}
              className="font-display text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
            />

            <motion.p
              className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              {t('heroSubtitle')}
            </motion.p>

            <motion.div
              className="mt-9 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.5 }}
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button asChild variant="gold" size="lg">
                  <Link href="/team-login">{t('ctaInternal')} <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10">
                  <Link href="/register">{t('ctaRegister')}</Link>
                </Button>
              </motion.div>
            </motion.div>

            <motion.p className="mt-6 max-w-lg text-sm text-slate-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
              {t('demoNotice')}
            </motion.p>
          </div>

          {/* Hero: Proamina bottle */}
          <motion.div
            className="relative mx-auto flex w-full max-w-md items-center justify-center"
            initial={{ opacity: 0, scale: 0.92, x: 30 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease }}
          >
            {/* Glow */}
            <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-gold/25 via-brand-gold/10 to-brand-teal/10 blur-3xl" aria-hidden />
            {/* Rotating ring (x/y via framer so it composes with the rotate animation) */}
            <motion.div
              className="absolute left-1/2 top-1/2 h-72 w-72 rounded-full border border-dashed border-white/10 sm:h-80 sm:w-80"
              style={{ x: '-50%', y: '-50%' }}
              animate={{ rotate: 360 }}
              transition={{ duration: 44, repeat: Infinity, ease: 'linear' }}
              aria-hidden
            />
            {/* Bottle */}
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.03 }}
              className="relative z-10"
            >
              <Image
                src="/marketing/proamina-bottle.png"
                alt="Proamina®"
                width={380}
                height={380}
                priority
                className="h-auto w-[15rem] drop-shadow-2xl sm:w-[18rem]"
              />
            </motion.div>
            {/* Floating seal */}
            <motion.div
              className="absolute -bottom-2 -left-2 hidden h-24 w-24 rounded-2xl bg-white p-2 shadow-xl sm:block"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              whileHover={{ scale: 1.08, rotate: -3 }}
            >
              <Image src="/brand/proamina-seal.png" alt="Proamina® seal" width={96} height={96} className="h-full w-full object-contain" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats strip ───────────────────────────────────────────── */}
      <section className="border-b bg-brand-cream/40">
        <div className="container py-12">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <StatCard target={36} suffix="+" label="Active partners" index={0} />
            <StatCard target={100} suffix="%" label="Protein sweetener" index={1} />
            <StatCard target={12} suffix="" label="Countries reached" index={2} />
            <StatCard target={28} suffix="" label="CRM modules" index={3} />
          </div>
        </div>
      </section>

      {/* ── 360° radar ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-navy py-24 text-white">
        <FloatOrb className="h-96 w-96 -left-24 top-0 bg-brand-gold/10" delay={0} dur={11} />
        <FloatOrb className="h-80 w-80 right-0 bottom-0 bg-brand-teal/12" delay={2.5} dur={9} />
        <div className="absolute inset-0 bg-grid opacity-[0.05]" aria-hidden />
        <div className="container relative grid gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <FadeUp>
              <Badge className="mb-5 border-0 bg-white/10 text-brand-goldLight">
                <Globe2 className="h-3.5 w-3.5" /> {t('radarBadge')}
              </Badge>
            </FadeUp>
            <FadeUp delay={0.05}>
              <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{t('radarTitle')}</h2>
            </FadeUp>
            <FadeUp delay={0.12}>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300">{t('radarSubtitle')}</p>
            </FadeUp>
            <FadeUp delay={0.2}>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="mt-8 inline-block">
                <Button asChild variant="gold" size="lg">
                  <Link href="/team-login">{t('ctaInternal')} <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </motion.div>
            </FadeUp>
          </div>
          <FeatureRadar />
        </div>
      </section>

      {/* ── Two products ──────────────────────────────────────────── */}
      <section className="border-b bg-background py-24">
        <div className="container">
          <FadeUp>
            <p className="font-display text-xs font-semibold uppercase tracking-widest text-brand-goldDark">{t('productsTitle')}</p>
          </FadeUp>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <ProductCard
              href="/team-login"
              icon={<Building2 className="h-5 w-5" />}
              title={t('internalTitle')}
              desc={t('internalDesc')}
              cta={t('ctaInternal')}
              index={0}
            />
            <ProductCard
              href="/login"
              icon={<FlaskConical className="h-5 w-5" />}
              title={t('externalTitle')}
              desc={t('externalDesc')}
              cta={t('ctaExternal')}
              accent
              index={1}
            />
          </div>
        </div>
      </section>

      {/* ── Features grid (portal-focused) ────────────────────────── */}
      <section className="bg-muted/30 py-24">
        <div className="container">
          <FadeUp>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{t('featuresTitle')}</h2>
          </FadeUp>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? FlaskConical;
              return (
                <FadeUp key={f.title} delay={i * 0.07}>
                  <motion.div
                    className="group h-full rounded-xl border bg-card p-6 shadow-sm"
                    whileHover={{ y: -3, boxShadow: '0 16px 40px -8px rgba(10,22,40,0.12)' }}
                    transition={{ type: 'spring', stiffness: 350, damping: 24 }}
                  >
                    <FeatureIcon Icon={Icon} index={i} />
                    <h3 className="mt-4 font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
                  </motion.div>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Partners marquee ──────────────────────────────────────── */}
      <section className="border-b bg-background py-20">
        <div className="container">
          <FadeUp>
            <div className="text-center">
              <p className="font-display text-xs font-semibold uppercase tracking-widest text-brand-goldDark">{t('partnersTitle')}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t('partnersSubtitle')}</p>
            </div>
          </FadeUp>
        </div>
        <div className="mt-10">
          <PartnerMarquee />
        </div>
      </section>

      {/* ── CTA banner ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-navy py-24 text-white">
        <FloatOrb className="h-96 w-96 -left-20 -top-20 bg-brand-gold/10" delay={0} dur={11} />
        <FloatOrb className="h-72 w-72 right-0 bottom-0 bg-brand-teal/15" delay={3} dur={9} />
        <div className="absolute inset-0 bg-grid opacity-[0.06]" aria-hidden />
        <div className="container relative text-center">
          <FadeUp><Globe2 className="mx-auto mb-4 h-10 w-10 text-brand-gold/70" /></FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('ctaBannerTitle')}</h2>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">{t('ctaBannerSubtitle')}</p>
          </FadeUp>
          <FadeUp delay={0.32}>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button asChild variant="gold" size="lg">
                  <Link href="/team-login">{t('ctaInternal')} <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                <Button asChild variant="outline" size="lg" className="border-white/25 bg-white/5 text-white hover:bg-white/10">
                  <Link href="/register">{t('ctaRegister')}</Link>
                </Button>
              </motion.div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="border-t bg-brand-navy py-10 text-slate-400">
        <div className="container flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Logo tone="light" />
          <p className="max-w-xl text-xs leading-relaxed">{t('footerNote')}</p>
        </div>
      </footer>
    </div>
  );
}
