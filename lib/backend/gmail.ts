import { prisma } from "./prisma";
import { decryptSecret, encryptSecret } from "./crypto";
import { getBackendEnv } from "./env";

// Gmail integration (Node-only). Hand-rolled OAuth2 + Gmail REST v1 via fetch —
// no googleapis dependency. Tokens live encrypted in the google_oauth_tokens
// table (AES-256-GCM, see lib/backend/crypto.ts). The connected mailbox is the
// org account (ad@italprotein.com); every admin sends/reads through it.

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export const GMAIL_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export class GmailError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "GmailError";
    this.status = status;
  }
}

function googleClientConfig() {
  const env = getBackendEnv();
  const clientId = env.google.clientId;
  const clientSecret = env.google.clientSecret;
  const redirectUri =
    env.google.redirectUri ?? (env.app.url ? `${env.app.url.replace(/\/$/, "")}/api/auth/google/callback` : undefined);
  return { clientId, clientSecret, redirectUri, senderEmail: env.gmail.senderEmail };
}

export function isGoogleConfigured(): boolean {
  const { clientId, clientSecret, redirectUri } = googleClientConfig();
  return Boolean(clientId && clientSecret && redirectUri);
}

// ── OAuth flow ─────────────────────────────────────────────────────────────

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = googleClientConfig();
  if (!clientId || !redirectUri) throw new GmailError("Google OAuth is not configured", 500);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export async function exchangeOAuthCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = googleClientConfig();
  if (!clientId || !clientSecret || !redirectUri) throw new GmailError("Google OAuth is not configured", 500);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new GmailError(`Google code exchange failed (${res.status})`, res.status);
  return (await res.json()) as TokenResponse;
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
  const { clientId, clientSecret } = googleClientConfig();
  if (!clientId || !clientSecret) return null;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  return (await res.json()) as TokenResponse;
}

// ── Token storage ──────────────────────────────────────────────────────────

export async function storeMailboxTokens(options: {
  googleAccountEmail: string;
  userId: string | null;
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
}): Promise<void> {
  const { googleAccountEmail, userId, accessToken, refreshToken, expiresInSeconds } = options;
  const email = googleAccountEmail.toLowerCase();
  const existing = await prisma.googleOAuthToken.findUnique({
    where: { googleAccountEmail_isServiceAccount: { googleAccountEmail: email, isServiceAccount: false } },
  });
  const data = {
    userId,
    accessTokenEncrypted: encryptSecret(accessToken),
    // Google omits refresh_token on re-consent when one was already granted —
    // keep the previous one in that case.
    refreshTokenEncrypted: refreshToken
      ? encryptSecret(refreshToken)
      : (existing?.refreshTokenEncrypted ?? null),
    scopes: ["gmail_readonly", "gmail_send"] as const,
    status: "active" as const,
    accessTokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    lastRefreshedAt: new Date(),
    revokedAt: null,
  };
  if (existing) {
    await prisma.googleOAuthToken.update({
      where: { id: existing.id },
      data: { ...data, scopes: { set: [...data.scopes] } },
    });
  } else {
    await prisma.googleOAuthToken.create({
      data: { googleAccountEmail: email, isServiceAccount: false, ...data, scopes: [...data.scopes] },
    });
  }
}

async function findMailboxTokenRow() {
  const { senderEmail } = googleClientConfig();
  const preferred = await prisma.googleOAuthToken.findFirst({
    where: { googleAccountEmail: senderEmail.toLowerCase(), isServiceAccount: false, status: "active" },
  });
  if (preferred) return preferred;
  return prisma.googleOAuthToken.findFirst({
    where: { status: "active", isServiceAccount: false, refreshTokenEncrypted: { not: null } },
    orderBy: { updatedAt: "desc" },
  });
}

export interface GmailAuth {
  accessToken: string;
  email: string;
}

/** Resolve a live access token for the connected org mailbox (null when not connected). */
export async function getGmailAuth(): Promise<GmailAuth | null> {
  const row = await findMailboxTokenRow();
  if (!row?.refreshTokenEncrypted) return null;

  if (
    row.accessTokenEncrypted &&
    row.accessTokenExpiresAt &&
    row.accessTokenExpiresAt.getTime() - Date.now() > 60_000
  ) {
    try {
      return { accessToken: decryptSecret(row.accessTokenEncrypted), email: row.googleAccountEmail };
    } catch {
      // Fall through to refresh (e.g. encryption key changed).
    }
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(row.refreshTokenEncrypted);
  } catch {
    return null;
  }
  const refreshed = await refreshAccessToken(refreshToken);
  if (!refreshed) {
    await prisma.googleOAuthToken
      .update({ where: { id: row.id }, data: { status: "expired" } })
      .catch(() => undefined);
    return null;
  }
  await prisma.googleOAuthToken
    .update({
      where: { id: row.id },
      data: {
        accessTokenEncrypted: encryptSecret(refreshed.access_token),
        accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        lastRefreshedAt: new Date(),
        status: "active",
      },
    })
    .catch(() => undefined);
  return { accessToken: refreshed.access_token, email: row.googleAccountEmail };
}

export async function getMailboxConnection(): Promise<{
  connected: boolean;
  email?: string;
  status?: "active" | "expired" | "revoked";
}> {
  const row = await findMailboxTokenRow();
  if (row) return { connected: row.status === "active", email: row.googleAccountEmail, status: row.status };
  const any = await prisma.googleOAuthToken.findFirst({
    where: { isServiceAccount: false },
    orderBy: { updatedAt: "desc" },
  });
  if (!any) return { connected: false };
  return { connected: false, email: any.googleAccountEmail, status: any.status };
}

export async function revokeMailbox(): Promise<void> {
  const row = await findMailboxTokenRow();
  if (!row) return;
  await prisma.googleOAuthToken.update({
    where: { id: row.id },
    data: { status: "revoked", revokedAt: new Date() },
  });
}

// ── Gmail REST ─────────────────────────────────────────────────────────────

async function gmailFetch<T>(auth: GmailAuth, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GmailError(`Gmail API ${path} failed (${res.status}): ${text.slice(0, 300)}`, res.status);
  }
  return (await res.json()) as T;
}

export interface GmailProfile {
  emailAddress: string;
  messagesTotal?: number;
}

export async function getGmailProfile(auth: GmailAuth): Promise<GmailProfile> {
  return gmailFetch<GmailProfile>(auth, "/profile");
}

export interface GmailMessageRef {
  id: string;
  threadId: string;
}

export async function listMessageIds(
  auth: GmailAuth,
  query: string,
  max: number,
): Promise<GmailMessageRef[]> {
  const out: GmailMessageRef[] = [];
  let pageToken: string | undefined;
  while (out.length < max) {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(Math.min(100, max - out.length)),
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailFetch<{ messages?: GmailMessageRef[]; nextPageToken?: string }>(
      auth,
      `/messages?${params.toString()}`,
    );
    out.push(...(page.messages ?? []));
    if (!page.nextPageToken || !page.messages?.length) break;
    pageToken = page.nextPageToken;
  }
  return out.slice(0, max);
}

export interface GmailPayload {
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayload[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPayload;
}

export async function getMessage(auth: GmailAuth, id: string): Promise<GmailMessage> {
  return gmailFetch<GmailMessage>(auth, `/messages/${id}?format=full`);
}

export async function getThread(auth: GmailAuth, threadId: string): Promise<{ messages?: GmailMessage[] }> {
  return gmailFetch<{ messages?: GmailMessage[] }>(auth, `/threads/${threadId}?format=full`);
}

export async function getAttachmentBytes(
  auth: GmailAuth,
  messageId: string,
  attachmentId: string,
): Promise<Buffer> {
  const res = await gmailFetch<{ data?: string; size?: number }>(
    auth,
    `/messages/${messageId}/attachments/${attachmentId}`,
  );
  if (!res.data) throw new GmailError("Attachment has no data", 404);
  return Buffer.from(res.data, "base64url");
}

export async function sendRawMessage(auth: GmailAuth, raw: string): Promise<GmailMessageRef> {
  return gmailFetch<GmailMessageRef>(auth, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
}

// ── MIME helpers ───────────────────────────────────────────────────────────

function encodeHeaderWord(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function buildRawEmail(options: {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
}): string {
  const { from, fromName, to, cc, replyTo, subject, text } = options;
  const fromHeader = fromName ? `${encodeHeaderWord(fromName)} <${from}>` : from;
  const body = Buffer.from(text, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n");
  const lines = [
    `From: ${fromHeader}`,
    `To: ${to.join(", ")}`,
    ...(cc && cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeHeaderWord(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    body,
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

// ── Message parsing ────────────────────────────────────────────────────────

export function headerValue(message: GmailMessage, name: string): string | undefined {
  return message.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

export interface ParsedAddress {
  name?: string;
  email: string;
}

/** Parse "Display Name <user@host>" / bare address lists. */
export function parseAddressList(value: string | undefined): ParsedAddress[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
      if (match) {
        const name = match[1]?.trim();
        return { name: name || undefined, email: match[2].trim().toLowerCase() };
      }
      return { email: part.replace(/[<>]/g, "").trim().toLowerCase() };
    })
    .filter((a) => a.email.includes("@"));
}

function decodeBody(data: string | undefined): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Best-effort plain-text body: prefers text/plain parts, falls back to stripped HTML. */
export function extractBodyText(payload: GmailPayload | undefined): string {
  if (!payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (part: GmailPayload) => {
    if (part.parts?.length) {
      part.parts.forEach(walk);
      return;
    }
    if (part.filename) return; // attachment
    if (part.mimeType === "text/plain") plain.push(decodeBody(part.body?.data));
    else if (part.mimeType === "text/html") html.push(decodeBody(part.body?.data));
    else if (!part.mimeType && part.body?.data) plain.push(decodeBody(part.body.data));
  };
  walk(payload);
  if (plain.join("").trim()) return plain.join("\n").trim();
  return stripHtml(html.join("\n"));
}

export interface GmailAttachmentMeta {
  filename: string;
  mimeType: string;
  attachmentId: string;
  sizeBytes: number;
}

export function listAttachmentMeta(payload: GmailPayload | undefined): GmailAttachmentMeta[] {
  const out: GmailAttachmentMeta[] = [];
  const walk = (part: GmailPayload) => {
    if (part.filename && part.body?.attachmentId) {
      out.push({
        filename: part.filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        attachmentId: part.body.attachmentId,
        sizeBytes: part.body.size ?? 0,
      });
    }
    part.parts?.forEach(walk);
  };
  walk(payload ?? {});
  return out;
}
