import { Prisma } from "@/lib/generated/prisma/client";
import type {
  NDA as PrismaNDA,
  Document as PrismaDocument,
  DocumentVersion as PrismaDocumentVersion,
} from "@/lib/generated/prisma/client";
import type { AttachmentRef, DocumentAccessLevel, NDA, NDAVersion } from "@/lib/types";

// Prisma row <-> NDA DTO. The NDA model normalizes data the DTO keeps inline:
// `versions` is a DocumentVersion[] relation (not a Json column), and the single
// `signedFile` Document relation backs the DTO's `signedFiles` array. Date columns
// map to ISO strings; nullable enum (accessLevelUnlocked) is left undefined on read.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);
const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

// Row shape produced by the actions query (NDA plus its included relations).
export type PrismaNDAWithRelations = PrismaNDA & {
  versions?: PrismaDocumentVersion[];
  signedFile?: PrismaDocument | null;
};

/** DocumentVersion relation row -> NDAVersion DTO entry. */
function versionToDTO(v: PrismaDocumentVersion): NDAVersion {
  const fileRef: AttachmentRef | undefined = v.storageKey
    ? {
        id: v.id,
        name: v.version,
        fileType: v.mimeType ?? "application/octet-stream",
        sizeKb: v.sizeBytes == null ? undefined : Math.round(v.sizeBytes / 1024),
        uploadedAt: v.versionDate?.toISOString() ?? v.createdAt.toISOString(),
      }
    : undefined;
  return {
    version: v.version,
    date: (v.versionDate ?? v.createdAt).toISOString(),
    note: undef(v.note),
    fileRef,
  };
}

/** Single signed-file Document relation -> AttachmentRef. */
function documentToAttachment(d: PrismaDocument): AttachmentRef {
  return {
    id: d.id,
    name: d.title,
    fileType: d.fileType ?? d.mimeType ?? "application/octet-stream",
    sizeKb: d.sizeBytes == null ? undefined : Math.round(d.sizeBytes / 1024),
    uploadedAt: d.uploadedAt?.toISOString() ?? d.createdAt.toISOString(),
  };
}

/** Prisma NDA row (with relations) -> NDA DTO. */
export function ndaToDTO(n: PrismaNDAWithRelations): NDA {
  return {
    id: n.id,
    reference: n.reference,
    companyId: n.companyId,
    type: n.type,
    templateVersion: undef(n.templateVersion),
    datePrepared: n.datePrepared?.toISOString(),
    dateSent: (n.dateSent ?? n.sentAt)?.toISOString(),
    status: n.status,
    internalSignatory: undef(n.internalSignatory),
    externalSignatory: undef(n.externalSignatory ?? n.counterpartySignerName),
    requestedModifications: undef(n.requestedModifications),
    effectiveDate: n.effectiveDate?.toISOString(),
    expiryDate: n.expiryDate?.toISOString(),
    governingLaw: undef(n.governingLaw),
    jurisdiction: undef(n.jurisdiction),
    permittedAffiliates: undef(n.permittedAffiliates),
    permittedSubDistributors: undef(n.permittedSubDistributors),
    reminderDates: n.reminderDates.map((d) => d.toISOString()),
    versions: (n.versions ?? []).map(versionToDTO),
    signedFiles: n.signedFile ? [documentToAttachment(n.signedFile)] : undefined,
    // amendmentFiles has no dedicated column; not denormalized on read.
    amendmentFiles: undefined,
    accessLevelUnlocked: undef(n.accessLevelUnlocked as DocumentAccessLevel | null),
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * NDA DTO -> Prisma write payload (shared by create and update). Scalar columns
 * only; the `versions` relation and the `signedFile`/amendment attachments are
 * managed via their own models, so they are not written from this payload.
 */
export function ndaWriteData(input: NDA, actorId: string | null) {
  return {
    reference: input.reference,
    companyId: input.companyId,
    type: input.type,
    status: input.status,
    templateVersion: input.templateVersion ?? null,
    datePrepared: input.datePrepared ? new Date(input.datePrepared) : null,
    dateSent: input.dateSent ? new Date(input.dateSent) : null,
    effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
    expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
    internalSignatory: input.internalSignatory ?? null,
    externalSignatory: input.externalSignatory ?? null,
    requestedModifications: input.requestedModifications ?? null,
    governingLaw: input.governingLaw ?? null,
    jurisdiction: input.jurisdiction ?? null,
    permittedAffiliates: input.permittedAffiliates ?? null,
    permittedSubDistributors: input.permittedSubDistributors ?? null,
    reminderDates: (input.reminderDates ?? []).map((d) => new Date(d)),
    accessLevelUnlocked: input.accessLevelUnlocked ?? null,
    updatedById: actorId,
  };
}

// Re-exported so other server modules can reuse the Json coercion if needed.
export { asJson };
