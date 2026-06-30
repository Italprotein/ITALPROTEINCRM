import { Prisma } from "@/lib/generated/prisma/client";
import type {
  Opportunity as PrismaOpportunity,
  OpportunityStageHistory as PrismaStageHistory,
} from "@/lib/generated/prisma/client";
import type { Currency, Opportunity, PipelineStage, StageHistoryEntry } from "@/lib/types";

// Prisma row <-> Opportunity DTO. Transforms: expectedValueMinor (Int) <->
// expectedValue (currency units), ownerUserId<->ownerId rename, nextAction Json
// <-> typed object, and the stageHistory RELATION (OpportunityStageHistory rows)
// <-> StageHistoryEntry[]. stageHistory is a 1-to-many relation, not a Json
// column, so it is mapped from/to the included rows in the actions layer.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

type OpportunityRow = PrismaOpportunity & { stageHistory?: PrismaStageHistory[] };

/** Prisma row (with stageHistory relation) -> Opportunity DTO. */
export function opportunityToDTO(o: OpportunityRow): Opportunity {
  const history = (o.stageHistory ?? [])
    .slice()
    .sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime())
    .map(stageHistoryToDTO);
  return {
    id: o.id,
    companyId: o.companyId,
    title: o.title,
    stage: o.stage as PipelineStage,
    expectedValue: o.expectedValueMinor == null ? undefined : o.expectedValueMinor / 100,
    currency: o.currency as Currency,
    probability: undef(o.probability),
    expectedCloseDate: o.expectedCloseDate?.toISOString(),
    nextAction: undef(o.nextAction as unknown as Opportunity["nextAction"] | null),
    ownerId: o.ownerUserId,
    applicationCategory: undef(o.applicationCategory) as Opportunity["applicationCategory"],
    productInterest: undef(o.productInterest),
    lossReason: undef(o.lossReason),
    competitorNotes: undef(o.competitorNotes),
    stageHistory: history,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

function stageHistoryToDTO(h: PrismaStageHistory): StageHistoryEntry {
  return {
    stage: h.stage as PipelineStage,
    enteredAt: h.enteredAt.toISOString(),
    byUserId: undef(h.byUserId),
    note: undef(h.note),
  };
}

/**
 * Opportunity DTO -> Prisma scalar write payload (shared by create and update).
 * Excludes the stageHistory relation, which the actions layer rewrites via a
 * nested deleteMany/create on update.
 */
export function opportunityWriteData(input: Opportunity, actorId: string | null) {
  return {
    companyId: input.companyId,
    title: input.title,
    stage: input.stage,
    expectedValueMinor:
      input.expectedValue == null ? null : Math.round(input.expectedValue * 100),
    currency: input.currency,
    probability: input.probability ?? null,
    expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
    nextAction: input.nextAction ? asJson(input.nextAction) : undefined,
    ownerUserId: input.ownerId,
    applicationCategory: input.applicationCategory ?? null,
    productInterest: input.productInterest ?? null,
    lossReason: input.lossReason ?? null,
    competitorNotes: input.competitorNotes ?? null,
    updatedById: actorId,
  };
}

/** StageHistoryEntry[] -> nested create payload for the stageHistory relation. */
export function stageHistoryCreateData(entries: StageHistoryEntry[]) {
  return entries.map((h) => ({
    stage: h.stage,
    enteredAt: new Date(h.enteredAt),
    byUserId: h.byUserId ?? null,
    note: h.note ?? null,
  }));
}
