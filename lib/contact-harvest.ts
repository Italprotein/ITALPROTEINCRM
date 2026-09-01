/**
 * Harvesting contacts out of the synced mailbox — the pure half.
 *
 * Every address we have ever written to or heard from is a contact we already
 * have; they were just never written down. This module decides which of those
 * addresses deserve a Contact row, what to call the person behind each one,
 * and — the part that matters most — which addresses must NOT be written down
 * because Gmail already told us they do not exist.
 *
 * No Prisma import, so all of it is unit-testable without a database.
 */

import { isInfrastructureDomain, registrableDomainOf } from "@/lib/email-entity";

/* ────────────────────────────── Bounces ──────────────────────────────
 *
 * Gmail returns a delivery failure as a DSN: a human-readable marker, then
 * machine-readable `Final-Recipient` and `Status` fields. Both are used here,
 * because neither alone is enough:
 *
 *  - The marker is what a person reads in Gmail ("Indirizzo non trovato" /
 *    "Address not found"), and is the thing being asked for when someone says
 *    "check the address isn't listed as Not found".
 *  - The status code catches the same failure reported by a non-Gmail relay
 *    that writes its own wording.
 *
 * The distinction that actually protects data is the opposite one: a bounce is
 * NOT proof of a bad address. "Messaggio troppo grande" (5.3.4) and "casella
 * piena" (5.2.2) are bounces from mailboxes that exist and are being read by a
 * real person. Production holds 36 of the former. Treating those as dead would
 * throw away working contacts, so they are explicitly excluded below.
 * ──────────────────────────────────────────────────────────────────── */

/** Human-readable markers Gmail puts at the top of a "no such address" DSN. */
const NOT_FOUND_MARKERS = ["indirizzo non trovato", "address not found"];

/**
 * Enhanced status codes that mean "this mailbox does not exist".
 *
 * 5.1.1 bad destination mailbox · 5.1.2 bad destination system ·
 * 5.1.3 bad mailbox address syntax · 5.1.10 recipient address has a null MX.
 *
 * Deliberately absent: 5.2.x (mailbox exists but is full or disabled), 5.3.4
 * (message too large), 5.7.x (policy / access denied — a real mailbox behind a
 * filter), and every 4.x.x, which is transient by definition.
 */
const NOT_FOUND_STATUSES = new Set(["5.1.1", "5.1.2", "5.1.3", "5.1.10"]);

export interface BounceReport {
  /** The address the DSN was reporting on, lowercased. */
  address: string;
  /** Enhanced status code, when the DSN carried one. */
  status: string | null;
  /** The human-readable marker, lowercased, when present. */
  marker: string | null;
  /** True only when the address itself is the problem. */
  notFound: boolean;
}

/** Lowercase, trimmed, angle brackets and a trailing dot removed. */
export function normalizeEmail(value: string | null | undefined): string {
  if (!value) return "";
  const text = value.trim().toLowerCase();
  // "Name <a@b.com>" → "a@b.com"; the sync stores bare addresses, but a DSN's
  // Final-Recipient sometimes wraps them.
  const angled = /<([^>]+)>/.exec(text);
  const address = (angled ? angled[1] : text).replace(/[<>;,]/g, "").replace(/\.$/, "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : "";
}

/**
 * Read a delivery-status notification, if that is what this body is.
 *
 * Returns null for ordinary mail, so the caller can hand it every message
 * without pre-filtering.
 */
export function parseBounce(bodyText: string | null | undefined): BounceReport | null {
  if (!bodyText) return null;
  const recipient = /Final-Recipient:\s*rfc822;\s*([^\s]+)/i.exec(bodyText);
  if (!recipient) return null;

  const address = normalizeEmail(recipient[1]);
  if (!address) return null;

  const statusMatch = /Status:\s*([245]\.\d+\.\d+)/i.exec(bodyText);
  const status = statusMatch ? statusMatch[1] : null;

  const markerMatch = /\*\*\s*([^*]{3,80}?)\s*\*\*/.exec(bodyText);
  const marker = markerMatch ? markerMatch[1].trim().toLowerCase() : null;

  const notFound =
    (marker != null && NOT_FOUND_MARKERS.includes(marker)) ||
    (status != null && NOT_FOUND_STATUSES.has(status));

  return { address, status, marker, notFound };
}

/* ────────────────────────────── Names ────────────────────────────── */

/** Local parts that name a desk, not a person. */
const ROLE_LOCAL_PARTS = new Set([
  "info", "sales", "contact", "contacts", "hello", "office", "mail", "admin",
  "support", "help", "enquiries", "inquiries", "commerciale", "amministrazione",
  "marketing", "purchasing", "acquisti", "export", "rd", "quality", "qa",
  "team", "team1", "kontakt", "ventas", "vendas", "welcome", "general",
]);

/**
 * Honorifics, with the abbreviating dot swallowed by the same match.
 *
 * The trailing `\.?` is load-bearing: `\b(dr|dr\.)\b` matches the "Dr" in
 * "Dr. Sabrina" and leaves the dot behind as its own token, which then becomes
 * the first name.
 */
const NAME_NOISE = /\b(?:dr|ing|mr|mrs|ms|mister|prof|sig|sig\.ra|eng|arch|avv)\b\.?/gi;

export interface DerivedName {
  firstName: string;
  lastName: string;
}

const titleCase = (word: string): string =>
  word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();

/**
 * A person's name for an address, from the best evidence available.
 *
 * The order is evidence-first: a display name the person chose themselves beats
 * anything guessable from the address. When there is no display name, a local
 * part with a separator ("rob.burston") is a reliable second. Everything else
 * keeps the local part as-is and leaves the surname empty — which is exactly
 * what the existing hand-entered rows do for desk addresses (`info` / ``), so
 * the imported rows are indistinguishable from the ones already there.
 */
export function deriveContactName(
  displayName: string | null | undefined,
  email: string,
): DerivedName {
  const address = normalizeEmail(email);
  const local = address.slice(0, address.indexOf("@")) || address;

  const cleaned = (displayName ?? "")
    .replace(/["']/g, "")
    .replace(NAME_NOISE, "")
    .trim();

  // "Rossi, Mario" — some corporate directories write it surname-first.
  const commaSplit = cleaned.includes(",") ? cleaned.split(",").map((p) => p.trim()) : null;
  const ordered =
    commaSplit && commaSplit.length === 2 && commaSplit[0] && commaSplit[1]
      ? `${commaSplit[1]} ${commaSplit[0]}`
      : cleaned;

  // A display name that is just the address again tells us nothing.
  const usable = ordered && normalizeEmail(ordered) !== address ? ordered : "";
  if (usable) {
    // Tokens must contain a letter or digit — stripping an honorific can leave
    // stray punctuation behind, and "." is not a first name.
    const parts = usable.split(/\s+/).filter((part) => /[\p{L}\p{N}]/u.test(part));
    if (parts.length >= 2) {
      return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
    }
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  }

  if (!ROLE_LOCAL_PARTS.has(local)) {
    const parts = local.split(/[._-]+/).filter(Boolean);
    // Two word-ish parts, neither of them a lone initial-with-digits, reads as
    // firstname.lastname. "a.bulgarelli" keeps the initial as the first name,
    // which is the honest rendering of what we actually know.
    if (parts.length >= 2 && parts.every((p) => /^[a-z]+$/.test(p))) {
      return {
        firstName: titleCase(parts[0]),
        lastName: parts.slice(1).map(titleCase).join(" "),
      };
    }
  }

  return { firstName: local, lastName: "" };
}

/* ────────────────────────────── The plan ────────────────────────────── */

export interface HarvestCandidate {
  email: string;
  companyId: string;
  /** Best display name seen for this address, across every message. */
  displayName: string | null;
  /** How many messages this address appeared in. */
  messageCount: number;
  /** Newest message involving it. */
  lastSeenAt: Date | string;
  /** True when we have only ever written TO it, never heard back. */
  outboundOnly: boolean;
}

export type HarvestSkipReason =
  | "already_a_contact"
  | "address_not_found"
  | "own_domain"
  | "infrastructure"
  | "invalid";

export type HarvestAction =
  | {
      kind: "create";
      email: string;
      companyId: string;
      firstName: string;
      lastName: string;
      lastSeenAt: Date | string;
    }
  | { kind: "skip"; email: string; reason: HarvestSkipReason };

export interface HarvestContext {
  /** Addresses already on a Contact row, lowercased. */
  existingEmails: ReadonlySet<string>;
  /** Addresses Gmail reported as not found, lowercased. */
  notFoundEmails: ReadonlySet<string>;
  /** Our own domains — a colleague is not a contact. */
  ownDomains: ReadonlySet<string>;
}

/**
 * What to do about one harvested address.
 *
 * `address_not_found` is checked before anything else that could create a row:
 * the instruction is to verify against Gmail *before* adding, and putting the
 * check anywhere later would mean a reordering of this function could quietly
 * start writing dead addresses.
 */
export function planContactImport(
  candidate: HarvestCandidate,
  context: HarvestContext,
): HarvestAction {
  const email = normalizeEmail(candidate.email);
  if (!email) return { kind: "skip", email: candidate.email, reason: "invalid" };

  if (context.notFoundEmails.has(email)) {
    return { kind: "skip", email, reason: "address_not_found" };
  }

  const domain = registrableDomainOf(email);
  if (context.ownDomains.has(domain)) return { kind: "skip", email, reason: "own_domain" };
  if (isInfrastructureDomain(domain)) return { kind: "skip", email, reason: "infrastructure" };

  if (context.existingEmails.has(email)) {
    return { kind: "skip", email, reason: "already_a_contact" };
  }

  const { firstName, lastName } = deriveContactName(candidate.displayName, email);
  return {
    kind: "create",
    email,
    companyId: candidate.companyId,
    firstName,
    lastName,
    lastSeenAt: candidate.lastSeenAt,
  };
}
