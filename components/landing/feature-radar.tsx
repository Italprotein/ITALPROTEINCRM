'use client';

import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import {
  Building2, GitBranch, FlaskConical, Truck,
  FileLock2, MessageSquare, FolderKanban, BarChart3, Atom,
} from 'lucide-react';

/* The eight workflow nodes that ring the radar. Labels come from Landing.radarNodes. */
const NODES = [
  { key: 'companies', Icon: Building2 },
  { key: 'pipeline', Icon: GitBranch },
  { key: 'samples', Icon: FlaskConical },
  { key: 'shipments', Icon: Truck },
  { key: 'ndas', Icon: FileLock2 },
  { key: 'feedback', Icon: MessageSquare },
  { key: 'projects', Icon: FolderKanban },
  { key: 'analytics', Icon: BarChart3 },
] as const;

const R = 38; // node radius, in viewBox/percentage units from centre
const TAU = Math.PI * 2;

function nodePos(i: number, total: number) {
  const angle = -Math.PI / 2 + (i / total) * TAU; // start at top, clockwise
  return {
    x: 50 + R * Math.cos(angle),
    y: 50 + R * Math.sin(angle),
  };
}

export function FeatureRadar() {
  const t = useTranslations('Landing');
  const positions = NODES.map((_, i) => nodePos(i, NODES.length));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
      {/* Ambient glow */}
      <div className="absolute left-1/2 top-1/2 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden />

      {/* Concentric rings (slow counter-rotation) */}
      {[100, 72, 46].map((size, i) => (
        <motion.div
          key={size}
          className="absolute left-1/2 top-1/2 rounded-full border border-dashed border-white/10"
          style={{ width: `${size}%`, height: `${size}%`, x: '-50%', y: '-50%' }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 60 - i * 14, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      {/* Radar sweep (x/y via framer so it composes with the rotate animation) */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-full w-full rounded-full mix-blend-screen"
        style={{
          x: '-50%',
          y: '-50%',
          background:
            'conic-gradient(from 0deg, rgba(201,162,39,0.34), rgba(201,162,39,0.06) 50deg, transparent 120deg, transparent 360deg)',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        aria-hidden
      />

      {/* Spokes from centre to each node */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" fill="none" aria-hidden>
        {positions.map((p, i) => (
          <line
            key={i}
            x1="50" y1="50" x2={p.x} y2={p.y}
            stroke="url(#spoke)" strokeWidth="0.3" strokeDasharray="1 1.5"
          />
        ))}
        <defs>
          <linearGradient id="spoke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(201,162,39,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Centre hub */}
      <div className="absolute left-1/2 top-1/2 flex h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full bg-brand-gold/20 blur-md"
          animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.85, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          aria-hidden
        />
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full border border-brand-gold/40 bg-gradient-to-br from-brand-navy to-[#16243d] text-center shadow-xl">
          <Atom className="h-5 w-5 text-brand-gold sm:h-6 sm:w-6" />
          <span className="px-1 text-[9px] font-semibold leading-tight text-brand-goldLight sm:text-[11px]">
            {t('radarCenter')}
          </span>
        </div>
      </div>

      {/* Nodes */}
      {NODES.map(({ key, Icon }, i) => {
        const p = positions[i];
        return (
          <motion.div
            key={key}
            className="absolute z-10"
            style={{ left: `${p.x}%`, top: `${p.y}%`, x: '-50%', y: '-50%' }}
            initial={{ opacity: 0, scale: 0.5 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 + i * 0.09, type: 'spring', stiffness: 260, damping: 18 }}
          >
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3 + (i % 4) * 0.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
              whileHover={{ scale: 1.12 }}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 shadow-lg backdrop-blur-md"
            >
              <Icon className="h-3.5 w-3.5 text-brand-gold" />
              <span className="text-[11px] font-medium text-white sm:text-xs">{t(`radarNodes.${key}`)}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}
