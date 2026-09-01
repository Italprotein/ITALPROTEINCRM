/**
 * Courier email -> shipment timeline. The implementation half.
 *
 * The pieces for this existed separately for months: `courier-email.ts` could
 * read a delivery state out of a DHL/BRT/Poste message, `ShipmentEvent` had
 * columns waiting for one, and `/api/shipments/courier-updates` parsed the mail
 * on every page load — and then returned it as JSON and dropped it. Nothing
 * wrote anything down, so `actualDelivery` only ever got set by hand and the
 * delivery KPIs on Analisi & Report read 0.
 *
 * This module joins them: match parsed updates to shipments by tracking number,
 * file each one as a ShipmentEvent, and let lib/shipment-tracking.ts decide
 * what that means for the shipment row.
 *
 * Deliberately NOT "use server" — every export in such a file becomes a public
 * POST endpoint. The guarded entry point is
 * app/api/shipments/sync-tracking/route.ts.
 */
import { prisma } from "@/lib/backend/prisma";
import { parseCourierEmail, type CourierUpdate } from "@/lib/backend/courier-email";
import {
  normalizeTracking,
  planShipmentUpdate,
  shipmentStatusFromCourier,
  isDelayedNow,
  type ShipmentStatusName,
} from "@/lib/shipment-tracking";

/** Where these events come from. Stored on the row so a future carrier-API
 *  source can share the same timeline without the two being confused. */
const SOURCE = "gmail";

/** How many courier emails one run reads. The mailbox is re-read every run, so
 *  this is a recency window rather than a queue — matching the GET route. */
const MESSAGE_LIMIT = 1000;

export interface TrackingSyncResult {
  ok: boolean;
  /** Courier-looking emails scanned. */
  scanned: number;
  /** Of those, ones a tracking number and state could be read from. */
  parsed: number;
  /** Parsed updates whose tracking number matched exactly one shipment. */
  matched: number;
  /** Parsed updates with no shipment (or an ambiguous one) — normal, not an error. */
  unmatched: number;
  /** New ShipmentEvent rows written this run. */
  eventsCreated: number;
  /** Shipments whose own status/dates changed as a result. */
  shipmentsUpdated: number;
  /** Open shipments newly flagged late by the estimate having passed. */
  delayedFlagged: number;
  error?: string;
}

/** The courier senders the mailbox is filtered on — same list as the GET route. */
const COURIER_SENDERS = ["dhl", "brt", "poste", "sda"];

/**
 * Reads the courier mail, files events, and advances the shipments they
 * describe. Idempotent: events are upserted on (shipmentId, source, externalId)
 * where externalId is the Gmail message id, so re-running writes nothing new.
 */
export async function runShipmentTrackingSync(now: Date = new Date()): Promise<TrackingSyncResult> {
  const result: TrackingSyncResult = {
    ok: true,
    scanned: 0,
    parsed: 0,
    matched: 0,
    unmatched: 0,
    eventsCreated: 0,
    shipmentsUpdated: 0,
    delayedFlagged: 0,
  };

  try {
    const messages = await prisma.emailMessage.findMany({
      where: {
        OR: COURIER_SENDERS.map((sender) => ({
          fromAddress: { contains: sender, mode: "insensitive" as const },
        })),
      },
      orderBy: { internalDate: "desc" },
      take: MESSAGE_LIMIT,
      select: {
        gmailMessageId: true,
        fromAddress: true,
        subject: true,
        bodyText: true,
        snippet: true,
        internalDate: true,
      },
    });
    result.scanned = messages.length;

    const updates = messages
      .map((message) =>
        parseCourierEmail({
          from: message.fromAddress,
          subject: message.subject ?? "",
          body: message.bodyText ?? message.snippet ?? "",
          occurredAt: message.internalDate,
          messageId: message.gmailMessageId,
        }),
      )
      .filter((update): update is CourierUpdate => Boolean(update));
    result.parsed = updates.length;

    // Index shipments by normalized tracking number. A number claimed by more
    // than one shipment is dropped rather than guessed at — the same discipline
    // the email/company reconciliation uses for ambiguous matches.
    const shipments = await prisma.shipment.findMany({
      where: { trackingNumber: { not: null } },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        actualDelivery: true,
        estimatedDelivery: true,
        isDelayed: true,
      },
    });
    const byTracking = new Map<string, (typeof shipments)[number] | null>();
    for (const shipment of shipments) {
      const key = normalizeTracking(shipment.trackingNumber);
      if (!key) continue;
      // null marks "ambiguous" so a later lookup can tell it from "absent".
      byTracking.set(key, byTracking.has(key) ? null : shipment);
    }

    // Oldest first, so a shipment that gets several updates in one run walks
    // its ladder in the order the courier actually reported them.
    const ordered = [...updates].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

    // The shipment row is advanced in memory as its events are applied, so the
    // second update of a run sees the state the first one produced.
    const live = new Map<string, (typeof shipments)[number]>();
    const touched = new Set<string>();

    for (const update of ordered) {
      const match = byTracking.get(normalizeTracking(update.trackingNumber));
      if (!match) {
        result.unmatched += 1;
        continue;
      }
      result.matched += 1;
      const current = live.get(match.id) ?? match;

      // File the event first: even an update that changes nothing about the
      // shipment (a duplicate notice, an unreadable state) is worth keeping as
      // history, and the unique key makes a re-run a no-op.
      const eventStatus =
        shipmentStatusFromCourier(update.status) ?? (current.status as ShipmentStatusName);
      const existing = await prisma.shipmentEvent.findFirst({
        where: { shipmentId: match.id, source: SOURCE, externalId: update.messageId },
        select: { id: true },
      });
      if (!existing) {
        await prisma.shipmentEvent.create({
          data: {
            shipmentId: match.id,
            status: eventStatus,
            description: update.subject,
            occurredAt: new Date(update.occurredAt),
            source: SOURCE,
            externalId: update.messageId,
            // The carrier, the state read, and the message it came from — enough
            // to audit a wrong reading later. Deliberately NOT the email body:
            // courier mail carries recipient names and addresses.
            rawPayload: {
              carrier: update.carrier,
              courierStatus: update.status,
              trackingNumber: update.trackingNumber,
              gmailMessageId: update.messageId,
            },
          },
        });
        result.eventsCreated += 1;
      }

      const plan = planShipmentUpdate(
        {
          status: current.status as ShipmentStatusName,
          actualDelivery: current.actualDelivery?.toISOString(),
          estimatedDelivery: current.estimatedDelivery?.toISOString(),
          isDelayed: current.isDelayed,
        },
        { status: update.status, occurredAt: update.occurredAt },
        now,
      );
      if (!plan) continue;

      await prisma.shipment.update({
        where: { id: match.id },
        data: {
          ...(plan.status ? { status: plan.status } : {}),
          ...(plan.actualDelivery ? { actualDelivery: new Date(plan.actualDelivery) } : {}),
          ...(plan.isDelayed === undefined ? {} : { isDelayed: plan.isDelayed }),
        },
      });
      touched.add(match.id);
      live.set(match.id, {
        ...current,
        status: plan.status ?? current.status,
        actualDelivery: plan.actualDelivery ? new Date(plan.actualDelivery) : current.actualDelivery,
        isDelayed: plan.isDelayed ?? current.isDelayed,
      });
    }
    result.shipmentsUpdated = touched.size;

    // Lateness is a fact about the calendar, not about the mail: a shipment
    // nobody emailed about still goes late when its estimate passes. Sweep every
    // undelivered shipment, not only the ones touched above.
    const open = await prisma.shipment.findMany({
      where: { actualDelivery: null, estimatedDelivery: { not: null } },
      select: { id: true, estimatedDelivery: true, isDelayed: true },
    });
    for (const shipment of open) {
      const delayed = isDelayedNow(
        { estimatedDelivery: shipment.estimatedDelivery?.toISOString() },
        now,
      );
      if (delayed === shipment.isDelayed) continue;
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { isDelayed: delayed },
      });
      if (delayed) result.delayedFlagged += 1;
    }

    return result;
  } catch (error) {
    return {
      ...result,
      ok: false,
      error: error instanceof Error ? error.message : "unknown_error",
    };
  }
}
