import type { NDAStatus } from "@/lib/types";

/**
 * NDA lifecycle order used only when reconciling the legacy Company cache with
 * the current NDA register row.  A reconciliation may move forward, but must
 * never turn a known signature back into an earlier workflow state.
 */
const NDA_PROGRESS: Record<NDAStatus, number> = {
  not_required: 0,
  to_prepare: 1,
  draft: 2,
  sent: 3,
  under_review: 4,
  changes_requested: 5,
  approved: 6,
  awaiting_italprotein_signature: 7,
  awaiting_counterparty_signature: 8,
  partially_signed: 9,
  fully_signed: 10,
  expired: -1,
  terminated: -1,
};

const TERMINAL = new Set<NDAStatus>(["expired", "terminated"]);

/**
 * Merge two independently stored legacy statuses without losing progress.
 * Terminal statuses belong to a specific agreement, so the current NDA row is
 * authoritative for those instead of comparing them as workflow progress.
 */
export function reconcileNdaStatus(
  companyStatus: NDAStatus | null | undefined,
  currentNdaStatus: NDAStatus | null | undefined,
): NDAStatus {
  if (!currentNdaStatus) return companyStatus ?? "not_required";
  if (!companyStatus) return currentNdaStatus;
  if (TERMINAL.has(currentNdaStatus) || TERMINAL.has(companyStatus)) return currentNdaStatus;
  return NDA_PROGRESS[currentNdaStatus] >= NDA_PROGRESS[companyStatus]
    ? currentNdaStatus
    : companyStatus;
}

