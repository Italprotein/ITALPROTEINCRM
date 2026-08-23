import { Prisma } from "@/lib/generated/prisma/client";
import type { DoNotContactEntry as PrismaDoNotContactEntry } from "@/lib/generated/prisma/client";
import { normalizeNotes, toDoNotContactReason } from "@/lib/do-not-contact";
import type { DoNotContactEntry, DoNotContactReason } from "@/lib/types";

// Prisma row <-> DoNotContactEntry DTO. The register is deliberately narrow:
// every column on the model is exposed, so there is nothing an update could
// silently clobber.

/** Prisma row -> DTO (the shape the UI consumes). */
export function doNotContactToDTO(e: PrismaDoNotContactEntry): DoNotContactEntry {
  return {
    id: e.id,
    companyId: e.companyId,
    reason: e.reason as DoNotContactReason,
    notes: e.notes ?? undefined,
    addedById: e.addedById ?? undefined,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

/** Reason + notes -> Prisma write payload (shared by create and update). */
export function doNotContactWriteData(input: { reason: unknown; notes?: string | null }) {
  return {
    reason: toDoNotContactReason(input.reason),
    notes: normalizeNotes(input.notes) ?? null,
  } satisfies Prisma.DoNotContactEntryUncheckedUpdateInput;
}
