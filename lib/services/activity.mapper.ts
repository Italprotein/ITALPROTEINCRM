import type { Activity as PrismaActivity } from "@/lib/generated/prisma/client";
import type { Activity } from "@/lib/types";

// Prisma row <-> Activity DTO. Append-only timeline. Key transforms: FK renames
// (actorUserId<->byUserId, actorContactId<->byContactId), occurredAt<->at,
// DateTime<->ISO string. relatedType/relatedId are plain polymorphic scalars.
// The metadata Json column is not part of the DTO contract, so it is untouched.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

export function activityToDTO(a: PrismaActivity): Activity {
  return {
    id: a.id,
    type: a.type,
    companyId: undef(a.companyId),
    contactId: undef(a.contactId),
    relatedId: undef(a.relatedId),
    relatedType: undef(a.relatedType),
    title: a.title,
    body: undef(a.body),
    byUserId: undef(a.actorUserId),
    byContactId: undef(a.actorContactId),
    visibility: a.visibility ?? "internal",
    at: a.occurredAt.toISOString(),
  };
}

export function activityWriteData(input: Activity) {
  return {
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    companyId: input.companyId ?? null,
    contactId: input.contactId ?? null,
    relatedType: input.relatedType ?? null,
    relatedId: input.relatedId ?? null,
    actorUserId: input.byUserId ?? null,
    actorContactId: input.byContactId ?? null,
    visibility: input.visibility ?? null,
    occurredAt: new Date(input.at),
  };
}
