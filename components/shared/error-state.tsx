'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Failure panel with an alert glyph and an optional retry action.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this data. Please try again.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-danger/40 bg-danger-subtle/40 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-subtle text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCcw />
          Retry
        </Button>
      ) : null}
    </div>
  );
}
