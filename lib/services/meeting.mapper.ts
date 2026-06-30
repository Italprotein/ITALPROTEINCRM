import type {
  Meeting as PrismaMeeting,
  MeetingContact as PrismaMeetingContact,
} from "@/lib/generated/prisma/client";
import type { Meeting } from "@/lib/types";

// Prisma row <-> Meeting DTO. Key transforms vs the references: ownerUserId<->ownerId
// (FK rename), the contactIds[] array is a many-to-many join (MeetingContact rows),
// DateTime <-> ISO string, nullable status default on read.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

/** Prisma row (with participants join loaded) -> Meeting DTO. */
export function meetingToDTO(
  m: PrismaMeeting & { participants?: PrismaMeetingContact[] },
): Meeting {
  const contactIds = m.participants?.map((p) => p.contactId) ?? [];
  return {
    id: m.id,
    title: m.title,
    type: m.type,
    companyId: undef(m.companyId),
    contactIds: contactIds.length ? contactIds : undefined,
    ownerId: m.ownerUserId,
    start: m.start.toISOString(),
    end: m.end?.toISOString(),
    location: undef(m.location),
    agenda: undef(m.agenda),
    notes: undef(m.notes),
    status: m.status ?? "scheduled",
    createdAt: m.createdAt.toISOString(),
  };
}

/** Meeting DTO -> Prisma scalar write payload (shared by create and update). */
export function meetingWriteData(input: Meeting, actorId: string | null) {
  return {
    title: input.title,
    type: input.type,
    companyId: input.companyId ?? null,
    ownerUserId: input.ownerId,
    start: new Date(input.start),
    end: input.end ? new Date(input.end) : null,
    location: input.location ?? null,
    agenda: input.agenda ?? null,
    notes: input.notes ?? null,
    status: input.status,
    updatedById: actorId,
  };
}
