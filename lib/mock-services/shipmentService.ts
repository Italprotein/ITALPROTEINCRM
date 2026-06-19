import type { Shipment } from '@/lib/types';
import { SHIPMENTS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<Shipment>('shipments', SHIPMENTS);

const NOW = new Date('2026-06-17T12:00:00Z');

/** Shipments have no stored status enum — derive a display status from dates/customs. */
export type DerivedShipmentStatus = 'preparing' | 'in_transit' | 'customs' | 'delivered';

export function deriveShipmentStatus(s: Shipment): DerivedShipmentStatus {
  if (s.actualDelivery) return 'delivered';
  if (s.customsStatus === 'hold' || s.customsStatus === 'in_clearance') return 'customs';
  if (s.shipmentDate) return 'in_transit';
  return 'preparing';
}

function daysBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Number.isFinite(d) ? Math.round(d) : null;
}

export const shipmentService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  getById: (id: string) => repo.get(id),
  create: (s: Shipment) => repo.create(s),
  update: (id: string, patch: Partial<Shipment>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  deriveStatus: deriveShipmentStatus,

  async byCompany(companyId: string): Promise<Shipment[]> {
    return (await repo.list()).filter((s) => s.companyId === companyId);
  },
  async bySample(sampleRequestId: string): Promise<Shipment[]> {
    return (await repo.list()).filter((s) => s.sampleRequestId === sampleRequestId);
  },
  async getStatistics() {
    const all = await repo.list();
    const delivered = all.filter((s) => !!s.actualDelivery);
    const deliveryDays = delivered
      .map((s) => daysBetween(s.shipmentDate, s.actualDelivery))
      .filter((d): d is number => d != null && d >= 0);
    const avgDeliveryDays = deliveryDays.length
      ? Math.round((deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length) * 10) / 10
      : 0;
    const onTime = delivered.filter((s) => !s.estimatedDelivery || !s.actualDelivery || new Date(s.actualDelivery) <= new Date(s.estimatedDelivery)).length;
    return {
      total: all.length,
      preparing: all.filter((s) => deriveShipmentStatus(s) === 'preparing').length,
      inTransit: all.filter((s) => deriveShipmentStatus(s) === 'in_transit').length,
      customs: all.filter((s) => deriveShipmentStatus(s) === 'customs').length,
      delivered: delivered.length,
      delayed: all.filter((s) => s.isDelayed && !s.actualDelivery).length,
      avgDeliveryDays,
      onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
    };
  },
  _now: NOW,
};

export type ShipmentService = typeof shipmentService;
