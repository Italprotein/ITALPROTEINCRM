import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Centered, subtle placeholder for empty lists / no-results panels.
 * Server-safe (no hooks) — usable anywhere.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'surface-quiet flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden />
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
