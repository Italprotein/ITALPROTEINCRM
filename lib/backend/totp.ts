import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/*
 * TOTP (RFC 6238) — the second factor for admin sign-in.
 *
 * Implemented directly rather than pulled from a package: the algorithm is ~30
 * lines of well-specified HMAC, it is verified against the RFC's own test
 * vectors in tests/totp.test.ts, and an auth-critical dependency is one more
 * thing that can be swapped under us. Compatible with Google Authenticator,
 * 1Password, Authy, Bitwarden and anything else that speaks otpauth://.
 */

const DIGITS = 6;
const PERIOD_SECONDS = 30;
/** Accept the neighbouring steps so a slightly-off device clock still works. */
const DEFAULT_WINDOW = 1;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** RFC 4648 base32 (no padding) — the encoding authenticator apps expect. */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error("Invalid base32 character in TOTP secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh 160-bit secret, base32-encoded for the authenticator app. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226): the counter-based primitive TOTP is built on. */
function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(buf).digest();
  // Dynamic truncation: the low nibble of the last byte picks the offset.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** The code for a given moment (defaults to now). Exported for testing. */
export function totpCode(base32Secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}

/**
 * Constant-time check of a user-supplied code against the current step and its
 * immediate neighbours.
 */
export function verifyTotp(
  base32Secret: string,
  token: string,
  atMs: number = Date.now(),
  window: number = DEFAULT_WINDOW,
): boolean {
  const candidate = token.replace(/\D/g, "");
  if (candidate.length !== DIGITS) return false;

  const secret = base32Decode(base32Secret);
  const counter = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  const supplied = Buffer.from(candidate);

  let matched = false;
  for (let drift = -window; drift <= window; drift++) {
    const expected = Buffer.from(hotp(secret, counter + drift));
    // Compare every candidate (no early exit) to keep the timing flat.
    if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
      matched = true;
    }
  }
  return matched;
}

/** otpauth:// URI — what the QR code encodes. */
export function totpAuthUri(secret: string, accountEmail: string, issuer = "Italprotein CRM"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Human-friendly single-use recovery codes, e.g. "4F2A-9C7E". */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

/** Normalises user input so "4f2a9c7e" and "4F2A-9C7E" both match. */
export function normaliseBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-F0-9]/g, "");
}
