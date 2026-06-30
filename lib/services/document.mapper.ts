import type { Document as PrismaDocument } from "@/lib/generated/prisma/client";
import type { DocumentRecord } from "@/lib/types";

// Prisma row <-> DocumentRecord DTO. Key transforms: title<->name,
// confidentialityClass<->accessLevel, sizeBytes(Int)<->sizeKb (÷/×1024),
// uploadedByUserId rename, DateTime<->ISO string, nullable uploadedAt falls back
// to createdAt. Server-side only (imported by document.actions.ts).

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

/** Prisma row -> DocumentRecord DTO (the shape the UI consumes). */
export function documentToDTO(d: PrismaDocument): DocumentRecord {
  return {
    id: d.id,
    name: d.title,
    category: d.category,
    accessLevel: d.confidentialityClass,
    companyId: undef(d.companyId),
    version: undef(d.version),
    fileType: d.fileType ?? d.mimeType ?? "",
    sizeKb: d.sizeBytes == null ? undefined : Math.round(d.sizeBytes / 1024),
    uploadedAt: (d.uploadedAt ?? d.createdAt).toISOString(),
    uploadedByUserId: undef(d.uploadedByUserId),
    description: undef(d.description),
    downloadCount: d.downloadCount,
  };
}

/** DocumentRecord DTO -> Prisma write payload (shared by create and update). */
export function documentWriteData(input: DocumentRecord, actorId: string | null) {
  return {
    title: input.name,
    category: input.category,
    confidentialityClass: input.accessLevel,
    companyId: input.companyId ?? null,
    version: input.version ?? null,
    fileType: input.fileType ?? null,
    mimeType: input.fileType ?? null,
    sizeBytes: input.sizeKb == null ? null : Math.round(input.sizeKb * 1024),
    uploadedAt: input.uploadedAt ? new Date(input.uploadedAt) : null,
    uploadedByUserId: input.uploadedByUserId ?? null,
    description: input.description ?? null,
    downloadCount: input.downloadCount ?? 0,
    updatedById: actorId,
  };
}
