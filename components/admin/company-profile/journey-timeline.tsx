'use client';

import * as React from 'react';
import { Check, Circle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatting';

export interface JourneyStep {
  key: string;
  label: string;
  icon: LucideIcon;
  date?: string | null;
  /** done = completed, active = current/in-progress, pending = not yet reached */
  state: 'done' | 'active' | 'pending';
  detail?: React.ReactNode;
}

const stateRing: Record<JourneyStep['state'], string> = {
  done: 'border-success bg-success-subtle text-success',
  active: 'border-info bg-info-subtle text-info',
  pending: 'border-border bg-muted text-muted-foreground',
};

/**
 * Vertical journey timeline used on the company Overview tab.
 * Renders First contact → NDA → Sample → Shipment → Testing → Feedback
 * with completion icons, dates and inline status badges.
 */
export function JourneyTimeline({ steps }: { steps: JourneyStep[] }) {
  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isLast = i === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[19px] top-10 h-[calc(100%-1.5rem)] w-px',
                  step.state === 'done' ? 'bg-success/40' : 'bg-border',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2',
                stateRing[step.state],
              )}
            >
              {step.state === 'done' ? (
                <Check className="h-5 w-5" />
              ) : step.state === 'active' ? (
                <Icon className="h-5 w-5" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-foreground">{step.label}</p>
                <span className="text-xs tabular text-muted-foreground">
                  {step.date ? formatDate(step.date) : '—'}
                </span>
              </div>
              {step.detail && <div className="mt-1 text-sm text-muted-foreground">{step.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
