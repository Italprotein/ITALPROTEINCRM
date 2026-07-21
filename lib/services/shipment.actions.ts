"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireAction } from "@/lib/backend/session";
import type { Shipment } from "@/lib/types";
import { deriveShipmentStatus } from "@/lib/mock-services/shipmentService";
import { shipmentToDTO, shipmentWriteData } from "./shipment.mapper";

// External users see only their own company's shipments; internal users see all.
// The server is the authority — client-supplied ids are ignored.
async function scopeWhere(): Promise<Prisma.ShipmentWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

function daysBetween(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Number.isFinite(d) ? Math.round(d) : null;
}

// Reads are `requireUser()`, never `requireSection('shipments')`: the portal
// tracks shipments but `shipments` is not a PortalSection, so a section gate
// would silently blank shipment tracking for every external user.
export async function listShipments(): Promise<Shipment[]> {
  await requireUser();
  const rows = await prisma.shipment.findMany({
    where: await scopeWhere(),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(shipmentToDTO);
}

export async function getShipment(id: string): Promise<Shipment | undefined> {
  await requireUser();
  const rows = await prisma.shipment.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    take: 1,
  });
  return rows[0] ? shipmentToDTO(rows[0]) : undefined;
}

// Shipment writes are internal logistics work — the portal only ever reads
// shipments, so `shipment.update` (super_admin, crm_admin, logistics) is safe.
export async function createShipment(input: Shipment): Promise<Shipment> {
  const user = await requireAction("shipment.update");
  const row = await prisma.shipment.create({
    data: {
      ...shipmentWriteData(input, user.id),
      id: input.id,
      createdById: user.id,
    },
  });
  return shipmentToDTO(row);
}

export async function updateShipment(
  id: string,
  patch: Partial<Shipment>,
): Promise<Shipment | undefined> {
  const user = await requireAction("shipment.update");
  const existing = await prisma.shipment.findUnique({ where: { id } });
  if (!existing) return undefined;
  const merged: Shipment = { ...shipmentToDTO(existing), ...patch };
  const row = await prisma.shipment.update({
    where: { id },
    data: shipmentWriteData(merged, user.id),
  });
  return shipmentToDTO(row);
}

export async function removeShipment(id: string): Promise<void> {
  await requireAction("shipment.update");
  await prisma.shipment.delete({ where: { id } }).catch(() => undefined);
}

export async function shipmentsByCompany(companyId: string): Promise<Shipment[]> {
  await requireUser();
  const rows = await prisma.shipment.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(shipmentToDTO);
}

export async function shipmentsBySample(sampleRequestId: string): Promise<Shipment[]> {
  await requireUser();
  const rows = await prisma.shipment.findMany({
    where: { AND: [await scopeWhere(), { sampleRequestId }] },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(shipmentToDTO);
}

export async function shipmentStatistics() {
  await requireUser();
  const rows = await prisma.shipment.findMany({ where: await scopeWhere() });
  const all = rows.map(shipmentToDTO);
  const delivered = all.filter((s) => !!s.actualDelivery);
  const deliveryDays = delivered
    .map((s) => daysBetween(s.shipmentDate, s.actualDelivery))
    .filter((d): d is number => d != null && d >= 0);
  const avgDeliveryDays = deliveryDays.length
    ? Math.round((deliveryDays.reduce((a, b) => a + b, 0) / deliveryDays.length) * 10) / 10
    : 0;
  const onTime = delivered.filter(
    (s) =>
      !s.estimatedDelivery ||
      !s.actualDelivery ||
      new Date(s.actualDelivery) <= new Date(s.estimatedDelivery),
  ).length;
  return {
    total: all.length,
    preparing: all.filter((s) => deriveShipmentStatus(s) === "preparing").length,
    inTransit: all.filter((s) => deriveShipmentStatus(s) === "in_transit").length,
    customs: all.filter((s) => deriveShipmentStatus(s) === "customs").length,
    delivered: delivered.length,
    delayed: all.filter((s) => s.isDelayed && !s.actualDelivery).length,
    avgDeliveryDays,
    onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
  };
}
