import { describe, expect, it } from 'vitest';

import {
  dhlFailureFor,
  dhlStatusToCourier,
  isFatalDhlFailure,
  parseDhlResponse,
  parseDhlTimestamp,
} from '@/lib/dhl-tracking';
import { planShipmentUpdate, shipmentStatusFromCourier } from '@/lib/shipment-tracking';

/** A /track/shipments response in the shape the Unified API returns. */
const RESPONSE = {
  shipments: [
    {
      id: '7447068333',
      service: 'express',
      status: {
        timestamp: '2026-08-22T09:41:00',
        statusCode: 'delivered',
        status: 'DELIVERED',
        description: 'Delivered',
        location: { address: { addressLocality: 'MELBOURNE - AUSTRALIA', countryCode: 'AU' } },
      },
      events: [
        {
          timestamp: '2026-08-20T08:02:00',
          statusCode: 'pre-transit',
          description: 'Shipment information received',
          location: { address: { addressLocality: 'MILAN - ITALY' } },
        },
        {
          timestamp: '2026-08-21T14:30:00',
          statusCode: 'transit',
          description: 'Processed at MILAN - ITALY',
          location: { address: { addressLocality: 'MILAN - ITALY' } },
        },
        {
          timestamp: '2026-08-22T09:41:00',
          statusCode: 'delivered',
          description: 'Delivered - Signed for by: R BURSTON',
          location: { address: { addressLocality: 'MELBOURNE - AUSTRALIA' } },
        },
      ],
    },
  ],
};

describe('dhlStatusToCourier', () => {
  it('maps DHL vocabulary onto ours', () => {
    expect(dhlStatusToCourier('delivered')).toBe('delivered');
    expect(dhlStatusToCourier('transit')).toBe('in_transit');
    expect(dhlStatusToCourier('pre-transit')).toBe('pre_transit');
    expect(dhlStatusToCourier('failure')).toBe('exception');
  });

  it('refuses to invent a state from a code it does not know', () => {
    expect(dhlStatusToCourier('teleported')).toBe('unknown');
    expect(dhlStatusToCourier(null)).toBe('unknown');
    expect(dhlStatusToCourier('')).toBe('unknown');
    // …and an unknown state changes nothing downstream.
    expect(shipmentStatusFromCourier('unknown')).toBeNull();
  });

  it('lands pre-transit one rung above pending, not in transit', () => {
    // A label exists; the parcel has not moved. Claiming "in transit" here
    // would be a lie the forward-only ladder could never take back.
    expect(shipmentStatusFromCourier('pre_transit')).toBe('preparing');
  });
});

describe('parseDhlTimestamp', () => {
  it('reads a zoneless timestamp as UTC rather than as server-local time', () => {
    // The property that matters: the same payload must produce the same
    // instant on a laptop in Rome and in a UTC container.
    expect(parseDhlTimestamp('2026-08-22T09:41:00')?.toISOString()).toBe(
      '2026-08-22T09:41:00.000Z',
    );
  });

  it('honours an offset when DHL sends one', () => {
    expect(parseDhlTimestamp('2026-08-22T09:41:00+02:00')?.toISOString()).toBe(
      '2026-08-22T07:41:00.000Z',
    );
    expect(parseDhlTimestamp('2026-08-22T09:41:00Z')?.toISOString()).toBe(
      '2026-08-22T09:41:00.000Z',
    );
  });

  it('returns null for junk instead of an Invalid Date', () => {
    expect(parseDhlTimestamp('not a time')).toBeNull();
    expect(parseDhlTimestamp(null)).toBeNull();
    expect(parseDhlTimestamp('')).toBeNull();
  });
});

describe('parseDhlResponse', () => {
  it('reads the checkpoints, newest first', () => {
    const [shipment] = parseDhlResponse(RESPONSE);
    expect(shipment.trackingNumber).toBe('7447068333');
    expect(shipment.service).toBe('express');
    expect(shipment.events).toHaveLength(3);
    expect(shipment.events.map((e) => e.status)).toEqual([
      'delivered',
      'in_transit',
      'pre_transit',
    ]);
    expect(shipment.latest?.status).toBe('delivered');
    expect(shipment.latest?.location).toBe('MELBOURNE - AUSTRALIA');
    expect(shipment.latest?.description).toContain('Signed for by');
  });

  it('gives every checkpoint an id that is stable across polls', () => {
    // This is what stops an unchanged parcel filing duplicate events every
    // four hours: the id is derived, not generated.
    const first = parseDhlResponse(RESPONSE)[0].events.map((e) => e.externalId);
    const second = parseDhlResponse(RESPONSE)[0].events.map((e) => e.externalId);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(3);
    expect(first[0]).toBe('delivered:2026-08-22T09:41:00.000Z');
  });

  it('falls back to the summary block when a service returns no events array', () => {
    const [shipment] = parseDhlResponse({
      shipments: [{ id: 'X1', status: { timestamp: '2026-08-22T09:41:00', statusCode: 'transit' } }],
    });
    expect(shipment.events).toHaveLength(1);
    expect(shipment.latest?.status).toBe('in_transit');
  });

  it('drops a checkpoint with no usable time rather than dating it now', () => {
    const [shipment] = parseDhlResponse({
      shipments: [
        {
          id: 'X2',
          events: [
            { statusCode: 'transit', description: 'no timestamp' },
            { timestamp: '2026-08-22T09:41:00', statusCode: 'delivered' },
          ],
        },
      ],
    });
    expect(shipment.events).toHaveLength(1);
    expect(shipment.events[0].status).toBe('delivered');
  });

  it('returns nothing for shapes it does not recognise, instead of throwing', () => {
    // One malformed parcel must not be able to fail a whole sync run.
    expect(parseDhlResponse(null)).toEqual([]);
    expect(parseDhlResponse({})).toEqual([]);
    expect(parseDhlResponse({ shipments: 'nope' })).toEqual([]);
    expect(parseDhlResponse({ shipments: [{ noId: true }] })).toEqual([]);
    expect(parseDhlResponse({ status: 404, title: 'No shipments found' })).toEqual([]);
  });
});

describe('failure classification', () => {
  it('treats an unknown tracking number as ordinary, not as an outage', () => {
    expect(dhlFailureFor(404)).toBe('not_found');
    expect(isFatalDhlFailure('not_found')).toBe(false);
  });

  it('stops the run on a bad key or an exhausted quota', () => {
    // Continuing would spend the remaining budget on guaranteed failures.
    expect(dhlFailureFor(401)).toBe('unauthorized');
    expect(dhlFailureFor(403)).toBe('unauthorized');
    expect(dhlFailureFor(429)).toBe('rate_limited');
    expect(isFatalDhlFailure('unauthorized')).toBe(true);
    expect(isFatalDhlFailure('rate_limited')).toBe(true);
  });

  it('keeps going through a transient server fault', () => {
    expect(dhlFailureFor(503)).toBe('unavailable');
    expect(isFatalDhlFailure('unavailable')).toBe(false);
  });
});

describe('DHL checkpoints through the shared decision layer', () => {
  const now = new Date('2026-08-25T00:00:00.000Z');

  it('walks a parcel from label to delivery, stamping the delivery date', () => {
    const events = parseDhlResponse(RESPONSE)[0].events.slice().reverse();
    let state = { status: 'pending' as const, actualDelivery: null as string | null };
    const seen: string[] = [];

    for (const event of events) {
      const plan = planShipmentUpdate(
        { status: state.status, actualDelivery: state.actualDelivery },
        { status: event.status, occurredAt: event.occurredAt.toISOString() },
        now,
      );
      if (plan?.status) state = { ...state, status: plan.status as typeof state.status };
      if (plan?.actualDelivery) state = { ...state, actualDelivery: plan.actualDelivery };
      if (plan?.status) seen.push(plan.status);
    }

    expect(seen).toEqual(['preparing', 'in_transit', 'delivered']);
    // Stamped from the checkpoint's own time, not from the clock.
    expect(state.actualDelivery).toBe('2026-08-22T09:41:00.000Z');
  });

  it('cannot un-deliver a parcel when DHL replays an older checkpoint', () => {
    const plan = planShipmentUpdate(
      { status: 'delivered', actualDelivery: '2026-08-22T09:41:00.000Z' },
      { status: 'in_transit', occurredAt: '2026-08-21T14:30:00.000Z' },
      now,
    );
    expect(plan?.status).toBeUndefined();
    expect(plan?.actualDelivery).toBeUndefined();
  });

  it('leaves a customer-confirmed delivery entirely alone', () => {
    expect(
      planShipmentUpdate(
        { status: 'delivery_confirmed', actualDelivery: '2026-08-22T09:41:00.000Z' },
        { status: 'exception', occurredAt: '2026-08-24T00:00:00.000Z' },
        now,
      ),
    ).toBeNull();
  });
});
