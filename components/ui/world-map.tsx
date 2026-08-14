'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface MapMarker {
  lat: number;
  lng: number;
  /** Country name shown in the accessible tooltip. */
  label: string;
}

interface MapProps {
  markers?: readonly MapMarker[];
  /** Colour of every marker. The map states presence, so all pins read alike. */
  marketColor?: string;
  className?: string;
  label?: string;
  markersLabel?: string;
}

function projectPoint(lat: number, lng: number) {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}

function tooltipAlignment(lng: number) {
  if (lng < -145) return 'left-0';
  if (lng > 145) return 'right-0';
  return 'left-1/2 -translate-x-1/2';
}

export default function WorldMap({
  markers = [],
  marketColor = '#FACC15',
  className,
  label = 'Italprotein international outreach map',
  markersLabel = `${markers.length} outreach locations`,
}: MapProps) {
  const [activeMarker, setActiveMarker] = React.useState<number | null>(null);

  return (
    <div className={cn('w-full font-sans', className)}>
      {/* No entrance animation lives here. The map is revealed by the page's
          `Reveal` wrapper, so the whole page has one entrance mechanism and
          this route no longer pulls in framer-motion just to fade a section
          in. (`Reveal` is also observer-driven, so this is a consistency and
          bundle win, not a no-JS one.) */}
      <div className="relative isolate aspect-[2/1] w-full" aria-label={label} role="group">
        <div
          className="pointer-events-none absolute inset-[4%_0] rounded-[32%] bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-blue)/0.08),transparent_68%)] blur-2xl dark:bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-blue-bright)/0.08),transparent_68%)]"
          aria-hidden
        />

        {/* The dot field is a static asset (scripts/generate-world-dots.mjs),
            not two inline SVG data URIs rebuilt on every request — see that
            script for why. It is CSS-masked onto a plain background-color
            div, so the theme switch is a `dark:` class instead of a second
            multi-hundred-KB payload. */}
        <div
          className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)]"
          aria-hidden
        >
          <div className="h-full w-full opacity-80 [mask-image:url('/marketing/world-dots.svg')] [mask-size:100%_100%] [mask-repeat:no-repeat] [-webkit-mask-image:url('/marketing/world-dots.svg')] [-webkit-mask-size:100%_100%] [-webkit-mask-repeat:no-repeat] bg-[hsl(var(--brand-navy)/0.17)] dark:bg-[rgb(215_232_246/0.15)]" />
        </div>

        <div className="absolute inset-0" aria-label={markersLabel} role="group">
          {markers.map((marker, index) => {
            const { x, y } = projectPoint(marker.lat, marker.lng);
            const color = marketColor;
            const isActive = activeMarker === index;

            return (
              <button
                key={`${marker.label}-${marker.lat}-${marker.lng}`}
                type="button"
                className="map-marker-hit group/marker pointer-events-auto absolute z-10 flex -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full focus-visible:z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-label={marker.label}
                onClick={() => setActiveMarker((current) => (current === index ? null : index))}
                onBlur={() => setActiveMarker(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setActiveMarker(null);
                    event.currentTarget.blur();
                  }
                }}
              >
                <span
                  className="absolute h-3.5 w-3.5 rounded-full opacity-25 motion-safe:animate-map-pulse sm:h-3 sm:w-3"
                  style={{ backgroundColor: color, animationDelay: `${(index % 8) * -0.42}s` }}
                  aria-hidden
                />
                <span
                  // `shadow-yellow-pin` is the navy ring plus the warm halo the
                  // token was defined for; the hand-written arbitrary shadow
                  // here only ever applied the ring half and dropped the glow.
                  className="relative h-1.5 w-1.5 rounded-full border border-white/70 shadow-yellow-pin transition-transform duration-300 group-hover/marker:scale-125 group-focus-visible/marker:scale-125 dark:border-brand-navy/80"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded-md border border-border/80 bg-popover px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.02em] text-popover-foreground opacity-0 shadow-lg transition-[opacity,transform] duration-200 motion-safe:translate-y-1',
                    'group-hover/marker:translate-y-0 group-hover/marker:opacity-100 group-focus-visible/marker:translate-y-0 group-focus-visible/marker:opacity-100',
                    tooltipAlignment(marker.lng),
                    isActive && 'translate-y-0 opacity-100',
                  )}
                >
                  {marker.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
