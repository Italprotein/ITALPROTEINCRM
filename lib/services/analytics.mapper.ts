import { SAMPLE_STATUS_FLOW } from "@/lib/types";
import type { FirstContact } from "@/lib/types";

// Analytics is a cross-module READ-ONLY aggregator: there are no single-entity
// row<->DTO mappings here. Instead this module holds the pure helpers the actions
// share to reproduce the mock's bucketing/ranking math (month keys + labels, day
// spans, sample-status ranking) plus the typed reads of Json columns the
// aggregates touch (Company.firstContact). Plain server module (NO "use server").

/** The active demo window: months Sep 2025 -> Jun 2026 (matches the mock). */
export const MONTHS = [
  "2025-09", "2025-10", "2025-11", "2025-12", "2026-01",
  "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
];

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
