import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware className combiner used by every UI primitive. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Initials fallback for company / person avatars. */
export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, max)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Stable pseudo-random index from a string (deterministic avatar colours). */
export function hashIndex(seed: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % modulo;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
