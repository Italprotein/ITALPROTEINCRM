'use client';

import * as React from 'react';

import { TextHoverEffect } from '@/components/ui/text-hover-effect';

/**
 * The page's signature: the ITALPROTEIN wordmark under a densitometer.
 *
 * A hover effect on its own is decoration. Tying it to a ruler that reports the
 * cursor's position as a measured value is what makes it belong to an ingredient
 * house — the gesture reads as passing an instrument across a sample rather than
 * as a gradient trick. At rest the ruler shows the full width, so the readout is
 * never blank and never implies a live measurement that isn't happening.
 */
export function WordmarkScan({ caption }: { caption: string }) {
  const [scan, setScan] = React.useState<number | null>(null);

  return (
    <figure className="w-full">
      <TextHoverEffect text="ITALPROTEIN" onScan={setScan} className="h-28 sm:h-40 lg:h-48" />

      <div className="mt-2 flex items-center gap-3 border-t border-sky-400/20 pt-2.5">
        {/* Tick ruler. The lit tick tracks the cursor across the wordmark. */}
        <div className="relative flex h-3 flex-1 items-end gap-px overflow-hidden" aria-hidden>
          {Array.from({ length: 60 }).map((_, i) => {
            const lit = scan !== null && Math.abs(i / 59 * 100 - scan) < 4;
            return (
              <span
                key={i}
                className={
                  'flex-1 rounded-full transition-[height,background-color] duration-150 ' +
                  (lit
                    ? 'h-3 bg-sky-300'
                    : i % 10 === 0
                      ? 'h-2 bg-sky-400/40'
                      : 'h-1 bg-sky-400/20')
                }
              />
            );
          })}
        </div>
        <p className="w-24 shrink-0 text-right font-mono text-[0.6875rem] tabular-nums text-sky-300/90">
          {scan === null ? '100.0 %' : `${scan.toFixed(1)} %`}
        </p>
      </div>

      <figcaption className="mt-3 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-slate-500">
        {caption}
      </figcaption>
    </figure>
  );
}
