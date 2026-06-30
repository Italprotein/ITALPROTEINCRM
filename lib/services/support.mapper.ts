import { Prisma } from "@/lib/generated/prisma/client";
import type {
  SupportRequest as PrismaSupportRequest,
  SupportMessage as PrismaSupportMessage,
} from "@/lib/generated/prisma/client";
import type { AttachmentRef, SupportRequest } from "@/lib/types";

// Prisma row <-> SupportRequest DTO. The DTO's `conversation` array is stored as
// a separate SupportMessage relation (authorUserId<->byUserId,
// authorContactId<->byContactId, createdAt<->at). FK rename:
// assignedOwnerUserId<->assignedOwnerId. The DTO has `attachments` but there is
// no column for it — see the TODO below.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

type SupportRow = PrismaSupportRequest & { messages?: PrismaSupportMessage[] };

/** Prisma row (+ messages relation) -> SupportRequest DTO. */
export function supportToDTO(s: SupportRow): SupportRequest {
  const messages = s.messages ?? [];
  return {
    id: s.id,
    reference: s.reference,
    companyId: s.companyId,
    contactId: undef(s.contactId),
    subject: s.subject,
    category: s.category,
    description: s.description,
    priority: s.priority,
    status: s.status,
    assignedOwnerId: undef(s.assignedOwnerUserId),
    conversation: messages
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => ({
        byUserId: undef(m.authorUserId),
        byContactId: undef(m.authorContactId),
        body: m.body,
        at: m.createdAt.toISOString(),
      })),
    // TODO: no attachments column on SupportRequest yet — wire object storage.
    attachments: undefined as unknown as AttachmentRef[] | undefined,
    createdAt: s.createdAt.toISOString(),
    dueDate: s.dueDate?.toISOString(),
    resolvedDate: s.resolvedDate?.toISOString(),
  };
}

/** SupportRequest DTO -> Prisma write payload for the SupportRequest row only.
 * The `conversation` relation is synced separately in the actions. */
export function supportWriteData(input: SupportRequest, actorId: string | null) {
  // attachments are accepted by the DTO but intentionally not persisted yet.
  void asJson;
  return {
    reference: input.reference,
    companyId: input.companyId,
    contactId: input.contactId ?? null,
    subject: input.subject,
    category: input.category,
    description: input.description,
    priority: input.priority,
    status: input.status,
    assignedOwnerUserId: input.assignedOwnerId ?? null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    resolvedDate: input.resolvedDate ? new Date(input.resolvedDate) : null,
    updatedById: actorId,
  };
}

/** Conversation DTO items -> SupportMessage create rows (sans supportRequestId). */
export function conversationCreateData(input: SupportRequest) {
  return (input.conversation ?? []).map((m) => ({
    authorUserId: m.byUserId ?? null,
    authorContactId: m.byContactId ?? null,
    body: m.body,
    createdAt: m.at ? new Date(m.at) : new Date(),
  }));
}
