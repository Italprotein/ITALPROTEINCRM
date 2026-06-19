'use client';

import * as React from 'react';
import { motion, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Shared framer-motion primitives for the CRM.
 * Durations are kept fast (0.3–0.45s) and movement subtle so the UI
 * feels premium rather than bouncy. Pair with `whileInView` for
 * scroll-triggered reveals.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: EASE },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE },
  },
};

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/** Single element that fades + lifts into place once on mount. */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE, delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Container that staggers its `StaggerItem` children as they scroll into view.
 * Use `<Stagger>` wrapping multiple `<StaggerItem>` elements.
 */
export function Stagger({ children, className }: StaggerProps) {
  return (
    <motion.div
      className={cn(className)}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
    >
      {children}
    </motion.div>
  );
}

/** Child of `<Stagger>`; reveals with the parent's staggered timing. */
export function StaggerItem({ children, className }: StaggerProps) {
  return (
    <motion.div className={cn(className)} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
