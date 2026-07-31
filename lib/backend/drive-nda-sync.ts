import { prisma } from "./prisma";
import { DRIVE_FOLDER_MIME, downloadDriveFile, listDriveFolder } from "./google-drive";

const DEFAULT_ROOT = "1Nq5vcROWHTjmROZXzU-tD2RcJZMZoOuc";
const MAX_BYTES = 20 * 1024 * 1024;

const normalize = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

const LEGAL_WORDS = new Set([
  "ag", "and", "bakemart", "company", "co", "corp", "corporation", "group", "groupe",
  "international", "limited", "ltd", "spa", "srl", "the",
]);

function words(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !LEGAL_WORDS.has(word));
}

function companyForFolder(
  folderName: string,
  companies: { id: string; legalName: string; tradingName: string | null }[],
) {
  const compactFolder = normalize(folderName);
  const folderWords = new Set(words(folderName));
  const ranked = companies.map((company) => {
    const names = [company.legalName, company.tradingName].filter(Boolean) as string[];
    const direct = names.some((name) => {
      const compact = normalize(name);
      return compact.length >= 4 && (compactFolder.includes(compact) || compact.includes(compactFolder));
    });
    const overlap = Math.max(...names.map((name) => {
      const nameWords = new Set(words(name));
      const shared = [...folderWords].filter((word) => nameWords.has(word)).length;
      return shared / Math.max(1, Math.min(folderWords.size, nameWords.size));
    }));
    return { company, score: direct ? 2 : overlap };
  }).sort((a, b) => b.score - a.score);
  return ranked[0] && ranked[0].score >= 0.6 && ranked[0].score > (ranked[1]?.score ?? 0)
    ? ranked[0].company
    : undefined;
}

function isDocument(file: { name: string; mimeType: string }) {
  return (
    file.mimeType === "application/pdf" ||
    file.mimeType === "application/msword" ||
    file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mimeType === "application/vnd.google-apps.document" ||
    /\.(pdf|docx?|odt|rtf)$/i.test(file.name)
  );
}

function looksLikeNda(name: string) {
  const tokens = words(name);
  return (
    tokens.includes("nda") ||
    tokens.includes("mta") ||
    /non.?disclosure|riservatezza|confidential|accordo.*riservatezza/i.test(name)
  );
}

export async function syncLatestDriveNdas(actorId: string) {
  const rootId = process.env.GOOGLE_DRIVE_INDUSTRIAL_CLIENTS_FOLDER_ID ?? DEFAULT_ROOT;
  const [folders, companies] = await Promise.all([
    listDriveFolder(rootId),
    prisma.company.findMany({ select: { id: true, legalName: true, tradingName: true } }),
  ]);
  let synced = 0;
  const skipped: string[] = [];
  const discoveries = new Map<string, {
    company: (typeof companies)[number];
    folderName: string;
    file: Awaited<ReturnType<typeof listDriveFolder>>[number];
  }>();

  for (const folder of folders.filter((item) => item.mimeType === DRIVE_FOLDER_MIME)) {
    const company = companyForFolder(folder.name, companies);
    if (!company) {
      skipped.push(`${folder.name}: no unique CRM company match`);
      continue;
    }
    const documents = (await listDriveFolder(folder.id)).filter(isDocument);
    const named = documents.filter((file) => looksLikeNda(file.name));
    // A handful of scanned agreements have generic scanner names. Accept a
    // single document as the folder's agreement, but never guess when multiple
    // non-NDA documents compete.
    const candidates = (named.length ? named : documents.length === 1 ? documents : [])
      .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""));
    const latest = candidates[0];
    if (!latest) {
      skipped.push(`${folder.name}: no unambiguous NDA document`);
      continue;
    }
    const previous = discoveries.get(company.id);
    if (!previous || (latest.modifiedTime ?? "") > (previous.file.modifiedTime ?? "")) {
      discoveries.set(company.id, { company, folderName: folder.name, file: latest });
    }
  }

  for (const { company, folderName, file: latest } of discoveries.values()) {
    const existing = await prisma.googleDriveFileLink.findUnique({ where: { googleFileId: latest.id } });
    if (existing?.driveModifiedTime?.toISOString() === latest.modifiedTime) continue;
    const downloaded = await downloadDriveFile(latest);
    if (downloaded.bytes.length > MAX_BYTES) {
      skipped.push(`${folderName}: file exceeds 20 MB`);
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
  return { folders: folders.length, matched: discoveries.size, synced, skipped };
}
