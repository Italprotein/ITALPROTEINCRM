'use client';

import * as React from 'react';
import { useInView } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
  className?: string;
}

/**
 * Counts from 0 up to `value` once it scrolls into view, using
 * requestAnimationFrame with an ease-out curve. Honours
 * `prefers-reduced-motion` by jumping straight to the final value.
 */
export function AnimatedCounter({
  value,
  durationMs = 900,
  format = (n) => String(Math.round(n)),
  className,
}: AnimatedCounterProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = React.useState(0);
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || durationMs <= 0) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    let start: number | null = null;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      setDisplay(value * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}
