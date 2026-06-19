import { Badge } from '@/components/ui/badge';
import { getLabel, getTone, type LabelKind } from '@/lib/labels';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  kind: LabelKind;
  value: string | undefined | null;
  className?: string;
}

/**
 * Server-safe badge that resolves a domain value (status / stage / type …)
 * into a localised label + on-brand tone via `@/lib/labels`.
 */
export function StatusBadge({ kind, value, className }: StatusBadgeProps) {
  return (
    <Badge variant={getTone(kind, value)} className={className}>
      {getLabel(kind, value)}
    </Badge>
  );
}

interface PriorityBadgeProps {
  value: string;
  className?: string;
}

/** Priority badge with a small leading tone dot. */
export function PriorityBadge({ value, className }: PriorityBadgeProps) {
  return (
    <Badge variant={getTone('priority', value)} className={cn('pl-2', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {getLabel('priority', value)}
    </Badge>
  );
}
