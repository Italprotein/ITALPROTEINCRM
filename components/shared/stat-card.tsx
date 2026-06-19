'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/shared/animated-counter';

type StatTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';

const toneMap: Record<StatTone, string> = {
  default: 'bg-brand-navy/5 text-brand-navy',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning-foreground',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  gold: 'bg-brand-gold/15 text-brand-goldDark',
};

interface StatTrend {
  value: number;
  label?: string;
}

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: StatTone;
  hint?: string;
  trend?: StatTrend;
  format?: (n: number) => string;
  href?: string;
  delay?: number;
}

/**
 * Premium KPI / stat card: tone-coloured icon chip, label, large value
 * (animated when numeric), optional trend chip and hint. Fades up on
 * entrance and lifts subtly on hover. Becomes a link when `href` is set.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  hint,
  trend,
  format,
  href,
  delay = 0,
}: StatCardProps) {
  const trendUp = trend ? trend.value >= 0 : false;

  const body = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{ y: -2 }}
      className={cn(
        'group h-full rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        href && 'cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              toneMap[tone],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-2xl font-bold tabular tracking-tight">
          {typeof value === 'number' ? (
            <AnimatedCounter value={value} format={format} />
          ) : (
            value
          )}
        </p>
        {trend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular',
              trendUp
                ? 'bg-success-subtle text-success'
                : 'bg-danger-subtle text-danger',
            )}
          >
            {trendUp ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      {(hint || trend?.label) && (
        <p className="mt-0.5 text-xs text-muted-foreground">{trend?.label ?? hint}</p>
      )}
    </motion.div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg">
        {body}
      </Link>
    );
  }

  return body;
}
