'use client';

import * as React from 'react';
import { uid } from '@/lib/utils';
import type { ToastOptions, ToasterToast } from './toast';

const DEFAULT_DURATION = 4000;

type Listener = (toasts: ToasterToast[]) => void;

let toasts: ToasterToast[] = [];
const listeners = new Set<Listener>();
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

function clearTimer(id: string) {
  const timer = timeouts.get(id);
  if (timer) {
    clearTimeout(timer);
    timeouts.delete(id);
  }
}

/** Remove a toast by id (or all toasts when id is omitted). */
export function dismiss(id?: string): void {
  if (id === undefined) {
    toasts.forEach((t) => clearTimer(t.id));
    toasts = [];
  } else {
    clearTimer(id);
    toasts = toasts.filter((t) => t.id !== id);
  }
  emit();
}

/** Push a toast onto the stack; auto-dismisses after `duration` ms. Returns the id. */
export function toast(opts: ToastOptions): string {
  const id = uid('toast');
  const duration = opts.duration ?? DEFAULT_DURATION;
  const next: ToasterToast = { ...opts, id };

  toasts = [next, ...toasts];
  emit();

  if (duration !== Infinity && duration > 0) {
    timeouts.set(
      id,
      setTimeout(() => dismiss(id), duration),
    );
  }

  return id;
}

/** React hook: subscribes to the module-level toast store. */
export function useToast() {
  const [state, setState] = React.useState<ToasterToast[]>(toasts);

  React.useEffect(() => {
    listeners.add(setState);
    setState(toasts);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return { toasts: state, toast, dismiss } as const;
}
