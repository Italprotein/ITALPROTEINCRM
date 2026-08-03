'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Wordmark with a cursor-driven scan reveal.
 *
 * Adapted from the Aceternity text-hover-effect with two deliberate changes:
 *
 * 1. The word is **legible at rest**. The original fills the text with
 *    `transparent` and sets `opacity: 0` until hover, so the wordmark is
 *    effectively invisible to anyone who never moves a mouse over it — which
 *    includes every touch device and every screen reader user looking at a
 *    screenshot. Here the resting state is an engraved sky-on-navy wordmark and
 *    the cursor only adds a brighter scan on top.
 *
 * 2. No animation library. The registry version pulls in `motion`, a second
 *    animation package alongside the framer-motion this app already has, to do
 *    nothing but move a gradient centre. Two plain SVG attributes do the same
 *    job, so the landing page ships neither.
 *
 * `textLength` forces the word to the full measure regardless of its length,
 * which is what makes it read as a struck wordmark rather than centred type.
 */
export function TextHoverEffect({
  text,
  className,
  onScan,
}: {
  text: string;
  className?: string;
  /** Receives the cursor's horizontal position over the word, 0–100. */
  onScan?: (percent: number | null) => void;
}) {
  const ref = React.useRef<SVGSVGElement>(null);
  const [mask, setMask] = React.useState<{ cx: string; cy: string } | null>(null);

  function track(clientX: number, clientY: number) {
    const svg = ref.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const x = ((clientX - box.left) / box.width) * 100;
    const y = ((clientY - box.top) / box.height) * 100;
    setMask({ cx: `${x}%`, cy: `${y}%` });
    onScan?.(Math.max(0, Math.min(100, x)));
  }

  function clear() {
    setMask(null);
    onScan?.(null);
  }

  return (
    <svg
      ref={ref}
      viewBox="0 0 300 100"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full select-none overflow-visible', className)}
      role="img"
      aria-label={text}
      onPointerMove={(event) => track(event.clientX, event.clientY)}
      onPointerLeave={clear}
    >
      <defs>
        <linearGradient id="scanGradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="0">
          <stop offset="0%" stopColor="#0eb89a" />
          <stop offset="45%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>

        <radialGradient
          id="scanMask"
          gradientUnits="userSpaceOnUse"
          r="22%"
          cx={mask?.cx ?? '50%'}
          cy={mask?.cy ?? '50%'}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </radialGradient>

        <mask id="scanWindow">
          <rect x="0" y="0" width="100%" height="100%" fill={mask ? 'url(#scanMask)' : 'black'} />
        </mask>
      </defs>

      {/* Resting state: engraved, and readable on its own. */}
      <text
        x="50%"
        y="52%"
        textAnchor="middle"
        dominantBaseline="middle"
        textLength="288"
        lengthAdjust="spacingAndGlyphs"
        fill="#38bdf8"
        fillOpacity={0.16}
        stroke="#7dd3fc"
        strokeOpacity={0.55}
        strokeWidth={0.4}
        className="font-sans text-[3.5rem] font-extrabold"
      >
        {text}
      </text>

      {/* The scan the cursor drags across it. */}
      <text
        x="50%"
        y="52%"
        textAnchor="middle"
        dominantBaseline="middle"
        textLength="288"
        lengthAdjust="spacingAndGlyphs"
        fill="url(#scanGradient)"
        mask="url(#scanWindow)"
        className="font-sans text-[3.5rem] font-extrabold"
      >
        {text}
      </text>
    </svg>
  );
}
