'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Building2,
  Target,
  ShieldCheck,
  FlaskConical,
  Truck,
  AlertTriangle,
  Flame,
  Activity as ActivityIcon,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import {
  companyService,
  opportunityService,
  ndaService,
  sampleService,
  shipmentService,
  taskService,
} from '@/lib/mock-services';
import { cn } from '@/lib/utils';

/* ────────────────────────────── theme ────────────────────────────── */
const RED = '#f43f5e';
const BLUE = '#3b82f6';

/* deterministic particle field (no Math.random → no hydration mismatch) */
const PARTICLES = Array.from({ length: 42 }, (_, i) => ({
  left: (i * 37) % 100,
  top: (i * 53) % 100,
  size: 1 + (i % 3),
  delay: (i % 11) * 0.35,
  dur: 3 + (i % 6),
  red: i % 3 === 0,
}));

/* ────────────────────────────── animated background ────────────────────────────── */
function TechBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_15%_0%,#0b1d3a_0%,#070b16_45%,#04060c_100%)]" />

      {/* tech grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(120,150,220,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(120,150,220,0.10) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(120% 90% at 50% 0%, #000 35%, transparent 100%)',
        }}
      />

      {/* drifting glow orbs */}
      <motion.div
        className="absolute -left-24 -top-20 h-[34rem] w-[34rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(244,63,94,0.30), transparent 60%)' }}
        animate={{ x: [0, 40, -20, 0], y: [0, 30, -10, 0], scale: [1, 1.1, 0.95, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-0 top-1/4 h-[26rem] w-[26rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.28), transparent 60%)' }}
        animate={{ x: [0, -30, 15, 0], y: [0, 20, -25, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      <motion.div
        className="absolute bottom-[-6rem] left-1/3 h-[24rem] w-[24rem] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.22), transparent 60%)' }}
        animate={{ x: [0, 25, -15, 0], y: [0, -18, 8, 0], scale: [1, 1.06, 0.98, 1] }}
        transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />

      {/* particle field */}
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: p.red ? RED : '#cdd9f5',
            boxShadow: `0 0 ${p.size * 4}px ${p.red ? 'rgba(244,63,94,0.8)' : 'rgba(180,200,255,0.7)'}`,
          }}
          animate={{ opacity: [0.15, 0.9, 0.15], y: [0, -14, 0] }}
          transition={{ duration: p.dur, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
        />
      ))}

      {/* sweeping scan beam */}
      <motion.div
        className="absolute inset-x-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(244,63,94,0.55), rgba(59,130,246,0.45), transparent)' }}
        animate={{ top: ['-5%', '105%'] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
      />

      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}

/* ────────────────────────────── count-up ────────────────────────────── */
function useCountUp(target: number, duration = 1400) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

function Counter({ value, currency }: { value: number; currency?: boolean }) {
  const v = useCountUp(value);
  const rounded = Math.round(v);
  return <>{currency ? `€${compact.format(rounded)}` : rounded.toLocaleString()}</>;
}

/* ────────────────────────────── KPI card ────────────────────────────── */
interface Kpi {
  label: string;
  value: number;
  icon: LucideIcon;
  accent: 'red' | 'blue';
  currency?: boolean;
}

function NeonStat({ kpi, index }: { kpi: Kpi; index: number }) {
  const c = kpi.accent === 'red' ? RED : BLUE;
  const Icon = kpi.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.06 * index, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md"
    >
      {/* corner glow */}
      <div
        className="absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity duration-300 opacity-40 group-hover:opacity-80"
        style={{ background: `radial-gradient(circle, ${c}55, transparent 70%)` }}
      />
      {/* top accent line */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${c}, transparent)` }} />

      <div className="relative flex items-center justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl border"
          style={{ borderColor: `${c}55`, background: `${c}1a`, color: c }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <motion.span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: c, boxShadow: `0 0 10px ${c}` }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: index * 0.2 }}
        />
      </div>

      <div className="relative mt-4">
        <div className="font-display text-3xl font-bold tracking-tight text-white tabular-nums">
          <Counter value={kpi.value} currency={kpi.currency} />
        </div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{kpi.label}</div>
      </div>
    </motion.div>
  );
}

/* ────────────────────────────── live clock ────────────────────────────── */
function LiveClock() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-sm tabular-nums text-slate-300">
      {now ? now.toLocaleTimeString('en-GB') : '--:--:--'}
    </span>
  );
}

/* ────────────────────────────── equaliser pulse ────────────────────────────── */
function PulseBars() {
  return (
    <div className="flex items-end gap-1.5">
      {Array.from({ length: 28 }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full"
          style={{ background: i % 4 === 0 ? RED : 'rgba(148,180,255,0.7)' }}
          animate={{ height: [6, 10 + ((i * 7) % 34), 6] }}
          transition={{ duration: 1 + (i % 5) * 0.25, repeat: Infinity, ease: 'easeInOut', delay: i * 0.06 }}
        />
      ))}
    </div>
  );
}

/* ────────────────────────────── dashboard ────────────────────────────── */
interface Stats {
  companies: number;
  pipelineValue: number;
  highPriority: number;
  opportunities: number;
  ndasSigned: number;
  samplesShipped: number;
  inTransit: number;
  overdue: number;
}

export function AmineDashboard() {
  const t = useTranslations('AmineDashboard');
  const [stats, setStats] = React.useState<Stats | null>(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      companyService.getStatistics(),
      opportunityService.getStatistics(),
      ndaService.getStatistics(),
      sampleService.getStatistics(),
      shipmentService.getStatistics(),
      taskService.getStatistics(),
    ])
      .then(([company, opp, nda, sample, shipment, task]) => {
        if (!active) return;
        setStats({
          companies: company?.total ?? 0,
          pipelineValue: company?.pipelineValue ?? 0,
          highPriority: company?.highPriority ?? 0,
          opportunities: (opp as { open?: number })?.open ?? 0,
          ndasSigned: (nda as { signed?: number })?.signed ?? 0,
          samplesShipped: sample?.shipped ?? 0,
          inTransit: (shipment as { inTransit?: number })?.inTransit ?? 0,
          overdue: (task as { overdue?: number })?.overdue ?? 0,
        });
      })
      .catch(() => active && setStats({ companies: 0, pipelineValue: 0, highPriority: 0, opportunities: 0, ndasSigned: 0, samplesShipped: 0, inTransit: 0, overdue: 0 }));
    return () => {
      active = false;
    };
  }, []);

  const kpis: Kpi[] = [
    { label: t('kpiCompanies'), value: stats?.companies ?? 0, icon: Building2, accent: 'red' },
    { label: t('kpiActivePipeline'), value: stats?.opportunities ?? 0, icon: Target, accent: 'blue' },
    { label: t('kpiPipelineValue'), value: stats?.pipelineValue ?? 0, icon: Flame, accent: 'red', currency: true },
    { label: t('kpiNdasSigned'), value: stats?.ndasSigned ?? 0, icon: ShieldCheck, accent: 'blue' },
    { label: t('kpiSamplesShipped'), value: stats?.samplesShipped ?? 0, icon: FlaskConical, accent: 'red' },
    { label: t('kpiInTransit'), value: stats?.inTransit ?? 0, icon: Truck, accent: 'blue' },
    { label: t('kpiHighPriority'), value: stats?.highPriority ?? 0, icon: Sparkles, accent: 'red' },
    { label: t('kpiOverdueTasks'), value: stats?.overdue ?? 0, icon: AlertTriangle, accent: 'blue' },
  ];

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#04060c] text-white">
      <TechBackground />

      <div className="relative z-10 space-y-8 p-6 sm:p-8 lg:p-10">
        {/* ── header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-rose-400/90">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-rose-500"
                style={{ boxShadow: `0 0 10px ${RED}` }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              {t('statusBadge')}
            </div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              {t('welcomeBack')}{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(100deg, ${RED}, #fb7185 35%, ${BLUE} 90%)` }}
              >
                Amine
              </span>
            </h1>
            <p className="mt-2 max-w-md text-sm text-slate-400">
              {t('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 backdrop-blur-md">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">{t('localTime')}</span>
              <LiveClock />
            </div>
            <div className="h-8 w-px bg-white/10" />
            <ActivityIcon className="h-5 w-5 text-rose-400" />
            <PulseBars />
          </div>
        </motion.div>

        {/* ── KPI grid ── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpis.map((kpi, i) => (
            <NeonStat key={kpi.label} kpi={kpi} index={i} />
          ))}
        </div>

        {/* ── command strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-md"
        >
          <div
            className="absolute inset-y-0 left-0 w-1"
            style={{ background: `linear-gradient(180deg, ${RED}, ${BLUE})` }}
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">{t('pipelineValueUnderManagement')}</div>
              <div className="mt-1 font-display text-3xl font-bold text-white tabular-nums">
                <Counter value={stats?.pipelineValue ?? 0} currency />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-rose-400 tabular-nums">
                  <Counter value={stats?.companies ?? 0} />
                </div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('accounts')}</div>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <PulseBars />
            </div>
          </div>
        </motion.div>

        <p className="text-center text-[11px] text-slate-600">
          {t('footer')}
        </p>
      </div>
    </div>
  );
}
