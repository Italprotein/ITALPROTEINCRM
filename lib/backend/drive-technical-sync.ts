import { prisma } from "./prisma";
import { DRIVE_FOLDER_MIME, downloadDriveFile, driveFolderId, listDriveFolder } from "./google-drive";
import { inferTechnicalCategory } from "@/lib/technical-docs";

/**
 * Import the shared Drive folder "Documenti Tecnici" into the CRM.
 *
 * One-way: Drive is the source, the CRM never writes back, so the connected
 * account needs no write scope. Simpler than `drive-nda-sync.ts` because the
 * source is one flat folder — there is no company to match a subfolder to.
 *
 * Imports land as `companyId: null` + `post_nda`, which the existing portal gate
 * (`documentsForPortal`) already surfaces to any company with a signed NDA.
 */

const MAX_BYTES = 20 * 1024 * 1024;

/** Same document types the NDA sync accepts. */
function isDocument(file: { name: string; mimeType: string }) {
  return (
    file.mimeType === "application/pdf" ||
    file.mimeType === "application/msword" ||
    file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mimeType === "application/vnd.google-apps.document" ||
    /\.(pdf|docx?|odt|rtf)$/i.test(file.name)
  );
}

export interface TechnicalSyncResult {
  found: number;
  synced: number;
  skipped: string[];
}

export async function syncTechnicalDriveDocuments(actorId: string): Promise<TechnicalSyncResult> {
  // No fallback: there is no sane default "Documenti Tecnici" folder to guess.
  // `driveFolderId` is what makes an empty string or the env template's
  // `<1abc…>` placeholder count as unset, so a misconfigured deployment stops
  // here with a name for its problem rather than asking Drive for a folder id
  // that cannot exist and reporting the resulting 404.
  //
  // Still a throw, not a returned error object: the sole caller
  // (app/api/documents/sync-technical/route.ts) turns a thrown message into
  // `{ error: "TECHNICAL_FOLDER_NOT_CONFIGURED" }`, which is exactly the
  // response contract wanted — and TechnicalSyncResult stays a success shape.
  const folderId = driveFolderId(process.env.GOOGLE_DRIVE_TECHNICAL_FOLDER_ID);
  if (!folderId) throw new Error("TECHNICAL_FOLDER_NOT_CONFIGURED");

  const entries = await listDriveFolder(folderId);
  const files = entries.filter((file) => file.mimeType !== DRIVE_FOLDER_MIME).filter(isDocument);

  let synced = 0;
  const skipped: string[] = [];

  for (const file of files) {
    const existing = await prisma.googleDriveFileLink.findUnique({
      where: { googleFileId: file.id },
    });
    // Unchanged in Drive since the last pass — nothing to download.
    if (existing?.driveModifiedTime?.toISOString() === file.modifiedTime) continue;

    const downloaded = await downloadDriveFile(file);
    if (downloaded.bytes.length > MAX_BYTES) {
      skipped.push(`${file.name}: file exceeds 20 MB`);
      continue;
    }

    const category = inferTechnicalCategory(file.name);

    await prisma.$transaction(async (tx) => {
      const document = existing?.documentId
        ? await tx.document.update({
            where: { id: existing.documentId },
            data: {
              title: file.name,
              category,
              mimeType: downloaded.mimeType,
              fileType: downloaded.mimeType,
              sizeBytes: downloaded.bytes.length,
              uploadedAt: new Date(),
              updatedById: actorId,
              // confidentialityClass is deliberately NOT reset here: staff may
              // have pulled this document back to `internal` from the library
              // page, and a re-sync must not silently republish it to clients.
            },
          })
        : await tx.document.create({
            data: {
              title: file.name,
              category,
              confidentialityClass: "post_nda",
              companyId: null,
              mimeType: downloaded.mimeType,
              fileType: downloaded.mimeType,
              sizeBytes: downloaded.bytes.length,
              uploadedAt: new Date(),
              uploadedByUserId: actorId,
              createdById: actorId,
              updatedById: actorId,
            },
          });

      await tx.attachment.create({
        data: {
          name: file.name,
          fileType: downloaded.mimeType,
          mimeType: downloaded.mimeType,
          sizeBytes: downloaded.bytes.length,
          sizeKb: Math.ceil(downloaded.bytes.length / 1024),
          bytes: new Uint8Array(downloaded.bytes),
          documentId: document.id,
          uploadedByUserId: actorId,
          uploadedAt: new Date(),
          createdById: actorId,
          updatedById: actorId,
        },
      });

      await tx.googleDriveFileLink.upsert({
        where: { googleFileId: file.id },
        create: {
          googleFileId: file.id,
          documentId: document.id,
          name: file.name,
          mimeType: file.mimeType,
          webViewLink: file.webViewLink,
          accessLevel: "post_nda",
          driveModifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
          linkedByUserId: actorId,
          createdById: actorId,
          updatedById: actorId,
        },
        update: {
          documentId: document.id,
          name: file.name,
          mimeType: file.mimeType,
          webViewLink: file.webViewLink,
          driveModifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
          updatedById: actorId,
        },
      });
    });

    synced += 1;
  }

  return { found: files.length, synced, skipped };
}
