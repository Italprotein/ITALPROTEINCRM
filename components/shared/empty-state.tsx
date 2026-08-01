import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** "compact" fits inside board lanes and small panels without dominating them. */
  size?: 'default' | 'compact';
}

/**
 * Centered, subtle placeholder for empty lists / no-results panels.
 * Server-safe (no hooks) — usable anywhere.
 */
export function EmptyState({ icon: Icon, title, description, action, className, size = 'default' }: EmptyStateProps) {
  const compact = size === 'compact';
  return (
    <div
      className={cn(
        'surface-quiet flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-6' : 'px-6 py-14',
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            'flex items-center justify-center rounded-full bg-muted text-muted-foreground',
            compact ? 'mb-2 h-9 w-9' : 'mb-4 h-12 w-12',
          )}
        >
          <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} aria-hidden />
        </span>
      ) : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
