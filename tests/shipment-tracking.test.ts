import { describe, it, expect } from 'vitest';

import {
  isDelayedNow,
  normalizeTracking,
  planShipmentUpdate,
  shipmentStatusFromCourier,
} from '@/lib/shipment-tracking';

const NOW = new Date('2026-08-31T12:00:00Z');

describe('normalizeTracking', () => {
  it('ignores the punctuation and case couriers vary between', () => {
    expect(normalizeTracking('1234-5678 90')).toBe('1234567890');
    expect(normalizeTracking(' jd014600003 ')).toBe('JD014600003');
    expect(normalizeTracking('0 1234.5678.9012')).toBe('0123456789012');
  });

  it('returns empty for nothing usable, so it can never match by accident', () => {
    expect(normalizeTracking(null)).toBe('');
    expect(normalizeTracking('  ')).toBe('');
    expect(normalizeTracking('---')).toBe('');
  });
});

describe('shipmentStatusFromCourier', () => {
  it('maps courier vocabulary onto the ShipmentStatus enum', () => {
    expect(shipmentStatusFromCourier('in_transit')).toBe('in_transit');
    expect(shipmentStatusFromCourier('out_for_delivery')).toBe('in_transit');
    expect(shipmentStatusFromCourier('delivered')).toBe('delivered');
    expect(shipmentStatusFromCourier('exception')).toBe('exception');
  });

  it('has no opinion when the email was unreadable', () => {
    expect(shipmentStatusFromCourier('unknown')).toBeNull();
  });
});

describe('isDelayedNow', () => {
  it('is delayed once the estimate has passed with nothing delivered', () => {
    expect(isDelayedNow({ estimatedDelivery: '2026-08-20T00:00:00Z' }, NOW)).toBe(true);
  });
  it('is not delayed when it arrived, however late', () => {
    expect(
      isDelayedNow(
        { estimatedDelivery: '2026-08-20T00:00:00Z', actualDelivery: '2026-08-29T00:00:00Z' },
        NOW,
      ),
    ).toBe(false);
  });
  it('is not delayed before the estimate, or with no estimate at all', () => {
    expect(isDelayedNow({ estimatedDelivery: '2026-09-10T00:00:00Z' }, NOW)).toBe(false);
    expect(isDelayedNow({}, NOW)).toBe(false);
  });
});

describe('planShipmentUpdate', () => {
  const occurredAt = '2026-08-30T09:00:00Z';

  it('moves a preparing shipment into transit', () => {
    const plan = planShipmentUpdate(
      { status: 'preparing' },
      { status: 'in_transit', occurredAt },
      NOW,
    );
    expect(plan).toMatchObject({ status: 'in_transit' });
  });

  it('stamps actualDelivery from the email, not from the clock', () => {
    const plan = planShipmentUpdate(
      { status: 'in_transit' },
      { status: 'delivered', occurredAt },
      NOW,
    );
    expect(plan).toMatchObject({ status: 'delivered', actualDelivery: occurredAt });
  });

  it('never re-stamps a delivery date that is already recorded', () => {
    const plan = planShipmentUpdate(
      { status: 'delivered', actualDelivery: '2026-08-25T00:00:00Z' },
      { status: 'delivered', occurredAt },
      NOW,
    );
    expect(plan?.actualDelivery).toBeUndefined();
  });

  /* The regression that matters most: courier mail arrives out of order, and a
   * stale "in transit" notice must never walk a delivered shipment backwards. */
  it('refuses to move a delivered shipment back into transit', () => {
    const plan = planShipmentUpdate(
      { status: 'delivered', actualDelivery: '2026-08-25T00:00:00Z' },
      { status: 'in_transit', occurredAt },
      NOW,
    );
    expect(plan?.status).toBeUndefined();
  });

  it('leaves a customer-confirmed delivery entirely alone', () => {
    const plan = planShipmentUpdate(
      { status: 'delivery_confirmed', actualDelivery: '2026-08-25T00:00:00Z' },
      { status: 'exception', occurredAt },
      NOW,
    );
    expect(plan).toBeNull();
  });

  it('records an exception on a shipment still in flight', () => {
    const plan = planShipmentUpdate(
      { status: 'in_transit' },
      { status: 'exception', occurredAt },
      NOW,
    );
    expect(plan).toMatchObject({ status: 'exception' });
  });

  it('does not raise an exception over a shipment that already arrived', () => {
    const plan = planShipmentUpdate(
      { status: 'delivered', actualDelivery: '2026-08-25T00:00:00Z' },
      { status: 'exception', occurredAt },
      NOW,
    );
    expect(plan?.status).toBeUndefined();
  });

  it('flags a shipment whose estimate has passed', () => {
    const plan = planShipmentUpdate(
      { status: 'in_transit', estimatedDelivery: '2026-08-20T00:00:00Z' },
      { status: 'in_transit', occurredAt },
      NOW,
    );
    expect(plan).toMatchObject({ isDelayed: true });
  });

  it('clears the delay flag when the delivery finally lands', () => {
    const plan = planShipmentUpdate(
      { status: 'in_transit', estimatedDelivery: '2026-08-20T00:00:00Z', isDelayed: true },
      { status: 'delivered', occurredAt },
      NOW,
    );
    expect(plan).toMatchObject({ status: 'delivered', isDelayed: false });
  });

  it('returns null when the email tells us nothing new', () => {
    expect(
      planShipmentUpdate({ status: 'in_transit' }, { status: 'in_transit', occurredAt }, NOW),
    ).toBeNull();
    expect(
      planShipmentUpdate({ status: 'in_transit' }, { status: 'unknown', occurredAt }, NOW),
    ).toBeNull();
  });
});
