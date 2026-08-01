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

/**
 * A static instrument diagram of the eight ITALPROTEIN workflows.
 *
 * This was a motion-library sonar: three counter-rotating rings, a five-second
 * conic sweep over `mix-blend-screen`, a pulsing hub and eight independently
 * bobbing nodes — thirteen animations running forever on a marketing page. It
 * reads better as a drawn instrument, renders on the server, and leaves the
 * landing route with no animation library at all.
 */
export function FeatureRadar() {
  const t = useTranslations('Landing');
  const positions = NODES.map((_, i) => nodePos(i, NODES.length));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
      {/* Ambient glow */}
      <div
        className="absolute left-1/2 top-1/2 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gold/10 blur-3xl"
        aria-hidden
      />

      {/* Concentric rings */}
      {[100, 72, 46].map((size) => (
        <div
          key={size}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/10"
          style={{ width: `${size}%`, height: `${size}%` }}
          aria-hidden
        />
      ))}

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
            <stop offset="0%" stopColor="rgba(56,189,248,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </linearGradient>
        </defs>
      </svg>

      {/* Centre hub */}
      <div className="absolute left-1/2 top-1/2 flex h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-brand-gold/20 blur-md" aria-hidden />
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
          <div
            key={key}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 shadow-lg backdrop-blur-md transition-transform duration-200 hover:scale-105">
              <Icon className="h-3.5 w-3.5 text-brand-gold" />
              <span className="text-[11px] font-medium text-white sm:text-xs">{t(`radarNodes.${key}`)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
