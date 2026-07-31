import { prisma } from "./prisma";
import { DRIVE_FOLDER_MIME, downloadDriveFile, listDriveFolder } from "./google-drive";

const DEFAULT_ROOT = "1Nq5vcROWHTjmROZXzU-tD2RcJZMZoOuc";
const MAX_BYTES = 20 * 1024 * 1024;

const normalize = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export async function syncLatestDriveNdas(actorId: string) {
  const rootId = process.env.GOOGLE_DRIVE_INDUSTRIAL_CLIENTS_FOLDER_ID ?? DEFAULT_ROOT;
  const [folders, companies] = await Promise.all([
    listDriveFolder(rootId),
    prisma.company.findMany({ select: { id: true, legalName: true, tradingName: true } }),
  ]);
  let matched = 0;
  let synced = 0;
  const skipped: string[] = [];

  for (const folder of folders.filter((item) => item.mimeType === DRIVE_FOLDER_MIME)) {
    const folderName = normalize(folder.name);
    const company = companies.find((item) => {
      const names = [item.legalName, item.tradingName].filter(Boolean).map((name) => normalize(name!));
      return names.some((name) => name && (folderName.includes(name) || name.includes(folderName)));
    });
    if (!company) {
      skipped.push(folder.name);
      continue;
    }
    matched += 1;
    const candidates = (await listDriveFolder(folder.id))
      .filter((file) => /\bnda\b|non.?disclosure|riservatezza/i.test(file.name))
      .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
    const latest = candidates[0];
    if (!latest) continue;

    const existing = await prisma.googleDriveFileLink.findUnique({ where: { googleFileId: latest.id } });
    if (existing?.driveModifiedTime?.toISOString() === latest.modifiedTime) continue;
    const downloaded = await downloadDriveFile(latest);
    if (downloaded.bytes.length > MAX_BYTES) {
      skipped.push(`${folder.name}: file exceeds 20 MB`);
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const document = existing?.documentId
        ? await tx.document.update({
            where: { id: existing.documentId },
            data: { title: latest.name, mimeType: downloaded.mimeType, fileType: downloaded.mimeType, sizeBytes: downloaded.bytes.length, uploadedAt: new Date(), updatedById: actorId },
          })
        : await tx.document.create({
            data: { title: latest.name, category: "nda", confidentialityClass: "company_specific", companyId: company.id, mimeType: downloaded.mimeType, fileType: downloaded.mimeType, sizeBytes: downloaded.bytes.length, uploadedAt: new Date(), uploadedByUserId: actorId, createdById: actorId, updatedById: actorId },
          });
      await tx.attachment.create({
        data: { name: latest.name, fileType: downloaded.mimeType, mimeType: downloaded.mimeType, sizeBytes: downloaded.bytes.length, sizeKb: Math.ceil(downloaded.bytes.length / 1024), bytes: new Uint8Array(downloaded.bytes), documentId: document.id, uploadedByUserId: actorId, uploadedAt: new Date(), createdById: actorId, updatedById: actorId },
      });
      await tx.googleDriveFileLink.upsert({
        where: { googleFileId: latest.id },
        create: { googleFileId: latest.id, documentId: document.id, companyId: company.id, name: latest.name, mimeType: latest.mimeType, webViewLink: latest.webViewLink, accessLevel: "company_specific", driveModifiedTime: latest.modifiedTime ? new Date(latest.modifiedTime) : null, linkedByUserId: actorId, createdById: actorId, updatedById: actorId },
        update: { documentId: document.id, companyId: company.id, name: latest.name, mimeType: latest.mimeType, webViewLink: latest.webViewLink, driveModifiedTime: latest.modifiedTime ? new Date(latest.modifiedTime) : null, updatedById: actorId },
      });
      const nda = await tx.nDA.findFirst({ where: { companyId: company.id }, orderBy: { updatedAt: "desc" } });
      if (nda) {
        await tx.nDA.update({ where: { id: nda.id }, data: { signedFileId: document.id, updatedById: actorId } });
      } else {
        await tx.nDA.create({ data: { reference: `NDA-DRV-${company.id.slice(-10)}`, companyId: company.id, status: "under_review", reminderDates: [], signedFileId: document.id, createdById: actorId, updatedById: actorId } });
      }
    });
    synced += 1;
  }
  return { folders: folders.length, matched, synced, skipped };
}
