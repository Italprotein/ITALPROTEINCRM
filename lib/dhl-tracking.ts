/**
 * DHL Shipment Tracking (Unified) -> our courier vocabulary. The pure half.
 *
 * This is the second source of truth about where a parcel is; the first is the
 * courier emails DHL sends us (lib/backend/courier-email.ts). Both feed the
 * same decision layer in lib/shipment-tracking.ts, which is why neither knows
 * about the other: an event is an event, whether it arrived by mail or by HTTP.
 *
 * No fetch and no Prisma here, so the response mapping is testable against
 * captured payloads without a network or a database.
 *
 * API: GET https://api-eu.dhl.com/track/shipments?trackingNumber=…
 *      header `DHL-API-Key: <key>`
 */

import type { CourierStatus } from "@/lib/shipment-tracking";

/**
 * The `statusCode` values the Unified API reports.
 *
 * Deliberately a closed list with an `unknown` fallback rather than a
 * pass-through: an unrecognised code must mean "we learned nothing", never
 * "invent a state".
 */
export type DhlStatusCode = "pre-transit" | "transit" | "delivered" | "failure" | "unknown";

/**
 * DHL's vocabulary -> ours.
 *
 * `pre-transit` is the one worth naming: it means the label exists but DHL has
 * not taken the parcel yet. That is `preparing` on our ladder, one step above
 * `pending`, so it advances a freshly-created shipment without ever claiming
 * the parcel is moving.
 */
export function dhlStatusToCourier(code: string | null | undefined): CourierStatus {
  switch ((code ?? "").trim().toLowerCase()) {
    case "delivered":
      return "delivered";
    case "transit":
      return "in_transit";
    case "pre-transit":
      return "pre_transit";
    case "failure":
      return "exception";
    default:
      return "unknown";
  }
}

/**
 * DHL timestamps carry no timezone: `"2026-08-20T10:15:00"` is local to
 * wherever the checkpoint happened, and the offset is simply not in the
 * payload. There is no way to recover the true instant from that.
 *
 * So it is read as UTC, explicitly. The alternative — handing the bare string
 * to `new Date()` — resolves against the *server's* timezone, which means the
 * same payload would produce different delivery times on a laptop and in the
 * container. A predictable couple of hours of drift beats a value that depends
 * on where the code runs.
 *
 * A timestamp that does carry an offset (or a `Z`) is honoured as written.
 */
export function parseDhlTimestamp(value: string | null | undefined): Date | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const date = new Date(zoned ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface DhlEvent {
  status: CourierStatus;
  occurredAt: Date;
  description: string | null;
  location: string | null;
  /**
   * Stable identity for this checkpoint.
   *
   * DHL gives events no id of their own, so one is synthesised from the pair
   * that does identify a checkpoint: its status and its timestamp. It has to be
   * deterministic, because it is the key that stops a re-poll from filing the
   * same checkpoint twice.
   */
  externalId: string;
  /** The raw DHL code, kept for the stored payload. */
  statusCode: string | null;
}

export interface DhlShipment {
  trackingNumber: string;
  service: string | null;
  /** Newest first. */
  events: DhlEvent[];
  /** The single most advanced state DHL reports for this parcel. */
  latest: DhlEvent | null;
}

/** Narrow unknown JSON without pulling in a schema library. */
const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** `location.address.addressLocality`, flattened, when any of it is present. */
function locationOf(node: Record<string, unknown> | null): string | null {
  const address = asRecord(asRecord(node?.location)?.address);
  return asString(address?.addressLocality) ?? asString(address?.countryCode);
}

function toEvent(node: unknown): DhlEvent | null {
  const record = asRecord(node);
  if (!record) return null;
  const occurredAt = parseDhlTimestamp(asString(record.timestamp));
  // A checkpoint with no usable time cannot be ordered, deduplicated, or used
  // as a delivery date. Dropping it is better than dating it "now".
  if (!occurredAt) return null;

  const statusCode = asString(record.statusCode);
  const status = dhlStatusToCourier(statusCode);
  return {
    status,
    occurredAt,
    description: asString(record.description) ?? asString(record.status),
    location: locationOf(record),
    externalId: `${statusCode ?? "unknown"}:${occurredAt.toISOString()}`,
    statusCode,
  };
}

/**
 * Read a `/track/shipments` response.
 *
 * Tolerant by design: DHL omits fields freely between services (express vs
 * parcel-de vs freight), and a missing `events` array with a populated `status`
 * is a normal response, not an error. Anything unreadable yields an empty list
 * rather than throwing, so one odd parcel cannot fail a whole sync run.
 */
export function parseDhlResponse(payload: unknown): DhlShipment[] {
  const root = asRecord(payload);
  const shipments = root?.shipments;
  if (!Array.isArray(shipments)) return [];

  const out: DhlShipment[] = [];
  for (const entry of shipments) {
    const record = asRecord(entry);
    if (!record) continue;

    const trackingNumber = asString(record.id);
    if (!trackingNumber) continue;

    const rawEvents = Array.isArray(record.events) ? record.events : [];
    const events = rawEvents
      .map(toEvent)
      .filter((event): event is DhlEvent => event !== null);

    // Some services return only the summary `status` block. Treat it as the
    // one checkpoint we have rather than reporting nothing.
    if (events.length === 0) {
      const summary = toEvent(record.status);
      if (summary) events.push(summary);
    }

    events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    out.push({
      trackingNumber,
      service: asString(record.service),
      events,
      latest: events[0] ?? null,
    });
  }
  return out;
}

/* ────────────────────────────── Errors ────────────────────────────── */

export type DhlFailure =
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "unavailable"
  | "bad_request"
  | "network";

/**
 * What an HTTP status from DHL means for the caller.
 *
 * The distinction that matters is `not_found` versus the rest: a tracking
 * number DHL has never heard of is an ordinary outcome (a typo, or a label not
 * yet scanned), and must not look like an outage. `rate_limited` is the one
 * that has to stop the run — continuing would burn the daily quota on 429s.
 */
export function dhlFailureFor(httpStatus: number): DhlFailure {
  if (httpStatus === 401 || httpStatus === 403) return "unauthorized";
  if (httpStatus === 404) return "not_found";
  if (httpStatus === 429) return "rate_limited";
  if (httpStatus === 400) return "bad_request";
  return "unavailable";
}

/** A failure that means: stop this run, do not try the next parcel. */
export function isFatalDhlFailure(failure: DhlFailure): boolean {
  return failure === "unauthorized" || failure === "rate_limited";
}
