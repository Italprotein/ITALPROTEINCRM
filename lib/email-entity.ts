/**
 * Who is on the other end of this email, and is it an organisation at all?
 *
 * The pure half of Gmail→company reconciliation: normalisation, a registrable-
 * domain reducer, the infrastructure blocklist, and a transparent scorer whose
 * every rule names itself in the returned `evidence`. Deliberately free of any
 * Prisma import (lib/backend/prisma.ts throws at module load when DATABASE_URL
 * is unset) so it can be unit-tested with no database — the same split as
 * lib/company-logo.ts and lib/nda-current.ts.
 *
 * It exists because both directions were wrong in production on 2026-08-27:
 *
 *  - Four duplicate "Pphosted" companies, created 2026-08-24 from
 *    mailer-daemon@mx0a-0025e601.pphosted.com — Proofpoint bounces handing our
 *    OWN NDA attachment back to us. The sync's only test was "external sender,
 *    non-freemail domain, NDA-looking attachment", and a bounce passes all
 *    three.
 *  - 25 emails from three humans at bulla.com.au linked to nothing, because
 *    ordinary correspondence carries no attachment and the sync only ever
 *    looked at senders who attached an agreement.
 *
 * The evidence array is not decoration. It is written into the audit event that
 * accompanies every auto-created company, so the answer to "why does this row
 * exist" is a lookup rather than an archaeology exercise.
 */

/**
 * Second-level registry labels: a domain whose penultimate label is one of
 * these needs three labels to be registrable ("bulla.com.au", not "com.au").
 *
 * Deliberately the same short list gmail-sync's company naming has always
 * used rather than a bundled public-suffix database — this repo takes no new
 * dependency for this, and a wrong answer here costs a slightly odd company
 * name, not a wrong link (links go through the exact-match CompanyDomain
 * register).
 */
export const SECOND_LEVEL_DOMAIN_LABELS: ReadonlySet<string> = new Set([
  'co',
  'com',
  'org',
  'net',
  'gov',
  'ac',
  'edu',
]);

/**
 * Consumer mailboxes. A person, never an organisation: "Gmail" must never
 * become a company row, which is the same mistake as "Pphosted" wearing a
 * friendlier face. Moved here verbatim from lib/backend/gmail-sync.ts so the
 * sync and the scorer cannot drift apart.
 */
export const FREEMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.it',
  'hotmail.com',
  'hotmail.it',
  'live.com',
  'live.it',
  'yahoo.com',
  'yahoo.it',
  'libero.it',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.de',
  'mail.com',
  'msn.com',
  'tiscali.it',
  'virgilio.it',
  'alice.it',
  'tin.it',
]);

/**
 * Domains that carry mail rather than send it: bounce handlers, relays,
 * filtering gateways and bulk-send platforms. Matched as a SUFFIX, so
 * `mx0a-0025e601.pphosted.com` and `eur01-he1-obe.outbound.protection.outlook.com`
 * both hit while `outlook.com` — freemail, and a different rule's business —
 * does not.
 *
 * This is a seed list, not a claim to completeness. The operational escape
 * hatch is the SuppressedEntity table: an operator adds tomorrow's relay there
 * without a deploy, and the caller passes `isSuppressed`.
 */
export const INFRASTRUCTURE_DOMAINS: ReadonlySet<string> = new Set([
  // Proofpoint — the four duplicate companies came from here.
  'pphosted.com',
  'proofpoint.com',
  // Bulk senders.
  'mailgun.org',
  'mailgun.net',
  'sendgrid.net',
  'amazonses.com',
  'mailchimp.com',
  'mcsv.net',
  'rsgsv.net',
  'list-manage.com',
  'sparkpostmail.com',
  'mandrillapp.com',
  'postmarkapp.com',
  'mtasv.net',
  'hubspotemail.net',
  'exacttarget.com',
  'exct.net',
  // Gateways and filters.
  'mimecast.com',
  'barracuda.com',
  'barracudanetworks.com',
  'messagelabs.com',
  'protection.outlook.com',
  'bounces.google.com',
  // Ticketing / list software that relays on someone else's behalf.
  'zendesk.com',
  'lsoft.com',
]);

/**
 * Local parts that belong to a mailbox nobody reads. Compared after `.`, `-`
 * and `_` are removed, so `no-reply`, `no.reply` and `noreply` are one rule.
 *
 * This overlaps lib/investor/auto-reply.ts on purpose and does not replace it:
 * that module answers "did a machine send this particular message", which is a
 * per-message question about headers and subject. This list answers "is this
 * address a robot's", which stays true for every message it ever sends.
 */
const NO_REPLY_LOCAL_PREFIXES: readonly string[] = [
  'noreply',
  'donotreply',
  'nonrispondere',
  'mailerdaemon',
  'postmaster',
  'bounce',
  'autoreply',
  'autoresponder',
  'notification',
  'notifications',
  'newsletter',
  'unsubscribe',
];

/** Display names that are a program announcing itself, not a person. */
const ROBOT_SENDER_NAMES: ReadonlySet<string> = new Set([
  'maildeliverysubsystem',
  'maildeliverysystem',
  'mailerdaemon',
  'postmaster',
  'automaticreply',
  'autoreply',
  'noreply',
  'donotreply',
  'notification',
  'notifications',
  'internetmailservice',
  'microsoftoutlook',
]);

// ── Normalisation ──────────────────────────────────────────────────────────

/** Lowercase, trimmed, `www.` and a trailing dot removed. */
export function normalizeDomain(domain: string | null | undefined): string {
  if (!domain) return '';
  return domain
    .trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\.+$/, '');
}

/**
 * Lowercase, accent-folded, punctuation-free, single-spaced.
 *
 * This is the value stored in CompanyAlias.normalizedName and compared against,
 * so "Regal Cream Products Pty. Ltd." and "regal cream products pty ltd" are
 * one name and cannot produce two companies.
 */
export function normalizeEntityName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The registrable base of an email address or a bare host.
 *
 * `mx0a-0025e601.pphosted.com` → `pphosted.com` is the whole point: the bounce
 * host is unique per message, so anything keyed on the raw domain — a
 * suppression entry, a CompanyDomain row, a duplicate check — matches nothing
 * and every bounce looks like a brand-new organisation. Four times, in three
 * days, on production.
 */
export function registrableDomainOf(emailOrDomain: string | null | undefined): string {
  if (!emailOrDomain) return '';
  const raw = emailOrDomain.includes('@')
    ? emailOrDomain.slice(emailOrDomain.lastIndexOf('@') + 1)
    : emailOrDomain;
  const domain = normalizeDomain(raw);
  const labels = domain.split('.').filter(Boolean);
  if (labels.length < 2) return '';
  if (labels.length >= 3 && SECOND_LEVEL_DOMAIN_LABELS.has(labels[labels.length - 2])) {
    return labels.slice(-3).join('.');
  }
  return labels.slice(-2).join('.');
}

/** True when the domain, or any parent of it, is mail infrastructure. */
export function isInfrastructureDomain(domain: string | null | undefined): boolean {
  const value = domain?.includes('@') ? domain.slice(domain.lastIndexOf('@') + 1) : domain;
  const normalized = normalizeDomain(value);
  if (!normalized) return false;
  const labels = normalized.split('.').filter(Boolean);
  // Walk every suffix: this covers the registrable base and also multi-label
  // entries such as protection.outlook.com, which collapsing to two labels
  // would have widened into "all of outlook.com".
  for (let i = 0; i < labels.length - 1; i += 1) {
    if (INFRASTRUCTURE_DOMAINS.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

/** True when the address belongs to a consumer mailbox provider. */
export function isFreemailDomain(domain: string | null | undefined): boolean {
  const registrable = registrableDomainOf(domain);
  return registrable !== '' && FREEMAIL_DOMAINS.has(registrable);
}

/**
 * "acme-foods.com" → "Acme Foods". Always computed from the REGISTRABLE base,
 * which is what keeps a bounce host from being christened "Mx0a 0025e601".
 * Returns null for freemail: a consumer mailbox names a person, not a company.
 */
export function organisationNameFromDomain(domain: string | null | undefined): string | null {
  const registrable = registrableDomainOf(domain);
  if (!registrable || FREEMAIL_DOMAINS.has(registrable)) return null;
  const labels = registrable.split('.');
  let label = labels[labels.length - 2];
  if (labels.length >= 3 && SECOND_LEVEL_DOMAIN_LABELS.has(label)) label = labels[labels.length - 3];
  if (!label) return null;
  const pretty = label
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return pretty || null;
}

function hasNoReplyLocalPart(email: string): boolean {
  const local = email.split('@')[0]?.replace(/[.\-_]/g, '') ?? '';
  if (!local) return false;
  return NO_REPLY_LOCAL_PREFIXES.some((prefix) => local.startsWith(prefix));
}

/** A display name a person could have typed — not a program announcing itself. */
function hasHumanSenderName(name: string | null | undefined): boolean {
  const trimmed = (name ?? '').trim();
  if (trimmed.length < 2) return false;
  if (!/[a-z]/i.test(trimmed)) return false;
  // Many clients fall back to the address itself when there is no display name.
  if (trimmed.includes('@')) return false;
  return !ROBOT_SENDER_NAMES.has(normalizeEntityName(trimmed).replace(/\s+/g, ''));
}

// ── The scorer ─────────────────────────────────────────────────────────────

/**
 * Score at which a sender may become a company row without a human deciding.
 * Reachable only through the NDA rule: an executed agreement is evidence of a
 * relationship, and no volume of ordinary correspondence substitutes for it.
 */
export const ENTITY_SCORE_CREATE = 3;

/** Score at which a sender is worth surfacing to a person. */
export const ENTITY_SCORE_CANDIDATE = 1;

export type EmailEntityVerdict = 'link_or_create' | 'candidate' | 'ignore';

export interface EmailEntityInput {
  /** The sender address. */
  fromEmail: string;
  /** The sender's display name, if the client sent one. */
  fromName?: string | null;
  /**
   * Subject and headers are carried so a caller hands this function the same
   * probe it gave the automation detector. The scorer deliberately does NOT
   * re-read them: `isAutomatedReply` is computed once, by the caller, with
   * lib/investor/auto-reply.ts, and re-deriving it here would be a second
   * detector free to disagree with the first.
   */
  subject?: string | null;
  headers?: Record<string, string | string[] | null | undefined> | null;
  /** From lib/investor/auto-reply.ts — the one automation detector. */
  isAutomatedReply: boolean;
  hasNdaAttachment: boolean;
  /** Inbound messages from this sender that a human wrote. Caller-counted. */
  humanReplyCount?: number;
  /** True when we have both written to and heard from this correspondent. */
  twoWay?: boolean;
  /** True when the caller found the domain in the SuppressedEntity register. */
  isSuppressed?: boolean;
}

export interface EmailEntityClassification {
  verdict: EmailEntityVerdict;
  score: number;
  /** Every rule that fired, in the order it fired. Stored on the audit event. */
  evidence: string[];
}

/**
 * Classify one inbound message's sender.
 *
 * The three hard rules run first and return immediately — automation,
 * suppression and infrastructure are disqualifications, not negative points,
 * because a point system lets strong positive evidence outvote them and strong
 * positive evidence is exactly what a bounce carrying our own NDA has.
 */
export function classifyEmailEntity(input: EmailEntityInput): EmailEntityClassification {
  const evidence: string[] = [];
  const ignore = (reason: string): EmailEntityClassification => ({
    verdict: 'ignore',
    score: 0,
    evidence: [...evidence, reason],
  });

  const email = (input.fromEmail ?? '').trim().toLowerCase();
  const domain = email.includes('@') ? normalizeDomain(email.slice(email.lastIndexOf('@') + 1)) : '';
  const registrable = registrableDomainOf(email);
  if (!domain || !registrable) return ignore('no-sender-domain');

  // 1. A machine sent this message.
  if (input.isAutomatedReply) return ignore('automated-sender');

  // 2. This domain carries mail; it is not a counterparty.
  if (input.isSuppressed) return ignore('suppressed-domain');
  if (isInfrastructureDomain(domain)) return ignore('infrastructure-domain');

  const human = hasHumanSenderName(input.fromName);

  // 3. An unattended mailbox with nobody's name on it.
  if (!human && hasNoReplyLocalPart(email)) return ignore('no-reply-localpart');

  const freemail = isFreemailDomain(registrable);
  if (freemail) evidence.push('freemail-domain');
  const businessDomain = !freemail;

  let score = 0;

  // 4. The strong signal, and the only route to an automatic company row.
  if (input.hasNdaAttachment && human && businessDomain) {
    score += 3;
    evidence.push('nda-attachment-from-human-business-domain');
  } else if (input.hasNdaAttachment) {
    // Kept as evidence, worth nothing: this is the freemail NDA the sync parks
    // unattributed rather than guessing at.
    evidence.push('nda-attachment-weak-sender');
  }

  // 5. Engagement, at most one rule and at most two points — so no amount of
  //    ordinary mail can reach ENTITY_SCORE_CREATE on its own.
  if (input.twoWay) {
    score += 2;
    evidence.push('two-way-correspondence');
  } else if ((input.humanReplyCount ?? 0) >= 2) {
    score += 2;
    evidence.push('repeated-inbound');
  } else if (human && businessDomain) {
    score += 1;
    evidence.push('cold-inbound-human-business-domain');
  }

  if (score >= ENTITY_SCORE_CREATE && businessDomain) {
    return { verdict: 'link_or_create', score, evidence };
  }
  if (score >= ENTITY_SCORE_CANDIDATE) return { verdict: 'candidate', score, evidence };
  return { verdict: 'ignore', score, evidence: [...evidence, 'no-engagement-signal'] };
}
