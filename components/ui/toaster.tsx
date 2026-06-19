'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from './use-toast';
import { toastVariantConfig, type ToastVariant } from './toast';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="pointer-events-none fixed bottom-0 right-0 z-[100] flex w-full max-w-[420px] flex-col gap-2 p-4 sm:bottom-4 sm:right-4 sm:p-0"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const variant: ToastVariant = t.variant ?? 'default';
          const { icon: Icon, iconClassName, accentClassName } = toastVariantConfig[variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-lg border border-l-4 bg-card p-4 text-card-foreground shadow-lg',
                accentClassName,
              )}
              role="status"
              aria-live="polite"
            >
              <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', iconClassName)} />
              <div className="flex-1 space-y-1">
                {t.title && (
                  <div className="text-sm font-semibold leading-tight text-foreground">
                    {t.title}
                  </div>
                )}
                {t.description && (
                  <div className="text-sm text-muted-foreground">{t.description}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className={cn(
                  'shrink-0 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity',
                  'hover:opacity-100 hover:bg-accent hover:text-accent-foreground',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
