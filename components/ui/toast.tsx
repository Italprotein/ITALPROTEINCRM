'use client';

import { CheckCircle2, AlertTriangle, XCircle, Info, type LucideIcon } from 'lucide-react';

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms. Defaults to 4000. */
  duration?: number;
}

export interface ToasterToast extends ToastOptions {
  id: string;
}

/** Per-variant icon + accent classes used by the Toaster renderer. */
export const toastVariantConfig: Record<
  ToastVariant,
  { icon: LucideIcon; iconClassName: string; accentClassName: string }
> = {
  default: {
    icon: Info,
    iconClassName: 'text-muted-foreground',
    accentClassName: 'border-l-border',
  },
  success: {
    icon: CheckCircle2,
    // text-success on bg-card measured 3.78:1 (light, --success is tuned for
    // white-chip contrast, not small text) — text-success-text is the copy token.
    iconClassName: 'text-success-text',
    accentClassName: 'border-l-success',
  },
  warning: {
    icon: AlertTriangle,
    // text-warning-foreground on bg-card measured 1.27:1 (dark) — see badge.tsx's
    // warning variant for the same root cause; text-warning-text fixes both themes.
    iconClassName: 'text-warning-text',
    accentClassName: 'border-l-warning',
  },
  danger: {
    icon: XCircle,
    // text-danger on bg-card measured 3.72:1 (dark) — text-danger-text is the
    // existing copy token for this exact role (see app/globals.css).
    iconClassName: 'text-danger-text',
    accentClassName: 'border-l-danger',
  },
  info: {
    icon: Info,
    // Fix round 1: text-info on bg-card measured 3.50:1 in dark (--info is
    // never redefined in .dark). --info-text is a dedicated copy token (like
    // danger-text) so --info itself stays untouched for the passing
    // white-chip role (info-foreground on info, 5.20:1 both themes).
    iconClassName: 'text-info-text',
    accentClassName: 'border-l-info',
  },
};
