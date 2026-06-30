import { Prisma } from "@/lib/generated/prisma/client";
import type {
  Feedback as PrismaFeedback,
  FeedbackComment as PrismaFeedbackComment,
} from "@/lib/generated/prisma/client";
import type { AttachmentRef, Feedback, FeedbackComment } from "@/lib/types";

// Prisma row <-> Feedback DTO. Feedback owns a 1-to-many `comments` relation
// (FeedbackComment model), so rows are read with comments included and the
// nested array is mapped explicitly. FK rename: technicalOwnerUserId <->
// technicalOwnerId. Extra Prisma columns (requiresRnDAction, technicalReply)
// are not on the DTO and are managed by the actions layer.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** A Feedback row joined with its comments. */
export type FeedbackRow = PrismaFeedback & { comments: PrismaFeedbackComment[] };

function commentToDTO(c: PrismaFeedbackComment): FeedbackComment {
  return {
    id: c.id,
    byUserId: undef(c.byUserId),
    byContactId: undef(c.byContactId),
    visibility: c.visibility,
    body: c.body,
    at: c.at.toISOString(),
  };
}

/** Prisma row (with comments) -> Feedback DTO. */
export function feedbackToDTO(f: FeedbackRow): Feedback {
  return {
    id: f.id,
    reference: f.reference,
    companyId: f.companyId,
    contactId: undef(f.contactId),
    sampleRequestId: undef(f.sampleRequestId),
    shipmentId: undef(f.shipmentId),
    projectId: undef(f.projectId),
    lotBatch: undef(f.lotBatch),
    applicationCategory: f.applicationCategory,
    productProjectName: undef(f.productProjectName),
    testDate: f.testDate?.toISOString(),
    overallResult: undef(f.overallResult),
    overallRating: undef(f.overallRating),
    tasteAroma: undef(f.tasteAroma),
    solubility: undef(f.solubility),
    processingBehaviour: undef(f.processingBehaviour),
    texture: undef(f.texture),
    appearanceColour: undef(f.appearanceColour),
    comparisonControl: undef(f.comparisonControl),
    issuesEncountered: undef(f.issuesEncountered),
    questions: undef(f.questions),
    requestedSupport: undef(f.requestedSupport),
    preferredNextStep: undef(f.preferredNextStep),
    availabilityForCall: undef(f.availabilityForCall),
    attachments: undef(f.attachments as unknown as AttachmentRef[] | null),
    priority: f.priority,
    status: f.status,
    technicalOwnerId: undef(f.technicalOwnerUserId),
    comments: (f.comments ?? []).map(commentToDTO),
    createdAt: f.createdAt.toISOString(),
  };
}

/**
 * Feedback DTO -> Prisma write payload for the Feedback row (scalar columns
 * only; the `comments` relation is written separately by the actions layer).
 */
export function feedbackWriteData(input: Feedback, actorId: string | null) {
  return {
    reference: input.reference,
    companyId: input.companyId,
    contactId: input.contactId ?? null,
    sampleRequestId: input.sampleRequestId ?? null,
    shipmentId: input.shipmentId ?? null,
    projectId: input.projectId ?? null,
    lotBatch: input.lotBatch ?? null,
    applicationCategory: input.applicationCategory,
    productProjectName: input.productProjectName ?? null,
    testDate: input.testDate ? new Date(input.testDate) : null,
    overallResult: input.overallResult ?? null,
    overallRating: input.overallRating ?? null,
    tasteAroma: input.tasteAroma ?? null,
    solubility: input.solubility ?? null,
    processingBehaviour: input.processingBehaviour ?? null,
    texture: input.texture ?? null,
    appearanceColour: input.appearanceColour ?? null,
    comparisonControl: input.comparisonControl ?? null,
    issuesEncountered: input.issuesEncountered ?? null,
    questions: input.questions ?? null,
    requestedSupport: input.requestedSupport ?? null,
    preferredNextStep: input.preferredNextStep ?? null,
    availabilityForCall: input.availabilityForCall ?? null,
    attachments: input.attachments ? asJson(input.attachments) : undefined,
    priority: input.priority,
    status: input.status,
    technicalOwnerUserId: input.technicalOwnerId ?? null,
    updatedById: actorId,
  };
}

/** Build the nested-create payload for a feedback's comments. */
export function commentCreateData(comments: FeedbackComment[], actorId: string | null) {
  return comments.map((c) => ({
    id: c.id,
    byUserId: c.byUserId ?? null,
    byContactId: c.byContactId ?? null,
    visibility: c.visibility,
    body: c.body,
    at: new Date(c.at),
    createdById: actorId,
  }));
}
