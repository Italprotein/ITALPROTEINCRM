'use client';

import * as React from 'react';
import DottedMap from 'dotted-map';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface MapMarker {
  lat: number;
  lng: number;
  /** Country name shown in the accessible tooltip. */
  label: string;
  /** Optional legacy treatment for callers that need to distinguish a base. */
  home?: boolean;
}

interface MapProps {
  markers?: readonly MapMarker[];
  homeColor?: string;
  marketColor?: string;
  className?: string;
}

const MAP_WIDTH = 800;
const MAP_HEIGHT = 400;

function makeMap(color: string) {
  const map = new DottedMap({
    height: 100,
    grid: 'diagonal',
    projection: { name: 'equirectangular' },
  });
  return map.getSVG({
    radius: 0.22,
    color,
    shape: 'circle',
    backgroundColor: 'transparent',
  });
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
  homeColor = '#FACC15',
  marketColor = '#FACC15',
  className,
}: MapProps) {
  const [activeMarker, setActiveMarker] = React.useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const lightMap = React.useMemo(() => makeMap('#0A16282B'), []);
  const darkMap = React.useMemo(() => makeMap('#D7E8F626'), []);

  return (
    <div className={cn('w-full font-sans', className)}>
      <motion.div
        className="relative isolate aspect-[2/1] w-full"
        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
        animate={reduceMotion ? { opacity: 1, y: 0 } : undefined}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.22 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        aria-label="Italprotein international outreach map"
        role="group"
      >
        <div
          className="pointer-events-none absolute inset-[4%_0] rounded-[32%] bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-blue)/0.08),transparent_68%)] blur-2xl dark:bg-[radial-gradient(ellipse_at_center,hsl(var(--brand-blue-bright)/0.08),transparent_68%)]"
          aria-hidden
        />

        {/* Inline SVG data is generated locally; next/image cannot optimise it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(lightMap)}`}
          className="pointer-events-none h-full w-full select-none opacity-80 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] dark:hidden"
          alt=""
          height={MAP_HEIGHT}
          width={MAP_WIDTH}
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(darkMap)}`}
          className="pointer-events-none hidden h-full w-full select-none opacity-80 [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_90%,transparent)] dark:block"
          alt=""
          height={MAP_HEIGHT}
          width={MAP_WIDTH}
          draggable={false}
        />

        <div className="absolute inset-0" aria-label={`${markers.length} outreach locations`} role="group">
          {markers.map((marker, index) => {
            const { x, y } = projectPoint(marker.lat, marker.lng);
            const color = marker.home ? homeColor : marketColor;
            const tooltipId = `map-marker-${index}`;
            const isActive = activeMarker === index;

            return (
              <button
                key={`${marker.label}-${marker.lat}-${marker.lng}`}
                type="button"
                className="map-marker-hit group/marker pointer-events-auto absolute z-10 flex -translate-x-1/2 -translate-y-1/2 touch-manipulation items-center justify-center rounded-full focus-visible:z-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blueBright focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                style={{ left: `${x}%`, top: `${y}%` }}
                aria-label={marker.label}
                aria-describedby={tooltipId}
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
                  className="relative h-1.5 w-1.5 rounded-full border border-white/70 shadow-[0_0_0_1px_rgb(10_22_40/0.16)] transition-transform duration-300 group-hover/marker:scale-125 group-focus-visible/marker:scale-125 dark:border-brand-navy/80"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <span
                  id={tooltipId}
                  role="tooltip"
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
      </motion.div>
    </div>
  );
}
