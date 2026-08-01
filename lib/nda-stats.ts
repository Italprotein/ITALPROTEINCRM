import type { NDA, NDAStatus } from "@/lib/types";
import { selectCurrentNdasWithFile } from "@/lib/nda-current";

/**
 * Every NDA count in the CRM is derived here, from the *current* register row
 * per company. `Company.ndaStatus` is a cache for row rendering and the portal
 * access gate; counting it separately is what let the Aziende strip and the NDA
 * register disagree.
 */

/** The paper is out with a counterparty and nobody has countersigned yet. */
export const NDA_AWAITING_STATUSES: NDAStatus[] = [
  "sent",
  "under_review",
  "changes_requested",
  "approved",
  "awaiting_italprotein_signature",
  "awaiting_counterparty_signature",
  "partially_signed",
];

/** Reached "there is a signature on file", so the funnel counts it as sent too. */
const SENT_STATUSES: NDAStatus[] = [...NDA_AWAITING_STATUSES, "fully_signed"];

/**
 * Newest register row per company, matching the ordering `currentNdaByCompany`
 * gets from Prisma. The fixture-backed mock services have no database to order
 * for them, so they reduce here instead and reach the same answer.
 */
export function currentNdasOf(all: readonly NDA[]): NDA[] {
  const ordered = [...all].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return selectCurrentNdasWithFile(
    ordered,
    (n) => n.companyId,
    () => false,
    () => 0,
  ).map((entry) => entry.current);
}

export interface NdaTallies {
  total: number;
  byStatus: Record<NDAStatus, number>;
  awaitingSignature: number;
  signed: number;
  toPrepare: number;
}

/**
 * `statuses` must already be reduced to one entry per company (see
 * `selectCurrentNdasWithFile` in `lib/nda-current.ts`). `not_required` means the
 * company has no agreement in flight, so it is excluded from every bucket.
 */
export function ndaStatusTallies(statuses: Iterable<NDAStatus>): NdaTallies {
  const byStatus = {} as Record<NDAStatus, number>;
  let total = 0;
  let awaitingSignature = 0;
  let signed = 0;
  let toPrepare = 0;

  for (const status of statuses) {
    if (status === "not_required") continue;
    total += 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (NDA_AWAITING_STATUSES.includes(status)) awaitingSignature += 1;
    if (status === "fully_signed") signed += 1;
    if (status === "to_prepare" || status === "draft") toPrepare += 1;
  }

  return { total, byStatus, awaitingSignature, signed, toPrepare };
}

/** Prepared → Sent → Signed, each stage a superset of the next. */
export function ndaFunnelCounts(statuses: Iterable<NDAStatus>): {
  prepared: number;
  sent: number;
  signed: number;
} {
  let prepared = 0;
  let sent = 0;
  let signed = 0;

  for (const status of statuses) {
    if (status === "not_required") continue;
    prepared += 1;
    if (SENT_STATUSES.includes(status)) sent += 1;
    if (status === "fully_signed") signed += 1;
  }

  return { prepared, sent, signed };
}
