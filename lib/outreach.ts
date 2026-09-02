/**
 * Turning outbound mail into company records. The pure half.
 *
 * The CRM only ever learned about a company when somebody wrote *to us*, or
 * when an NDA arrived as an attachment (see the comment in
 * lib/backend/gmail-sync.ts). Cold outreach that never got a reply left no
 * trace at all: on production, 519 outbound messages reached 272 domains, and
 * 157 of those domains had no company row — McCain with 30 messages, Fonterra
 * with 15, Chobani with 9.
 *
 * That gap is the point of this module. It also answers a question the mailbox
 * cannot: everything is sent from the shared `ad@italprotein.com`, so `From`
 * says nothing about *who* did the outreach. The only record of that is the
 * signature at the bottom of the message.
 *
 * No Prisma import, so every rule here is testable without a database.
 */

import {
  FREEMAIL_DOMAINS,
  isFreemailDomain,
  isInfrastructureDomain,
  normalizeDomain,
  registrableDomainOf,
} from "@/lib/email-entity";

/* ────────────────────────────── Who sent it ────────────────────────────── */

/**
 * The people who sign Italprotein's outreach.
 *
 * Matched on the signature block because the shared mailbox erases the author:
 * every message has `From: ad@italprotein.com`, and on production 312 were
 * signed by Giuseppe and 178 by Amine. Without this, every one of those 490
 * would be attributed to nobody.
 *
 * Keyed by the name as it appears in the signature; `email` is what the
 * importer resolves to a User row, so a rename in the CRM does not need a code
 * change here.
 */
export const OUTREACH_AGENTS: readonly { signature: string; email: string }[] = [
  { signature: "Giuseppe Minelli", email: "giuseppeminelli@wefin.it" },
  { signature: "Amine Abidi", email: "labidimedamine53@gmail.com" },
  // The signature sometimes carries only the first name.
  { signature: "Amine", email: "labidimedamine53@gmail.com" },
];

/**
 * Which agent signed this message, by their name in the body.
 *
 * Longest signature first, so "Amine Abidi" is never shadowed by the bare
 * "Amine" entry that exists to catch the short form.
 */
export function agentFromSignature(bodyText: string | null | undefined): string | null {
  const body = (bodyText ?? "").toLowerCase();
  if (!body) return null;
  const byLength = [...OUTREACH_AGENTS].sort(
    (a, b) => b.signature.length - a.signature.length,
  );
  for (const agent of byLength) {
    if (body.includes(agent.signature.toLowerCase())) return agent.email;
  }
  return null;
}

/* ────────────────────────────── Who counts ────────────────────────────── */

/**
 * Our own domains. `wefin.it` is here because it is the parent company's, not a
 * prospect's — mail to it is internal, however external the address looks.
 */
export const OWN_DOMAINS: ReadonlySet<string> = new Set([
  "italprotein.com",
  "proamina.com",
  "wefin.it",
]);

/**
 * Companies we email as suppliers, not as prospects.
 *
 * The existing infrastructure list catches relays and bounce hosts; these are
 * real businesses with real websites that simply are not customers. Couriers
 * are the whole of it today, and they are already named in the shipment
 * tracking sync — this is the same list from the other direction.
 */
export const SERVICE_DOMAINS: ReadonlySet<string> = new Set([
  "dhl.com",
  "brt.it",
  "poste.it",
  "sda.it",
  "ups.com",
  "fedex.com",
  "gls-group.eu",
  "tnt.com",
]);

/**
 * Consumer ISP mailboxes that behave like freemail but are not on the shared
 * freemail list, which is oriented at the big webmail providers.
 */
const ISP_DOMAINS: ReadonlySet<string> = new Set([
  "verizon.net",
  "comcast.net",
  "btinternet.com",
  "orange.fr",
  "tin.it",
  "libero.it",
  "alice.it",
]);

export type OutreachVerdict = "create" | "link" | "ignore";

export type OutreachIgnoreReason =
  | "no-domain"
  | "own-domain"
  | "freemail"
  | "isp-mailbox"
  | "infrastructure"
  | "service-provider"
  | "investor"
  | "suppressed";

export interface OutreachInput {
  /** A recipient address from an outbound message. */
  email: string;
  /** Registrable domains already attached to a company. */
  knownDomains: ReadonlySet<string>;
  /** Registrable domains belonging to rows in the investor register. */
  investorDomains: ReadonlySet<string>;
  /** Domains on the SuppressedEntity register. */
  suppressedDomains: ReadonlySet<string>;
}

export interface OutreachClassification {
  verdict: OutreachVerdict;
  domain: string;
  reason?: OutreachIgnoreReason;
}

/**
 * Should this recipient become a company?
 *
 * The asymmetry with `classifyEmailEntity` is deliberate and is what makes
 * creating from outbound mail safe where creating from inbound mail is not:
 * *we* chose to send this. A person at Italprotein typed or selected the
 * address, which is far stronger evidence of a real prospect than an
 * unsolicited message arriving. So there is no scoring here — only a list of
 * things a recipient can be that is not a prospect.
 *
 * Investors are excluded from data, not from a hardcoded list: they live in
 * their own table precisely so no commercial machinery attaches to them, and
 * that separation has to survive this importer.
 */
export function classifyOutreachRecipient(input: OutreachInput): OutreachClassification {
  const email = (input.email ?? "").trim().toLowerCase();
  const raw = email.includes("@") ? normalizeDomain(email.slice(email.lastIndexOf("@") + 1)) : "";
  const domain = registrableDomainOf(email);
  if (!domain) return { verdict: "ignore", domain: raw, reason: "no-domain" };

  if (OWN_DOMAINS.has(domain)) return { verdict: "ignore", domain, reason: "own-domain" };
  if (isFreemailDomain(domain) || FREEMAIL_DOMAINS.has(domain)) {
    return { verdict: "ignore", domain, reason: "freemail" };
  }
  if (ISP_DOMAINS.has(domain)) return { verdict: "ignore", domain, reason: "isp-mailbox" };
  if (isInfrastructureDomain(raw)) return { verdict: "ignore", domain, reason: "infrastructure" };
  if (SERVICE_DOMAINS.has(domain)) return { verdict: "ignore", domain, reason: "service-provider" };
  if (input.investorDomains.has(domain)) return { verdict: "ignore", domain, reason: "investor" };
  if (input.suppressedDomains.has(domain)) return { verdict: "ignore", domain, reason: "suppressed" };

  if (input.knownDomains.has(domain)) return { verdict: "link", domain };
  return { verdict: "create", domain };
}

/* ────────────────────────────── What to call it ────────────────────────────── */

/**
 * Words that get run together in a domain and read badly capitalised as one.
 *
 * `organisationNameFromDomain` gives "Dawnfoods" and "Schreiberfoods"; the
 * company name is the primary display field on 150-odd new rows, so it is
 * worth splitting the handful of suffixes that account for most of them.
 * Longest first, so "beverages" wins before "ages" could.
 */
const NAME_SUFFIXES = [
  "beverages", "ingredients", "industries", "distribution", "international",
  "confectionery", "manufacturing", "nutrition", "chemicals", "products",
  "biscuits", "dairies", "industry", "product", "biscuit", "brands", "bakery",
  "snacks", "dairy", "foods", "group", "mills", "farms", "brand", "snack",
  "food", "milk", "farm", "mill",
]
  // Sorted here rather than maintained by hand: a shorter suffix listed first
  // would win over a longer one and split "beverages" at "ages".
  .slice()
  .sort((a, b) => b.length - a.length);

/** Prefixes whose following letter is capitalised in the real name. */
const NAME_PREFIXES = ["mc", "mac", "de", "van"] as const;

const titleCase = (word: string): string =>
  word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();

/**
 * A readable company name from a domain.
 *
 * Best-effort and openly a guess: it is a placeholder for a human to correct,
 * not an assertion. `mccain.com` becomes "McCain" and `dawnfoods.com` becomes
 * "Dawn Foods", but nothing here can know that `gupuds.com` is "GupuDS".
 */
export function companyNameFromDomain(domain: string | null | undefined): string | null {
  const registrable = registrableDomainOf(domain);
  if (!registrable || isFreemailDomain(registrable)) return null;

  const labels = registrable.split(".");
  // The organisation label, skipping a second-level suffix like `.co.uk`.
  let label = labels[labels.length - 2] ?? "";
  if (labels.length >= 3 && (label === "co" || label === "com" || label === "org")) {
    label = labels[labels.length - 3] ?? label;
  }
  if (!label) return null;

  const words = label.split(/[-_.]+/).filter(Boolean).flatMap((word) => {
    const lower = word.toLowerCase();
    for (const suffix of NAME_SUFFIXES) {
      if (lower.length > suffix.length + 2 && lower.endsWith(suffix)) {
        return [lower.slice(0, -suffix.length), suffix];
      }
    }
    return [lower];
  });

  return words
    .map((word) => {
      for (const prefix of NAME_PREFIXES) {
        if (word.length > prefix.length + 1 && word.startsWith(prefix)) {
          return titleCase(prefix) + titleCase(word.slice(prefix.length));
        }
      }
      return titleCase(word);
    })
    .join(" ")
    .trim() || null;
}

/**
 * Country from the domain's ccTLD.
 *
 * Only a country-code TLD says anything; `.com` and `.net` say nothing and
 * yield null rather than a guess. The list covers the TLDs the mailbox
 * actually contains plus the obvious neighbours.
 */
const CCTLD_COUNTRIES: Record<string, { code: string; name: string }> = {
  au: { code: "AU", name: "Australia" },
  nz: { code: "NZ", name: "New Zealand" },
  uk: { code: "GB", name: "United Kingdom" },
  it: { code: "IT", name: "Italy" },
  ch: { code: "CH", name: "Switzerland" },
  de: { code: "DE", name: "Germany" },
  fr: { code: "FR", name: "France" },
  es: { code: "ES", name: "Spain" },
  pt: { code: "PT", name: "Portugal" },
  nl: { code: "NL", name: "Netherlands" },
  be: { code: "BE", name: "Belgium" },
  at: { code: "AT", name: "Austria" },
  se: { code: "SE", name: "Sweden" },
  no: { code: "NO", name: "Norway" },
  dk: { code: "DK", name: "Denmark" },
  fi: { code: "FI", name: "Finland" },
  pl: { code: "PL", name: "Poland" },
  cz: { code: "CZ", name: "Czechia" },
  gr: { code: "GR", name: "Greece" },
  tr: { code: "TR", name: "Türkiye" },
  ie: { code: "IE", name: "Ireland" },
  ca: { code: "CA", name: "Canada" },
  us: { code: "US", name: "United States" },
  mx: { code: "MX", name: "Mexico" },
  br: { code: "BR", name: "Brazil" },
  co: { code: "CO", name: "Colombia" },
  ar: { code: "AR", name: "Argentina" },
  in: { code: "IN", name: "India" },
  th: { code: "TH", name: "Thailand" },
  sg: { code: "SG", name: "Singapore" },
  my: { code: "MY", name: "Malaysia" },
  jp: { code: "JP", name: "Japan" },
  cn: { code: "CN", name: "China" },
  kr: { code: "KR", name: "South Korea" },
  ae: { code: "AE", name: "United Arab Emirates" },
  sa: { code: "SA", name: "Saudi Arabia" },
  qa: { code: "QA", name: "Qatar" },
  kw: { code: "KW", name: "Kuwait" },
  bh: { code: "BH", name: "Bahrain" },
  om: { code: "OM", name: "Oman" },
  eg: { code: "EG", name: "Egypt" },
  tn: { code: "TN", name: "Tunisia" },
  ma: { code: "MA", name: "Morocco" },
  za: { code: "ZA", name: "South Africa" },
  il: { code: "IL", name: "Israel" },
};

export function countryFromDomain(
  domain: string | null | undefined,
): { code: string; name: string } | null {
  const registrable = registrableDomainOf(domain);
  if (!registrable) return null;
  const tld = registrable.slice(registrable.lastIndexOf(".") + 1);
  return CCTLD_COUNTRIES[tld] ?? null;
}

/** Two-letter monogram for the avatar tile, matching the existing rows. */
export function initialsFromName(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
