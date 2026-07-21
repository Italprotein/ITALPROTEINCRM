import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "crypto";

// Node-only helpers for encrypting Google OAuth tokens at rest and for
// hashing/signing short-lived secrets (password-reset codes, OAuth state).
// Key source: GOOGLE_TOKEN_ENC_KEY when set, otherwise AUTH_SECRET.

function secretKeySource(): string {
  const secret = process.env.GOOGLE_TOKEN_ENC_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET (or GOOGLE_TOKEN_ENC_KEY) must be set for secret encryption");
  }
  return secret;
}

function encryptionKey(): Buffer {
  return createHash("sha256").update(secretKeySource()).digest();
}

/** AES-256-GCM. Output format: v1.<iv>.<authTag>.<ciphertext> (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${data.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [version, iv, tag, data] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Keyed hash for stored one-time codes — never store the plaintext code. */
export function hashOneTimeCode(code: string): string {
  return createHmac("sha256", secretKeySource()).update(code).digest("hex");
}

export function verifyOneTimeCode(code: string, storedHash: string): boolean {
  const a = Buffer.from(hashOneTimeCode(code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Six-digit numeric code from a CSPRNG. */
export function generateResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** 256-bit bearer token for account activation links. */
export function generateActivationToken(): string {
  return randomBytes(32).toString("base64url");
}

/** HMAC hash used for activation-token lookup; plaintext is never persisted. */
export function hashActivationToken(token: string): string {
  return createHmac("sha256", secretKeySource()).update(`account-activation:${token}`).digest("hex");
}

// ── HMAC-signed state for the Google OAuth round-trip ─────────────────────

export function signState(payload: Record<string, unknown>, ttlSeconds = 600): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secretKeySource()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState<T = Record<string, unknown>>(state: string): T | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secretKeySource()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
