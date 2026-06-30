import { Prisma } from "@/lib/generated/prisma/client";
import type { SampleRequest as PrismaSampleRequest } from "@/lib/generated/prisma/client";
import type { Address, AttachmentRef, SampleRequest, SampleStatusEvent } from "@/lib/types";

// Prisma row <-> SampleRequest DTO. New transforms vs Company: Decimal<->number
// (quantities), a typed Json array (statusHistory), and FK renames
// (assignedLogisticsUserId<->assignedLogisticsId, accountOwnerUserId<->accountOwnerId).

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export function sampleToDTO(s: PrismaSampleRequest): SampleRequest {
  return {
    id: s.id,
    reference: s.reference,
    companyId: s.companyId,
    contactId: undef(s.contactId),
    opportunityId: undef(s.opportunityId),
    projectId: undef(s.projectId),
    applicationCategory: s.applicationCategory,
    requestedProduct: s.requestedProduct,
    testObjective: undef(s.testObjective),
    requestedQuantity: Number(s.requestedQuantity),
    approvedQuantity: s.approvedQuantity == null ? undefined : Number(s.approvedQuantity),
    unit: s.unit,
    lotBatch: undef(s.lotBatch),
    packagingType: undef(s.packagingType),
    requestDate: s.requestDate.toISOString(),
    approvalDate: s.approvalDate?.toISOString(),
    requestedDeliveryDate: s.requestedDeliveryDate?.toISOString(),
    priority: s.priority,
    assignedLogisticsId: undef(s.assignedLogisticsUserId),
    accountOwnerId: undef(s.accountOwnerUserId),
    internalInstructions: undef(s.internalInstructions),
    clientVisibleNotes: undef(s.clientVisibleNotes),
    customsNotes: undef(s.customsNotes),
    requiredDocuments: s.requiredDocuments,
    attachments: undef(s.attachments as unknown as AttachmentRef[] | null),
    deliveryAddress: undef(s.deliveryAddress as unknown as Address | null),
    recipient: undef(s.recipient),
    recipientPhone: undef(s.recipientPhone),
    recipientEmail: undef(s.recipientEmail),
    status: s.status,
    statusHistory: (s.statusHistory as unknown as SampleStatusEvent[] | null) ?? [],
    // shipmentId is a 1-to-many relation in the schema; not denormalized on read.
    shipmentId: undefined,
    createdAt: s.createdAt.toISOString(),
  };
}

export function sampleWriteData(input: SampleRequest, actorId: string | null) {
  return {
    reference: input.reference,
    companyId: input.companyId,
    contactId: input.contactId ?? null,
    opportunityId: input.opportunityId ?? null,
    projectId: input.projectId ?? null,
    applicationCategory: input.applicationCategory,
    requestedProduct: input.requestedProduct,
    testObjective: input.testObjective ?? null,
    requestedQuantity: input.requestedQuantity,
    approvedQuantity: input.approvedQuantity ?? null,
    unit: input.unit,
    lotBatch: input.lotBatch ?? null,
    packagingType: input.packagingType ?? null,
    requestDate: new Date(input.requestDate),
    approvalDate: input.approvalDate ? new Date(input.approvalDate) : null,
    requestedDeliveryDate: input.requestedDeliveryDate ? new Date(input.requestedDeliveryDate) : null,
    priority: input.priority,
    assignedLogisticsUserId: input.assignedLogisticsId ?? null,
    accountOwnerUserId: input.accountOwnerId ?? null,
    internalInstructions: input.internalInstructions ?? null,
    clientVisibleNotes: input.clientVisibleNotes ?? null,
    customsNotes: input.customsNotes ?? null,
    requiredDocuments: input.requiredDocuments ?? [],
    attachments: input.attachments ? asJson(input.attachments) : undefined,
    deliveryAddress: input.deliveryAddress ? asJson(input.deliveryAddress) : undefined,
    recipient: input.recipient ?? null,
    recipientPhone: input.recipientPhone ?? null,
    recipientEmail: input.recipientEmail ?? null,
    status: input.status,
    statusHistory: asJson(input.statusHistory),
    updatedById: actorId,
  };
}
