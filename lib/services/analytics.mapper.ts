import { SAMPLE_STATUS_FLOW } from "@/lib/types";
import type { FirstContact } from "@/lib/types";

// Analytics is a cross-module READ-ONLY aggregator: there are no single-entity
// row<->DTO mappings here. Instead this module holds the pure helpers the actions
// share to reproduce the mock's bucketing/ranking math (month keys + labels, day
// spans, sample-status ranking) plus the typed reads of Json columns the
// aggregates touch (Company.firstContact). Plain server module (NO "use server").

/**
 * Charts used to read a hardcoded demo window (Sep 2025 → Jun 2026), which
 * silently dropped every row created after June — by late August the trends
 * were missing three months of real activity. The window is now derived from
 * the clock and the requested range instead.
 */

/** YYYY-MM key for a Date (UTC). */
export const monthKeyOf = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** The last `count` month keys, ending at the current month. */
export function monthsWindow(count: number, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(monthKeyOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return keys;
}

/** Hard ceiling for the "all time" window so a stray 1970 date cannot render a 700-bucket chart. */
const MAX_ALL_TIME_MONTHS = 60;

/**
 * The month buckets a trend chart should render: the last `months` keys, or —
 * when `months <= 0` ("all time") — every month from the earliest date in
 * `dates` through the current month.
 */
export function windowFor(
  dates: (string | null | undefined)[],
  months: number,
  now = new Date(),
): string[] {
  if (months > 0) return monthsWindow(months, now);
  const keys = dates.filter((d): d is string => Boolean(d)).map((d) => d.slice(0, 7)).sort();
  if (keys.length === 0) return monthsWindow(12, now);
  const [startY, startM] = keys[0].split("-").map(Number);
  const span =
    (now.getUTCFullYear() - startY) * 12 + (now.getUTCMonth() + 1 - startM) + 1;
  return monthsWindow(Math.max(1, Math.min(span, MAX_ALL_TIME_MONTHS)), now);
}

/** YYYY-MM bucket key from an ISO date string (or "" when absent). */
export const monthKey = (iso?: string | null): string => (iso ? iso.slice(0, 7) : "");

/** Human label for a YYYY-MM key, e.g. "Sep 25". */
export const monthLabel = (k: string): string => {
  const [y, m] = k.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "2-digit",
  });
};

/** Whole/fractional days between two ISO dates, or null when either is missing. */
export const daysBetween = (a?: string | null, b?: string | null): number | null => {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Number.isFinite(d) ? d : null;
};

/** Position of a sample status in the canonical flow (used for "at least" funnels). */
export const sampleRank = (s: string): number => SAMPLE_STATUS_FLOW.indexOf(s as never);

/** Typed read of the Company.firstContact Json column. */
export const firstContactOf = (v: unknown): FirstContact | null =>
  (v as FirstContact | null) ?? null;

/** ISO string from a nullable Prisma DateTime. */
export const iso = (d: Date | null | undefined): string | undefined => d?.toISOString();
