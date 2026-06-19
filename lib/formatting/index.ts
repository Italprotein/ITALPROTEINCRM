import type { Currency, ISODate, Locale } from '@/lib/types';

const LOCALE_TAG: Record<Locale, string> = { en: 'en-GB', it: 'it-IT' };

/** Currency formatting respecting locale + currency code. */
export function formatCurrency(
  amount: number | undefined | null,
  currency: Currency = 'EUR',
  locale: Locale = 'en',
  opts: { compact?: boolean } = {},
): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat(LOCALE_TAG[locale], {
    style: 'currency',
    currency,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatNumber(value: number | undefined | null, locale: Locale = 'en'): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(value);
}

export function formatDate(date: ISODate | undefined | null, locale: Locale = 'en'): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: ISODate | undefined | null, locale: Locale = 'en'): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Relative time ("3 days ago" / "in 2 weeks") computed against a reference date.
 * A fixed `now` can be injected so the prototype stays deterministic in tests.
 */
export function formatRelative(date: ISODate | undefined | null, locale: Locale = 'en', now = new Date()): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = d.getTime() - now.getTime();
  const rtf = new Intl.RelativeTimeFormat(LOCALE_TAG[locale], { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms || unit === 'minute') {
      return rtf.format(Math.round(diffMs / ms), unit);
    }
  }
  return rtf.format(0, 'minute');
}

export function formatQuantity(value: number, unit: string, locale: Locale = 'en'): string {
  return `${formatNumber(value, locale)} ${unit}`;
}

export function daysUntil(date: ISODate | undefined | null, now = new Date()): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isOverdue(date: ISODate | undefined | null, now = new Date()): boolean {
  const d = daysUntil(date, now);
  return d != null && d < 0;
}

/** Country flag emoji from an ISO 3166-1 alpha-2 code. */
export function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  const base = 'A'.charCodeAt(0);
  return String.fromCodePoint(
    ...countryCode.toUpperCase().split('').map((c) => A + (c.charCodeAt(0) - base)),
  );
}
