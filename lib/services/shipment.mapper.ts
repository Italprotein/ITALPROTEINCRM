import { Prisma } from "@/lib/generated/prisma/client";
import type { Shipment as PrismaShipment } from "@/lib/generated/prisma/client";
import type { Address, AttachmentRef, Shipment } from "@/lib/types";

// Prisma row <-> Shipment DTO. Transforms: Decimal<->number (weightKg),
// Int<->number (shippingCost — a plain integer cost column, NOT *Minor), Json
// columns <-> typed objects/arrays, DateTime <-> ISO string. The Prisma model
// carries extra columns (status, isExtraEU, lineItems, etc.) that the DTO does
// not expose; those are preserved on write where the DTO supplies no value.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export function shipmentToDTO(s: PrismaShipment): Shipment {
  return {
    id: s.id,
    reference: s.reference,
    sampleRequestId: s.sampleRequestId,
    companyId: s.companyId,
    senderLocation: s.senderLocation,
    recipient: s.recipient,
    address: s.address as unknown as Address,
    phone: undef(s.phone),
    email: undef(s.email),
    courier: undef(s.courier),
    service: undef(s.service),
    trackingNumber: undef(s.trackingNumber),
    trackingUrl: undef(s.trackingUrl),
    shipmentDate: s.shipmentDate?.toISOString(),
    estimatedDelivery: s.estimatedDelivery?.toISOString(),
    actualDelivery: s.actualDelivery?.toISOString(),
    packageCount: undef(s.packageCount),
    weightKg: s.weightKg == null ? undefined : Number(s.weightKg),
    dimensions: undef(s.dimensions),
    shippingCost: undef(s.shippingCost),
    currency: s.currency,
    customsStatus: undef(s.customsStatus),
    incoterm: undef(s.incoterm),
    eoriImportInfo: undef(s.eoriImportInfo),
    customsDocuments: undef(s.customsDocuments as unknown as AttachmentRef[] | null),
    proofOfDelivery: undef(s.proofOfDelivery as unknown as AttachmentRef | null),
    deliveryIssue: undef(s.deliveryIssue),
    isDelayed: s.isDelayed,
    internalNotes: undef(s.internalNotes),
    clientVisibleNotes: undef(s.clientVisibleNotes),
    createdAt: s.createdAt.toISOString(),
  };
}

export function shipmentWriteData(input: Shipment, actorId: string | null) {
  return {
    reference: input.reference,
    sampleRequestId: input.sampleRequestId,
    companyId: input.companyId,
    senderLocation: input.senderLocation,
    recipient: input.recipient,
    address: asJson(input.address),
    phone: input.phone ?? null,
    email: input.email ?? null,
    courier: input.courier ?? null,
    service: input.service ?? null,
    trackingNumber: input.trackingNumber ?? null,
    trackingUrl: input.trackingUrl ?? null,
    shipmentDate: input.shipmentDate ? new Date(input.shipmentDate) : null,
    estimatedDelivery: input.estimatedDelivery ? new Date(input.estimatedDelivery) : null,
    actualDelivery: input.actualDelivery ? new Date(input.actualDelivery) : null,
    packageCount: input.packageCount ?? null,
    weightKg: input.weightKg ?? null,
    dimensions: input.dimensions ?? null,
    shippingCost: input.shippingCost == null ? null : Math.round(input.shippingCost),
    currency: input.currency ?? "EUR",
    customsStatus: input.customsStatus ?? null,
    incoterm: input.incoterm ?? null,
    eoriImportInfo: input.eoriImportInfo ?? null,
    customsDocuments: input.customsDocuments ? asJson(input.customsDocuments) : undefined,
    proofOfDelivery: input.proofOfDelivery ? asJson(input.proofOfDelivery) : undefined,
    deliveryIssue: input.deliveryIssue ?? null,
    isDelayed: input.isDelayed ?? false,
    internalNotes: input.internalNotes ?? null,
    clientVisibleNotes: input.clientVisibleNotes ?? null,
    updatedById: actorId,
  };
}
