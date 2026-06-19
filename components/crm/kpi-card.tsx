import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
}

const toneMap: Record<NonNullable<KpiCardProps['tone']>, string> = {
  default: 'bg-brand-navy/5 text-brand-navy',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning-foreground',
  danger: 'bg-danger-subtle text-danger',
  info: 'bg-info-subtle text-info',
  gold: 'bg-brand-gold/15 text-brand-goldDark',
};

export function KpiCard({ label, value, icon: Icon, hint, tone = 'default' }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneMap[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
