'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value, 0..100. */
  value?: number;
  /** Optional class applied to the fill indicator. */
  indicatorClassName?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, indicatorClassName, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
        {...props}
      >
        <motion.div
          className={cn('h-full rounded-full bg-brand-gold', indicatorClassName)}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
