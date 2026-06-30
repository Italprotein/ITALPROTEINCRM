import type {
  Task as PrismaTask,
  TaskCollaborator as PrismaTaskCollaborator,
  TaskComment as PrismaTaskComment,
} from "@/lib/generated/prisma/client";
import type { Task } from "@/lib/types";

// Prisma row <-> Task DTO. New transforms vs Sample: collaborators and comments
// are separate relation tables (TaskCollaborator / TaskComment), flattened here
// to collaboratorIds: string[] and comments: { byUserId, body, at }[]. FK rename
// ownerUserId<->ownerId; comment authorUserId<->byUserId, createdAt<->at.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

// Row shape the mapper consumes: a Task with its collaborators + comments included.
export type TaskRow = PrismaTask & {
  collaborators?: PrismaTaskCollaborator[];
  comments?: PrismaTaskComment[];
};

/** Prisma row -> Task DTO (the shape the UI consumes). */
export function taskToDTO(t: TaskRow): Task {
  return {
    id: t.id,
    title: t.title,
    description: undef(t.description),
    type: t.type,
    companyId: undef(t.companyId),
    contactId: undef(t.contactId),
    relatedId: undef(t.relatedId),
    relatedType: undef(t.relatedType),
    ownerId: t.ownerUserId,
    collaboratorIds: t.collaborators?.map((c) => c.userId) ?? [],
    priority: t.priority,
    dueDate: t.dueDate?.toISOString(),
    reminderDate: t.reminderDate?.toISOString(),
    status: t.status,
    comments: (t.comments ?? []).map((c) => ({
      byUserId: c.authorUserId,
      body: c.body,
      at: c.createdAt.toISOString(),
    })),
    completedAt: t.completedAt?.toISOString(),
    createdAt: t.createdAt.toISOString(),
  };
}

/** Task DTO -> Prisma scalar write payload (shared by create and update). */
export function taskWriteData(input: Task, actorId: string | null) {
  return {
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    status: input.status,
    priority: input.priority,
    companyId: input.companyId ?? null,
    contactId: input.contactId ?? null,
    relatedType: input.relatedType ?? null,
    relatedId: input.relatedId ?? null,
    ownerUserId: input.ownerId,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    reminderDate: input.reminderDate ? new Date(input.reminderDate) : null,
    completedAt: input.completedAt ? new Date(input.completedAt) : null,
    updatedById: actorId,
  };
}
