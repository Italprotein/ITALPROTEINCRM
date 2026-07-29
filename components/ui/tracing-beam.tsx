'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useTransform, useScroll, useSpring } from 'framer-motion';

import { cn } from '@/lib/utils';

/*
 * Scroll-tracing beam (adapted from Aceternity UI).
 *
 * Changes from upstream:
 *  - imports framer-motion, the animation library the rest of the app uses,
 *    rather than pulling in a second one;
 *  - the rail sits inside the layout (upstream used a negative left offset that
 *    overflows when the beam is placed inside a padded container), so consumers
 *    add left padding to give it a gutter;
 *  - Italprotein colourway: sky blue -> near-white -> gold, instead of the
 *    stock cyan/violet.
 */

/** Brand colourway for the travelling highlight. */
const BEAM_FROM = '#38bdf8'; // Proamina sky blue
const BEAM_MID = '#e0f2fe'; // near-white — stays visible on pale sections
const BEAM_TO = '#facc15'; // Italprotein gold

export const TracingBeam = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);

  // Track the content height so the rail always spans the section, including
  // after fonts load or the viewport changes.
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const measure = () => setSvgHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const y1 = useSpring(useTransform(scrollYProgress, [0, 0.8], [50, svgHeight]), {
    stiffness: 500,
    damping: 90,
  });
  const y2 = useSpring(useTransform(scrollYProgress, [0, 1], [50, svgHeight - 200]), {
    stiffness: 500,
    damping: 90,
  });

  return (
    <motion.div ref={ref} className={cn('relative mx-auto h-full w-full max-w-4xl', className)}>
      {/* The rail. Hidden on small screens, where there is no gutter to spare. */}
      <div className="pointer-events-none absolute top-3 left-0 hidden md:block" aria-hidden="true">
        <motion.div
          transition={{ duration: 0.2, delay: 0.5 }}
          animate={{
            boxShadow: scrollYProgress.get() > 0 ? 'none' : 'rgba(10, 22, 40, 0.18) 0px 3px 8px',
          }}
          className="ml-[27px] flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background shadow-sm"
        >
          <motion.div
            transition={{ duration: 0.2, delay: 0.5 }}
            animate={{
              backgroundColor: scrollYProgress.get() > 0 ? 'var(--tb-idle, #ffffff)' : BEAM_FROM,
              borderColor: scrollYProgress.get() > 0 ? 'var(--tb-idle, #ffffff)' : BEAM_TO,
            }}
            className="h-2 w-2 rounded-full border border-border bg-background"
          />
        </motion.div>
        <svg viewBox={`0 0 20 ${svgHeight}`} width="20" height={svgHeight} className="ml-4 block">
          {/* Static track */}
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
            fill="none"
            stroke="currentColor"
            className="text-brand-navy/15 dark:text-white/15"
            transition={{ duration: 10 }}
          />
          {/* Travelling highlight */}
          <motion.path
            d={`M 1 0V -36 l 18 24 V ${svgHeight * 0.8} l -18 24V ${svgHeight}`}
            fill="none"
            stroke="url(#italprotein-beam)"
            strokeWidth="1.5"
            className="motion-reduce:hidden"
            transition={{ duration: 10 }}
          />
          <defs>
            <motion.linearGradient
              id="italprotein-beam"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={y1}
              y2={y2}
            >
              <stop stopColor={BEAM_FROM} stopOpacity="0" />
              <stop offset="0.1" stopColor={BEAM_FROM} />
              <stop offset="0.5" stopColor={BEAM_MID} />
              <stop offset="0.9" stopColor={BEAM_TO} />
              <stop offset="1" stopColor={BEAM_TO} stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
};
