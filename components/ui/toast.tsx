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
    iconClassName: 'text-success',
    accentClassName: 'border-l-success',
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'text-warning-foreground',
    accentClassName: 'border-l-warning',
  },
  danger: {
    icon: XCircle,
    iconClassName: 'text-danger',
    accentClassName: 'border-l-danger',
  },
  info: {
    icon: Info,
    iconClassName: 'text-info',
    accentClassName: 'border-l-info',
  },
};
