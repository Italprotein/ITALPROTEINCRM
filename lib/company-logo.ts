/**
 * Company logo formats and import-candidate rules — the pure half of the logo
 * pipeline.
 *
 * Deliberately free of any Prisma import (lib/backend/prisma.ts throws at module
 * load when DATABASE_URL is unset), so both the writer
 * (lib/backend/company-logo.ts) and the reader
 * (app/api/companies/[id]/logo/route.ts) can share one source of truth and this
 * file can be unit-tested under vitest's Node environment with no database.
 * Same split as lib/follow-up.ts / lib/nda-current.ts.
 */

/**
 * The ONE allowlist. What a provider may hand us and what the API route will
 * serve back must be the same set: accepting something we cannot serve stores
 * bytes and sets logoUpdatedAt, which makes every list row fire an <img>
 * request that 404s before falling back to initials — a permanent wasted
 * round-trip per row behind a "has logo" flag that is a lie.
 *
 * `image/svg+xml` is NOT here, and must not be added. An SVG is a document: it
 * can carry <script>, and this app sets no CSP, so an SVG served from our own
 * origin executes with the viewer's session. The path is real — anyone with
 * `company.edit` can point a company's website at a domain they control, and
 * DuckDuckGo's ip3 endpoint will proxy that domain's SVG favicon straight back
 * to us. Raster formats only.
 */
export const LOGO_CONTENT_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
];

/** True when this content type may be both stored and served. */
export function isAllowedLogoContentType(value: string | null | undefined): boolean {
  if (!value) return false;
  // Providers send parameters ("image/png;charset=binary") and inconsistent case.
  const bare = value.split(';')[0].trim().toLowerCase();
  return LOGO_CONTENT_TYPES.includes(bare);
}

export interface ParsedLogo {
  contentType: string;
  base64: string;
}

/**
 * Splits a stored logo data URI into its content type and payload, rejecting
 * anything malformed or outside the allowlist.
 *
 * Parsing generically and then checking membership — rather than baking the
 * formats into the pattern — is what keeps the read side from drifting away
 * from the write side.
 */
export function parseLogoDataUri(dataUri: string | null | undefined): ParsedLogo | null {
  if (!dataUri) return null;
  const match = /^data:([a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*);base64,(.+)$/is.exec(
    dataUri,
  );
  if (!match) return null;
  const contentType = match[1].toLowerCase();
  if (!isAllowedLogoContentType(contentType)) return null;
  return { contentType, base64: match[2] };
}

/**
 * Mailbox providers whose domain says nothing about the company.
 *
 * This list is the only thing standing between "derive identity from a contact's
 * email" and "stamp Google's favicon on every company whose buyer uses Gmail".
 * Because the importer fills only empty logos and never revisits them, a wrong
 * logo written here looks settled forever, so the list errs toward refusing.
 */
const FREE_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.it', 'hotmail.com', 'hotmail.it',
  'hotmail.fr', 'hotmail.co.uk', 'yahoo.com', 'yahoo.it', 'yahoo.co.uk', 'yahoo.fr',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com', 'proton.me', 'pm.me',
  'gmx.de', 'gmx.net', 'gmx.com', 'web.de', 'libero.it', 'tiscali.it', 'alice.it',
  'virgilio.it', 'live.com', 'live.it', 'msn.com', 'fastwebnet.it', 'inwind.it',
  'yandex.ru', 'mail.ru', 'zoho.com', 'qq.com', '163.com', '126.com',
]);

/**
 * A contact's email address -> the company's domain, or null.
 *
 * Why this exists: on production (2026-08-14) 9 of 438 companies carry a
 * website, but 381 have a contact on a corporate domain. Website-only identity
 * reaches 2% of the book; this reaches 87%.
 *
 * Returns null for free-mail and for anything malformed — a null here means
 * "no opinion", and the caller falls through to the initials tile.
 */
export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.trim().toLowerCase();
  const parts = at.split('@');
  if (parts.length !== 2) return null;
  const [local, rawDomain] = parts;
  if (!local) return null;
  const domain = rawDomain.replace(/^www\./, '');
  // Must look like a real host: at least one dot, and no empty label.
  if (!domain.includes('.') || domain.split('.').some((label) => label === '')) return null;
  if (FREE_EMAIL_DOMAINS.has(domain)) return null;
  return domain;
}

/**
 * Which companies the bulk importer touches.
 *
 * `logoUrl: null` is load-bearing: a company that already holds logo bytes is
 * never a candidate, whatever the state of logoUpdatedAt. So a row carrying a
 * hand-set logoUrl with a null timestamp is simply skipped — the importer will
 * not overwrite it, and the migration deliberately does not rewrite it either.
 *
 * The OR is the reach fix. Selecting on `website` alone matched 9 of 438
 * production companies; admitting anyone with a contact brings in the 381 whose
 * identity we only hold as an email domain. Whether that contact's domain is
 * actually usable is decided per-company by domainFromEmail, not here — SQL
 * cannot tell gmail.com from barilla.com.
 *
 * Not `as const`: Prisma's generated CompanyWhereInput takes a mutable
 * `OR: CompanyWhereInput[]`, and a readonly tuple is not assignable to it.
 */
export const LOGO_IMPORT_CANDIDATE_WHERE = {
  OR: [{ website: { not: null } }, { contacts: { some: {} } }],
  logoVerified: false,
  logoUrl: null,
};
