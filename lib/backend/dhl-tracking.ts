/**
 * Asking DHL where the parcels are. The implementation half.
 *
 * The email sync (lib/backend/shipment-tracking.ts) can only learn what DHL
 * chose to email us about, whenever they chose to send it. This asks directly,
 * which is the difference between finding out a parcel was delivered on Tuesday
 * and finding out on Tuesday.
 *
 * The two share everything downstream: the same `planShipmentUpdate` rules, the
 * same ShipmentEvent table, the same forward-only ladder. They differ only in
 * the `source` column, which is what keeps their timelines distinguishable and
 * their idempotency keys from colliding.
 *
 * Deliberately NOT "use server" — every export in such a file becomes a public
 * POST endpoint. The guarded entry point is
 * app/api/shipments/sync-dhl/route.ts.
 */

import { prisma } from "@/lib/backend/prisma";
import {
  dhlFailureFor,
  isFatalDhlFailure,
  parseDhlResponse,
  type DhlEvent,
  type DhlFailure,
  type DhlShipment,
} from "@/lib/dhl-tracking";
import {
  normalizeTracking,
  planShipmentUpdate,
  shipmentStatusFromCourier,
  type ShipmentStatusName,
} from "@/lib/shipment-tracking";

/** Distinct from the email sync's "gmail" — see the module note above. */
const SOURCE = "dhl_api";

const API_BASE = "https://api-eu.dhl.com/track/shipments";

/**
 * Budget for one run.
 *
 * The free Unified Tracking tier allows on the order of 250 calls a day and
 * throttles hard on bursts. At 40 parcels an hour this run can never spend more
 * than its share, and `THROTTLE_MS` keeps it under the per-second ceiling
 * without needing a queue.
 */
const MAX_CALLS_PER_RUN = Number(process.env.DHL_MAX_CALLS_PER_RUN ?? 40);
const THROTTLE_MS = Number(process.env.DHL_THROTTLE_MS ?? 1100);

/**
 * How long before a parcel is worth asking about again.
 *
 * A parcel in transit does not change state every hour, and the budget is
 * better spent covering every open shipment once than one shipment often.
 */
const COOLDOWN_MS = Number(process.env.DHL_COOLDOWN_MINUTES ?? 240) * 60_000;

/**
 * The one terminal state — the customer confirmed receipt in the portal, which
 * outranks anything a carrier can say. Never spend a call on these.
 *
 * `delivered` is deliberately absent: a shipment can be marked delivered with
 * no `actualDelivery` date, and polling is exactly how that date gets filled
 * in. The `actualDelivery: null` filter below retires those instead.
 */
const SETTLED: ShipmentStatusName[] = ["delivery_confirmed"];

export interface DhlSyncResult {
  ok: boolean;
  /** False when DHL_API_KEY is unset — not an error, just not configured. */
  configured: boolean;
  /** Open shipments carrying a tracking number. */
  eligible: number;
  /** Of those, the ones this run actually asked DHL about. */
  polled: number;
  /** Tracking numbers DHL had no record of — ordinary, not a fault. */
  notFound: number;
  eventsCreated: number;
  shipmentsUpdated: number;
  /** Set when the run stopped early. */
  stoppedBy?: DhlFailure;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface FetchOutcome {
  shipments: DhlShipment[];
  failure: DhlFailure | null;
}

/**
 * One tracking number, one call.
 *
 * The API accepts a single `trackingNumber` per request — there is no batch
 * form — which is exactly why the budget above exists.
 */
async function fetchTracking(
  trackingNumber: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<FetchOutcome> {
  const url = `${API_BASE}?trackingNumber=${encodeURIComponent(trackingNumber)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "DHL-API-Key": apiKey, Accept: "application/json" },
      signal,
    });
  } catch {
    return { shipments: [], failure: "network" };
  }

  if (!response.ok) return { shipments: [], failure: dhlFailureFor(response.status) };

  try {
    return { shipments: parseDhlResponse(await response.json()), failure: null };
  } catch {
    // A 200 whose body is not the JSON we expect. Treated as unavailable rather
    // than fatal: the next parcel may well be fine.
    return { shipments: [], failure: "unavailable" };
  }
}

/**
 * Poll DHL for every open shipment, oldest-checked first.
 *
 * Idempotent. Events are keyed on (shipmentId, source, externalId) where
 * externalId is the checkpoint's status+timestamp, so re-polling an unchanged
 * parcel writes nothing. `planShipmentUpdate` then decides what the newest
 * checkpoint means for the shipment row — and it, not this module, is what
 * guarantees a stale checkpoint can never un-deliver a parcel.
 */
export async function runDhlTrackingSync(
  options: { now?: Date; signal?: AbortSignal } = {},
): Promise<DhlSyncResult> {
  const now = options.now ?? new Date();
  const apiKey = process.env.DHL_API_KEY?.trim();

  const result: DhlSyncResult = {
    ok: true,
    configured: Boolean(apiKey),
    eligible: 0,
    polled: 0,
    notFound: 0,
    eventsCreated: 0,
    shipmentsUpdated: 0,
  };

  // Not configured is a normal state, not a failure: the email sync still runs
  // and the route should say so plainly rather than 500.
  if (!apiKey) return result;

  try {
    const candidates = await prisma.shipment.findMany({
      where: {
        trackingNumber: { not: null },
        status: { notIn: SETTLED },
        // A delivery we already recorded needs no further polling.
        actualDelivery: null,
      },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        actualDelivery: true,
        estimatedDelivery: true,
        isDelayed: true,
        lastTrackedAt: true,
        courier: true,
      },
      orderBy: { lastTrackedAt: { sort: "asc", nulls: "first" } },
    });

    const due = candidates.filter((shipment) => {
      if (!normalizeTracking(shipment.trackingNumber)) return false;
      if (!shipment.lastTrackedAt) return true;
      return now.getTime() - shipment.lastTrackedAt.getTime() >= COOLDOWN_MS;
    });
    result.eligible = due.length;

    const batch = due.slice(0, MAX_CALLS_PER_RUN);

    for (const [index, shipment] of batch.entries()) {
      // Spacing between calls, not before the first one.
      if (index > 0 && THROTTLE_MS > 0) await sleep(THROTTLE_MS);

      const tracking = shipment.trackingNumber!;
      const { shipments, failure } = await fetchTracking(tracking, apiKey, options.signal);
      result.polled += 1;

      // Record the attempt either way. A number DHL does not recognise must not
      // be retried every run — that is how a typo eats the daily budget.
      await prisma.shipment
        .update({ where: { id: shipment.id }, data: { lastTrackedAt: now } })
        .catch(() => undefined);

      if (failure) {
        if (failure === "not_found") {
          result.notFound += 1;
          continue;
        }
        if (isFatalDhlFailure(failure)) {
          // A bad key or an exhausted quota will not fix itself on the next
          // parcel; stopping preserves what budget remains.
          result.stoppedBy = failure;
          result.ok = failure !== "unauthorized";
          break;
        }
        continue;
      }

      const match =
        shipments.find(
          (candidate) => normalizeTracking(candidate.trackingNumber) === normalizeTracking(tracking),
        ) ?? shipments[0];
      if (!match || match.events.length === 0) continue;

      const created = await fileEvents(shipment.id, match.events);
      result.eventsCreated += created;

      const advanced = await advanceShipment(shipment, match, now);
      if (advanced) result.shipmentsUpdated += 1;
    }

    return result;
  } catch (error) {
    result.ok = false;
    result.error = error instanceof Error ? error.message : "unknown_error";
    return result;
  }
}

/**
 * Write the checkpoints, skipping the ones already on file.
 *
 * `skipDuplicates` does the work here: the unique key is
 * (shipmentId, source, externalId), so a re-poll of an unchanged parcel is a
 * no-op rather than a conflict. Events are filed before any decision is taken
 * about the shipment, so a checkpoint we cannot interpret still becomes
 * history — same order as the email sync.
 */
async function fileEvents(shipmentId: string, events: DhlEvent[]): Promise<number> {
  const rows = events.map((event) => ({
    shipmentId,
    // A checkpoint we have no ladder position for is still worth keeping; it
    // is filed at the parcel's current position rather than inventing one.
    status: shipmentStatusFromCourier(event.status) ?? ("in_transit" as ShipmentStatusName),
    description: event.description,
    location: event.location,
    occurredAt: event.occurredAt,
    source: SOURCE,
    externalId: event.externalId,
    // Only the fields that describe the parcel. DHL's payload also carries the
    // recipient's name and address, which has no business in an event log.
    rawPayload: {
      statusCode: event.statusCode,
      trackingNumber: null as string | null,
      location: event.location,
    },
  }));

  const written = await prisma.shipmentEvent.createMany({ data: rows, skipDuplicates: true });
  return written.count;
}

interface ShipmentRow {
  id: string;
  status: ShipmentStatusName;
  actualDelivery: Date | null;
  estimatedDelivery: Date | null;
  isDelayed: boolean;
}

/** Apply the newest checkpoint to the shipment, under the shared rules. */
async function advanceShipment(
  shipment: ShipmentRow,
  match: DhlShipment,
  now: Date,
): Promise<boolean> {
  // Oldest first, so successive checkpoints are applied in the order they
  // happened and `actualDelivery` is stamped from the delivery event rather
  // than whichever one sorted last.
  const ordered = [...match.events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  const live: ShipmentRow = { ...shipment };
  let changed = false;

  for (const event of ordered) {
    const plan = planShipmentUpdate(
      {
        status: live.status,
        actualDelivery: live.actualDelivery?.toISOString() ?? null,
        estimatedDelivery: live.estimatedDelivery?.toISOString() ?? null,
        isDelayed: live.isDelayed,
      },
      { status: event.status, occurredAt: event.occurredAt.toISOString() },
      now,
    );
    if (!plan) continue;

    if (plan.status) live.status = plan.status;
    if (plan.actualDelivery) live.actualDelivery = new Date(plan.actualDelivery);
    if (plan.isDelayed !== undefined) live.isDelayed = plan.isDelayed;
    changed = true;
  }

  if (!changed) return false;

  await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: live.status,
      actualDelivery: live.actualDelivery,
      isDelayed: live.isDelayed,
    },
  });
  return true;
}
