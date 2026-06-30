import { Prisma } from "@/lib/generated/prisma/client";
import type { ApplicationProject as PrismaApplicationProject } from "@/lib/generated/prisma/client";
import type { ApplicationProject, AttachmentRef } from "@/lib/types";

// Prisma row <-> ApplicationProject DTO. Transforms: Decimal<->number
// (estimatedAnnualVolume), FK renames (internalOwnerUserId<->internalOwnerId,
// technicalOwnerUserId<->technicalOwnerId), typed Json columns (nextAction,
// attachments), DateTime<->ISO string. sampleRequestId is a 1-to-many relation
// in the schema, so it is not denormalized on read. productId has no DTO field
// and is therefore left untouched on write.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

export function projectToDTO(p: PrismaApplicationProject): ApplicationProject {
  return {
    id: p.id,
    companyId: p.companyId,
    name: p.name,
    clientProjectCode: undef(p.clientProjectCode),
    productName: undef(p.productName),
    brandName: undef(p.brandName),
    category: p.category,
    subcategory: undef(p.subcategory),
    market: undef(p.market),
    objective: undef(p.objective),
    developmentStage: p.developmentStage,
    testStage: undef(p.testStage),
    // sampleRequests is a 1-to-many relation in the schema; not denormalized on read.
    sampleRequestId: undefined,
    lotBatch: undef(p.lotBatch),
    testRounds: undef(p.testRounds),
    currentResult: undef(p.currentResult),
    estimatedLaunch: p.estimatedLaunch?.toISOString(),
    estimatedAnnualVolume: p.estimatedAnnualVolume == null ? undefined : Number(p.estimatedAnnualVolume),
    commercialPotential: undef(p.commercialPotential),
    contactIds: p.contactIds,
    internalOwnerId: undef(p.internalOwnerUserId),
    technicalOwnerId: undef(p.technicalOwnerUserId),
    nextAction: undef(p.nextAction as unknown as ApplicationProject["nextAction"] | null),
    attachments: undef(p.attachments as unknown as AttachmentRef[] | null),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function projectWriteData(input: ApplicationProject, actorId: string | null) {
  return {
    companyId: input.companyId,
    name: input.name,
    clientProjectCode: input.clientProjectCode ?? null,
    productName: input.productName ?? null,
    brandName: input.brandName ?? null,
    category: input.category,
    subcategory: input.subcategory ?? null,
    market: input.market ?? null,
    objective: input.objective ?? null,
    developmentStage: input.developmentStage,
    testStage: input.testStage ?? null,
    lotBatch: input.lotBatch ?? null,
    testRounds: input.testRounds ?? null,
    currentResult: input.currentResult ?? null,
    estimatedLaunch: input.estimatedLaunch ? new Date(input.estimatedLaunch) : null,
    estimatedAnnualVolume: input.estimatedAnnualVolume ?? null,
    commercialPotential: input.commercialPotential ?? null,
    contactIds: input.contactIds ?? [],
    internalOwnerUserId: input.internalOwnerId ?? null,
    technicalOwnerUserId: input.technicalOwnerId ?? null,
    nextAction: input.nextAction ? asJson(input.nextAction) : undefined,
    attachments: input.attachments ? asJson(input.attachments) : undefined,
    updatedById: actorId,
  };
}
