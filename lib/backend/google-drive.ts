import "server-only";

import { getGmailAuth, GmailError } from "./gmail";

/*
 * Google Drive (read) for the shared ad@italprotein.com account.
 *
 * Same shape as google-calendar.ts: REST over fetch, reusing the mailbox token.
 * Read-only — the CRM links to files that already exist in Drive and never
 * creates, moves or deletes anything, so a bug here cannot damage the team's
 * document store.
 */

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

// Lives in its own module because it is pure and this one is `server-only`;
// re-exported here so folder-id normalisation reads as part of the Drive API.
export { driveFolderId } from "./drive-folder-id";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Opens the file in Drive's own viewer. */
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: number;
  owner?: string;
}

export const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";

interface RawFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  iconLink?: string;
  modifiedTime?: string;
  size?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
}

const FIELDS = "files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size,owners(displayName,emailAddress))";

function toFile(raw: RawFile): DriveFile {
  return {
    id: raw.id,
    name: raw.name,
    mimeType: raw.mimeType,
    webViewLink: raw.webViewLink,
    iconLink: raw.iconLink,
    modifiedTime: raw.modifiedTime,
    // Google Docs-native files report no size; that is not an error.
    size: raw.size ? Number(raw.size) : undefined,
    owner: raw.owners?.[0]?.displayName ?? raw.owners?.[0]?.emailAddress,
  };
}

/** Escapes a term for Drive's query language, where ' and \ are significant. */
function escapeQuery(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Search Drive by name. Trashed files are excluded — linking a document that
 * someone has already thrown away would be worse than finding nothing.
 */
export async function searchDriveFiles(term: string, limit = 20): Promise<DriveFile[]> {
  const auth = await getGmailAuth();
  if (!auth) return [];

  const trimmed = term.trim();
  const q = trimmed
    ? `name contains '${escapeQuery(trimmed)}' and trashed = false`
    : "trashed = false";

  const params = new URLSearchParams({
    q,
    fields: FIELDS,
    pageSize: String(Math.min(limit, 100)),
    orderBy: "modifiedTime desc",
    // Include files from shared drives, not just the account's own My Drive.
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const res = await fetch(`${DRIVE_BASE}/files?${params}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });

  if (res.status === 403) {
    throw new GmailError(
      "Drive access denied — reconnect the Google account to grant the Drive scope, and check the Drive API is enabled.",
      403,
    );
  }
  if (!res.ok) throw new GmailError(`Google Drive request failed (${res.status})`, res.status);

  const data = (await res.json()) as { files?: RawFile[] };
  return (data.files ?? []).map(toFile);
}

/** Metadata for one file, or null when it is missing or not visible to us. */
export async function getDriveFile(fileId: string): Promise<DriveFile | null> {
  const auth = await getGmailAuth();
  if (!auth) return null;

  const params = new URLSearchParams({
    fields: "id,name,mimeType,webViewLink,iconLink,modifiedTime,size,owners(displayName,emailAddress)",
    supportsAllDrives: "true",
  });
  const res = await fetch(`${DRIVE_BASE}/files/${encodeURIComponent(fileId)}?${params}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new GmailError(`Google Drive request failed (${res.status})`, res.status);
  return toFile((await res.json()) as RawFile);
}

/** Lists direct children of a Drive folder, including shared-drive folders. */
export async function listDriveFolder(folderId: string): Promise<DriveFile[]> {
  const auth = await getGmailAuth();
  if (!auth) return [];
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${escapeQuery(folderId)}' in parents and trashed = false`,
      fields: `nextPageToken,${FIELDS}`,
      pageSize: "1000",
      orderBy: "modifiedTime desc",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`${DRIVE_BASE}/files?${params}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new GmailError(`Google Drive request failed (${response.status})`, response.status);
    const data = (await response.json()) as { files?: RawFile[]; nextPageToken?: string };
    files.push(...(data.files ?? []).map(toFile));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return files;
}

/** Downloads a Drive file. Native Google files are exported as PDF. */
export async function downloadDriveFile(file: DriveFile): Promise<{ bytes: Buffer; mimeType: string }> {
  const auth = await getGmailAuth();
  if (!auth) throw new GmailError("Google account is not connected.", 401);
  const native = file.mimeType.startsWith("application/vnd.google-apps.");
  const url = native
    ? `${DRIVE_BASE}/files/${encodeURIComponent(file.id)}/export?mimeType=application%2Fpdf`
    : `${DRIVE_BASE}/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new GmailError(`Google Drive download failed (${response.status})`, response.status);
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    mimeType: native ? "application/pdf" : (response.headers.get("content-type") ?? file.mimeType),
  };
}

/** True when the stored token actually carries a Drive scope. */
export async function hasDriveAccess(): Promise<boolean> {
  const { prisma } = await import("./prisma");
  const row = await prisma.googleOAuthToken.findFirst({
    where: { status: "active", isServiceAccount: false },
    select: { scopes: true },
  });
  return Boolean(row?.scopes.some((s) => s === "drive_metadata_readonly" || s === "drive_file"));
}
