'use client';

import * as React from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

/*
 * Edit one coded field straight from a table row.
 *
 * Opening a company just to change its stage is the slowest possible way to do
 * the most common edit, so the cell itself is the control. The write is
 * optimistic — the row updates immediately and rolls back if the server
 * refuses — because waiting on a round-trip for a dropdown feels broken.
 */

export interface InlineOption<T extends string> {
  value: T;
  label: string;
}

export function InlineSelect<T extends string>({
  value,
  options,
  onChange,
  disabled,
  render,
  align = 'start',
  className,
  ariaLabel,
}: {
  value: T;
  options: InlineOption<T>[];
  /** Persist the change. Throwing rolls the cell back to its previous value. */
  onChange: (next: T) => Promise<void> | void;
  disabled?: boolean;
  /** How the current value is displayed when not editing (usually a badge). */
  render: (value: T) => React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
  ariaLabel?: string;
}) {
  const [optimistic, setOptimistic] = React.useState<T | null>(null);
  const [saving, setSaving] = React.useState(false);
  const shown = optimistic ?? value;

  // Drop the optimistic value once the parent's data catches up, so a later
  // change from elsewhere is not masked by a stale local override.
  React.useEffect(() => {
    if (optimistic !== null && value === optimistic) setOptimistic(null);
  }, [value, optimistic]);

  async function pick(next: T) {
    if (next === shown) return;
    const previous = shown;
    setOptimistic(next);
    setSaving(true);
    try {
      await onChange(next);
    } catch {
      setOptimistic(previous === value ? null : previous);
    } finally {
      setSaving(false);
    }
  }

  if (disabled) return <>{render(shown)}</>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={ariaLabel}
        // stopPropagation: the row itself navigates to the company on click.
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'group/inline -mx-1 inline-flex max-w-full items-center gap-1 rounded px-1 py-0.5 text-left',
          'transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <span className="min-w-0 truncate">{render(shown)}</span>
        {saving ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/inline:opacity-100" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="max-h-72 w-64 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onClick={(e) => {
              e.stopPropagation();
              void pick(o.value);
            }}
            className="gap-2"
          >
            <Check className={cn('h-4 w-4 shrink-0', o.value === shown ? 'opacity-100' : 'opacity-0')} />
            <span className="truncate">{o.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
