/**
 * Courier updates -> shipment state. The pure half.
 *
 * `lib/backend/courier-email.ts` has always been able to read a delivery state
 * out of a courier email, and `ShipmentEvent` has always had a place to put it,
 * but nothing ever joined the two — so `actualDelivery` was only ever set by
 * hand and every delivery KPI on the report page read zero.
 *
 * This module is the decision layer in between: given what a shipment currently
 * says about itself and what one courier email claims, what (if anything)
 * should change. No Prisma import, so the rules below are unit-testable with no
 * database — same split as lib/company-logo.ts and lib/follow-up.ts.
 */

import type { ShipmentStatus } from "@/lib/types";

/** The states `parseCourierEmail` can report. */
export type CourierStatus =
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "unknown";

/** Re-exported under a local name so the rules below read unambiguously. */
export type ShipmentStatusName = ShipmentStatus;

/**
 * Forward-only progress ladder.
 *
 * Courier mail arrives out of order — a delivery notice and a "your parcel is
 * on its way" can land in either sequence, and the sync re-reads the whole
 * mailbox every run. A shipment may therefore only ever move UP this ladder,
 * which is what stops a stale in-transit notice from un-delivering a parcel.
 *
 * `delayed`, `customs_hold` and `exception` are deliberately absent: they are
 * conditions, not progress, and are handled separately below.
 */
const PROGRESS: readonly ShipmentStatusName[] = [
  "pending",
  "preparing",
  "in_transit",
  "delivered",
  "delivery_confirmed",
];

const rank = (status: ShipmentStatusName): number => {
  const index = PROGRESS.indexOf(status);
  // Off-ladder conditions sit level with in_transit: the parcel is somewhere
  // between dispatch and delivery, which is exactly what they mean.
  return index === -1 ? PROGRESS.indexOf("in_transit") : index;
};

/**
 * A tracking number in a form two strings can be compared in.
 *
 * Couriers print the same number as `1234-5678 90`, `1234567890` and
 * `1234.5678.9012` across the email body, the label and the CRM field, so both
 * sides are reduced to bare alphanumerics before matching. Anything with no
 * alphanumeric content returns "" — and the caller must never match on "", or
 * every un-numbered shipment would match every un-numbered email.
 */
export function normalizeTracking(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Courier vocabulary -> ShipmentStatus, or null when the email said nothing useful. */
export function shipmentStatusFromCourier(status: CourierStatus): ShipmentStatusName | null {
  if (status === "delivered") return "delivered";
  // The enum has no out_for_delivery: for our purposes it is still in transit.
  if (status === "in_transit" || status === "out_for_delivery") return "in_transit";
  if (status === "exception") return "exception";
  return null;
}

/** True once the promised date has passed with nothing delivered. */
export function isDelayedNow(
  shipment: { estimatedDelivery?: string | null; actualDelivery?: string | null },
  now: Date = new Date(),
): boolean {
  if (shipment.actualDelivery) return false;
  if (!shipment.estimatedDelivery) return false;
  const estimate = new Date(shipment.estimatedDelivery).getTime();
  return Number.isFinite(estimate) && estimate < now.getTime();
}

export interface ShipmentSnapshot {
  status: ShipmentStatusName;
  actualDelivery?: string | null;
  estimatedDelivery?: string | null;
  isDelayed?: boolean;
}

export interface CourierClaim {
  status: CourierStatus;
  /** When the courier says it happened — always preferred over the clock. */
  occurredAt: string;
}

export interface ShipmentUpdatePlan {
  status?: ShipmentStatusName;
  actualDelivery?: string;
  isDelayed?: boolean;
}

/**
 * What one courier email should change about one shipment, or null for nothing.
 *
 * The rules, in the order they bite:
 *
 *  1. `delivery_confirmed` is terminal. That state is set by the customer
 *     confirming receipt in the portal, which outranks anything a carrier's
 *     mail server has to say — so nothing here may overwrite it.
 *  2. A delivery date is stamped once, from the email's own timestamp. Later
 *     delivery notices for the same parcel never re-stamp it.
 *  3. Status only moves forward along PROGRESS (see above).
 *  4. An exception is only worth recording while the parcel is still in flight;
 *     raising one over an already-delivered shipment would be noise.
 *  5. `isDelayed` is recomputed from the resulting state, so it clears itself
 *     the moment a late parcel actually arrives.
 */
export function planShipmentUpdate(
  shipment: ShipmentSnapshot,
  claim: CourierClaim,
  now: Date = new Date(),
): ShipmentUpdatePlan | null {
  if (shipment.status === "delivery_confirmed") return null;

  const plan: ShipmentUpdatePlan = {};
  const claimed = shipmentStatusFromCourier(claim.status);
  const alreadyDelivered = Boolean(shipment.actualDelivery) || shipment.status === "delivered";

  if (claimed === "delivered") {
    if (!shipment.actualDelivery) plan.actualDelivery = claim.occurredAt;
    if (rank("delivered") > rank(shipment.status)) plan.status = "delivered";
  } else if (claimed === "exception") {
    if (!alreadyDelivered && shipment.status !== "exception") plan.status = "exception";
  } else if (claimed && rank(claimed) > rank(shipment.status)) {
    plan.status = claimed;
  }

  const delayed = isDelayedNow(
    {
      estimatedDelivery: shipment.estimatedDelivery,
      actualDelivery: plan.actualDelivery ?? shipment.actualDelivery,
    },
    now,
  );
  if (delayed !== Boolean(shipment.isDelayed)) plan.isDelayed = delayed;

  return Object.keys(plan).length > 0 ? plan : null;
}
