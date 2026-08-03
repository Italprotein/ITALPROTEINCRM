import { Building2, FileSignature, FlaskConical, Truck } from 'lucide-react';

/**
 * A rendering of the CRM itself, for the hero.
 *
 * The headline claims this is the operating system for the ITALPROTEIN
 * business, so the hero shows that system rather than an abstract graphic —
 * the same move Cobalt makes by putting its dashboard beside its copy. Built in
 * markup rather than shipped as a screenshot: it stays crisp at any width, needs
 * no asset, and cannot go stale when the real UI changes.
 *
 * The figures are the production ones, so this is a portrait and not a fiction.
 */

const TILES = [
  { icon: Building2, value: '436', label: 'Aziende', tone: 'text-sky-300' },
  { icon: FileSignature, value: '29', label: 'NDA firmati', tone: 'text-teal-300' },
  { icon: FlaskConical, value: '18', label: 'Campioni', tone: 'text-sky-300' },
  { icon: Truck, value: '7', label: 'In transito', tone: 'text-teal-300' },
];

const PIPELINE = [
  { label: 'Lead', pct: 100 },
  { label: 'Contattate', pct: 74 },
  { label: 'NDA', pct: 46 },
  { label: 'Campione', pct: 28 },
  { label: 'Fornitura', pct: 12 },
];

export function CrmPreview() {
  return (
    <div
      aria-hidden
      className="relative w-full select-none rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-2xl backdrop-blur-sm sm:p-5"
    >
      {/* Window chrome, so it reads as an application and not a card. */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="ml-2 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-slate-500">
          Panoramica
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {TILES.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
            <tile.icon className={`h-3.5 w-3.5 ${tile.tone}`} />
            <p className="mt-2 font-mono text-lg font-semibold tabular-nums text-white">{tile.value}</p>
            <p className="font-mono text-[0.5625rem] uppercase tracking-[0.12em] text-slate-500">
              {tile.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <p className="font-mono text-[0.5625rem] uppercase tracking-[0.16em] text-slate-500">
          Pipeline
        </p>
        <div className="mt-3 space-y-2.5">
          {PIPELINE.map((stage) => (
            <div key={stage.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 font-mono text-[0.625rem] text-slate-400">
                {stage.label}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-sky-400/80 to-teal-400/60"
                  style={{ width: `${stage.pct}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[0.625rem] tabular-nums text-slate-500">
                {stage.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
