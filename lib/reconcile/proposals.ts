/**
 * What the reconciliation pass should DO — decided by pure functions.
 *
 * `scripts/reconcile-email-companies.ts` reads rows, calls everything here, and
 * prints the result; in `--apply` mode it also writes it. Splitting the decision
 * from the I/O is what makes the two production cases of 2026-08-27 testable
 * without a database:
 *
 *  - the FALSE NEGATIVE (25 emails from three humans at bulla.com.au linked to
 *    nothing, with a Lead row that nothing ever promoted), and
 *  - the FALSE POSITIVE (four "Pphosted" companies minted from Proofpoint
 *    bounces returning our own NDA attachment).
 *
 * Neither name appears below. Both fall out of general rules: the first from
 * "a domain with repeated human correspondence and an existing lead is a
 * candidate", the second from "a gmail-imported company named after a piece of
 * mail infrastructure, with nothing real filed under it, is not a company".
 *
 * No Prisma import — deliberately, and it is also what the dry-run guarantee
 * rests on: the module that decides literally cannot write.
 */

import {
  classifyEmailEntity,
  INFRASTRUCTURE_DOMAINS,
  isFreemailDomain,
  isInfrastructureDomain,
  normalizeDomain,
  normalizeEntityName,
  organisationNameFromDomain,
  registrableDomainOf,
} from '@/lib/email-entity';

// ── Step 1: domains for companies that already exist ──────────────────────

/** One piece of evidence that a company owns a domain. */
export interface CompanyEmailDomainSource {
  companyId: string;
  /** `contact` = a contact's email address; `website` = the company's website column. */
  origin: 'contact' | 'website';
  /** The raw address or URL, exactly as stored. */
  value: string;
}

export interface DomainBackfillProposal {
  kind: 'PROPOSE-DOMAIN';
  domain: string;
  companyId: string;
  /** e.g. ["contact×3", "website×1"] — how many rows of each kind backed this. */
  origins: string[];
  evidence: string[];
}

/**
 * Two or more companies whose stored data claims the same domain.
 *
 * Reported and never resolved. A guessed answer here mislinks every future
 * message from that domain, and the register is the thing the Gmail sync trusts
 * most — one wrong row is worse than one unanswered question.
 */
export interface DomainCollision {
  kind: 'COLLISION';
  domain: string;
  companyIds: string[];
  evidence: string[];
}

export interface SkippedDomain {
  domain: string;
  reason: 'freemail' | 'infrastructure' | 'no-domain' | 'already-registered';
  companyIds: string[];
}

/** Pull the host out of an email address or a URL; returns '' when there isn't one. */
function hostOf(value: string): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  if (raw.includes('@')) return normalizeDomain(raw.slice(raw.lastIndexOf('@') + 1));
  // A website column holds anything from "acme.com" to "https://acme.com/x?y=1".
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const host = withoutScheme.split(/[/?#]/)[0] ?? '';
  return normalizeDomain(host);
}

export function proposeCompanyDomains(input: {
  sources: CompanyEmailDomainSource[];
  /** domain → companyId, as the register already holds it. */
  existingDomains: Record<string, string>;
}): {
  proposals: DomainBackfillProposal[];
  collisions: DomainCollision[];
  skipped: SkippedDomain[];
} {
  interface Bucket {
    host: string;
    byCompany: Map<string, { contact: number; website: number }>;
  }
  const buckets = new Map<string, Bucket>();

  for (const source of input.sources) {
    const host = hostOf(source.value);
    const registrable = registrableDomainOf(host);
    if (!registrable) continue;
    const bucket = buckets.get(registrable) ?? { host, byCompany: new Map() };
    const counts = bucket.byCompany.get(source.companyId) ?? { contact: 0, website: 0 };
    counts[source.origin] += 1;
    bucket.byCompany.set(source.companyId, counts);
    buckets.set(registrable, bucket);
  }

  const proposals: DomainBackfillProposal[] = [];
  const collisions: DomainCollision[] = [];
  const skipped: SkippedDomain[] = [];

  for (const [domain, bucket] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const companyIds = [...bucket.byCompany.keys()];
    // Order matters: a bounce host is never a company's domain, whoever's
    // contact row happens to carry it.
    if (isInfrastructureDomain(bucket.host) || isInfrastructureDomain(domain)) {
      skipped.push({ domain, reason: 'infrastructure', companyIds });
      continue;
    }
    if (isFreemailDomain(domain)) {
      skipped.push({ domain, reason: 'freemail', companyIds });
      continue;
    }
    if (input.existingDomains[domain]) {
      skipped.push({ domain, reason: 'already-registered', companyIds });
      continue;
    }
    if (companyIds.length > 1) {
      collisions.push({
        kind: 'COLLISION',
        domain,
        companyIds: [...companyIds].sort(),
        evidence: [`claimed-by-${companyIds.length}-companies`],
      });
      continue;
    }
    const companyId = companyIds[0];
    const counts = bucket.byCompany.get(companyId)!;
    const origins: string[] = [];
    if (counts.contact) origins.push(`contact×${counts.contact}`);
    if (counts.website) origins.push(`website×${counts.website}`);
    proposals.push({
      kind: 'PROPOSE-DOMAIN',
      domain,
      companyId,
      origins,
      evidence: ['unambiguous-single-company', ...origins],
    });
  }

  return { proposals, collisions, skipped };
}

// ── Step 2: stored mail nobody has linked ─────────────────────────────────

export interface DomainSenderAggregate {
  email: string;
  name: string | null;
  inboundCount: number;
  /** From lib/investor/auto-reply.ts, computed per message by the caller. */
  automated: boolean;
}

export interface UnlinkedDomainGroup {
  /** The REGISTRABLE domain — never the per-message bounce host. */
  domain: string;
  senders: DomainSenderAggregate[];
  inboundCount: number;
  outboundCount: number;
  hasNdaAttachment: boolean;
  /** Names of Lead rows already standing on this domain. */
  leadNames: string[];
  suppressed: boolean;
  /** Set when CompanyDomain already maps this domain — then there is nothing to decide. */
  companyIdForDomain: string | null;
}

export type DomainProposalKind =
  | 'PROPOSE-LINK'
  | 'PROPOSE-CREATE-CANDIDATE'
  | 'PROPOSE-SUPPRESS'
  | 'UNCERTAIN';

export interface DomainProposal {
  kind: DomainProposalKind;
  domain: string;
  companyId: string | null;
  messageCount: number;
  /** Addresses only. No subjects, no bodies — this ends up in a log file. */
  humanSenders: string[];
  score: number;
  strength: 'strong' | 'weak';
  evidence: string[];
  leadNames: string[];
}

/** A sender the scorer does not dismiss outright. */
function isHumanSender(domain: string, sender: DomainSenderAggregate): boolean {
  const verdict = classifyEmailEntity({
    fromEmail: sender.email,
    fromName: sender.name,
    isAutomatedReply: sender.automated,
    hasNdaAttachment: false,
    humanReplyCount: sender.inboundCount,
    twoWay: false,
    // Domain-level suppression and infrastructure are decided once, above, for
    // the whole group; asking again per sender would only duplicate the answer.
    isSuppressed: false,
  });
  void domain;
  return verdict.verdict !== 'ignore';
}

export function classifyUnlinkedDomain(group: UnlinkedDomainGroup): DomainProposal {
  const base = {
    domain: group.domain,
    messageCount: group.inboundCount,
    leadNames: group.leadNames,
  };

  if (group.companyIdForDomain) {
    return {
      ...base,
      kind: 'PROPOSE-LINK',
      companyId: group.companyIdForDomain,
      humanSenders: group.senders.map((s) => s.email),
      score: 0,
      strength: 'strong',
      evidence: ['domain-in-register'],
    };
  }

  const suppressed = (reason: string): DomainProposal => ({
    ...base,
    kind: 'PROPOSE-SUPPRESS',
    companyId: null,
    humanSenders: [],
    score: 0,
    strength: 'weak',
    evidence: [reason],
  });

  if (group.suppressed) return suppressed('suppressed-domain');
  if (isInfrastructureDomain(group.domain)) return suppressed('infrastructure-domain');

  const humans = group.senders.filter((sender) => isHumanSender(group.domain, sender));
  // An NDA attachment is not evidence of a counterparty when the only thing
  // that ever wrote to us was a program: that is precisely the bounce case.
  if (humans.length === 0) return suppressed('automated-senders-only');

  const humanInbound = humans.reduce((total, sender) => total + sender.inboundCount, 0);
  const loudest = humans.reduce((best, sender) => (sender.inboundCount > best.inboundCount ? sender : best));
  const classification = classifyEmailEntity({
    fromEmail: loudest.email,
    fromName: loudest.name,
    isAutomatedReply: false,
    hasNdaAttachment: group.hasNdaAttachment,
    humanReplyCount: humanInbound,
    twoWay: group.outboundCount > 0,
    isSuppressed: false,
  });

  const strength: 'strong' | 'weak' = classification.score >= 2 ? 'strong' : 'weak';
  const evidence = [...classification.evidence, `human-senders×${humans.length}`];
  if (group.leadNames.length) evidence.push('existing-lead');

  return {
    ...base,
    // A lead row means a person has already been shown this domain once. Keep
    // it and put the promotion controls in front of them rather than inventing
    // a company they never approved — no score reaches auto-creation here.
    kind: group.leadNames.length ? 'PROPOSE-CREATE-CANDIDATE' : 'UNCERTAIN',
    companyId: null,
    humanSenders: humans.map((sender) => sender.email),
    score: classification.score,
    strength,
    evidence,
  };
}

/** Every group, strongest evidence first — the report is read from the top. */
export function proposeUnlinkedDomains(groups: UnlinkedDomainGroup[]): DomainProposal[] {
  const RANK: Record<DomainProposalKind, number> = {
    'PROPOSE-CREATE-CANDIDATE': 0,
    UNCERTAIN: 1,
    'PROPOSE-LINK': 2,
    'PROPOSE-SUPPRESS': 3,
  };
  return groups
    .map(classifyUnlinkedDomain)
    .sort(
      (a, b) =>
        RANK[a.kind] - RANK[b.kind] ||
        b.score - a.score ||
        b.messageCount - a.messageCount ||
        a.domain.localeCompare(b.domain),
    );
}

// ── Step 3: names that look like one organisation wearing two rows ────────

export interface CompanyNameRow {
  companyId: string;
  name: string;
  source: 'legalName' | 'tradingName' | 'alias';
}

export interface AliasLinkProposal {
  kind: 'PROPOSE-ALIAS-LINK';
  normalizedName: string;
  companies: { companyId: string; name: string; source: string }[];
}

/**
 * Legal-form words. Stripped only from the END of a normalized name, so
 * "Bulla Dairy Foods Pty Ltd" and "Bulla Dairy Foods" compare equal while
 * "SA Foods" keeps its first word.
 */
const LEGAL_FORM_TOKENS: ReadonlySet<string> = new Set([
  'srl', 'srls', 'spa', 'snc', 'sas', 'sapa', 'ss',
  'ltd', 'limited', 'plc', 'llp', 'pty', 'pte',
  'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'llc',
  'gmbh', 'mbh', 'ag', 'kg', 'ohg', 'ug',
  'bv', 'nv', 'cv', 'sarl', 'sa', 'sl', 'slu', 'sau', 'lda',
  'ab', 'as', 'asa', 'oy', 'oyj', 'aps', 'kft', 'zoo', 'sp',
]);

/** The comparable core of a company name: normalized, legal form removed. */
export function companyNameKey(name: string): string {
  const tokens = normalizeEntityName(name).split(' ').filter(Boolean);
  while (tokens.length > 1 && LEGAL_FORM_TOKENS.has(tokens[tokens.length - 1])) tokens.pop();
  return tokens.join(' ');
}

export function proposeAliasLinks(rows: CompanyNameRow[]): AliasLinkProposal[] {
  const byKey = new Map<string, CompanyNameRow[]>();
  for (const row of rows) {
    const key = companyNameKey(row.name);
    // Two characters is not a company name, it is a coin flip.
    if (key.length < 3) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }

  const proposals: AliasLinkProposal[] = [];
  for (const [key, group] of [...byKey.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const companyIds = [...new Set(group.map((row) => row.companyId))];
    // One company holding several spellings of its own name is not a finding.
    if (companyIds.length < 2) continue;
    const seen = new Set<string>();
    proposals.push({
      kind: 'PROPOSE-ALIAS-LINK',
      normalizedName: key,
      companies: group
        .filter((row) => (seen.has(row.companyId) ? false : (seen.add(row.companyId), true)))
        .map((row) => ({ companyId: row.companyId, name: row.name, source: row.source })),
    });
  }
  return proposals;
}

// ── Step 4: companies the old bug invented ────────────────────────────────

export interface CompanyFactsRow {
  companyId: string;
  legalName: string;
  tradingName: string | null;
  tags: string[];
  /** ISO string. The oldest row is the one kept, so this decides the survivor. */
  createdAt: string;
  domains: string[];
  counts: Record<string, number>;
  /**
   * The NDA rows filed under this company. Carried so the proposal can name
   * them: on an infrastructure-born row every one of them was filed from a
   * bounce handing our own attachment back to us, and a fold moves them onto
   * the survivor rather than making them disappear.
   */
  ndaIds?: string[];
}

export interface FalseCompanyProposal {
  kind: 'PROPOSE-FALSE-COMPANY';
  infrastructureDomain: string;
  /**
   * The row everything is folded onto. Never invented — always an id that was
   * passed in — and NOT a row that has been cleared: it is still a company
   * named after a bounce handler, so it is reported for review too.
   */
  keepCompanyId: string;
  keepCompanyName: string;
  /** Rows for a HUMAN to delete. This module proposes; the script never deletes a company. */
  duplicateCompanyIds: string[];
  suppressDomain: string;
  evidence: string[];
  names: string[];
  /** NDAs already on the survivor, before anything is folded onto it. */
  survivorNdaCount: number;
  /** NDAs that the fold moves from the duplicates onto the survivor. */
  foldedNdaCount: number;
  /**
   * Every NDA id the survivor ends up holding. All bounce-born under this rule:
   * the sender that filed each one fails the automated/infrastructure test the
   * sync now applies, which is why these rows exist at all. Named so an
   * operator can find and judge them instead of inheriting them silently.
   */
  ndaIdsToReview: string[];
}

/** The tag `ensureCompanyForDomain` stamps on everything it creates. */
export const AUTO_IMPORT_TAG = 'gmail-import';

/**
 * Counts that mean a person has actually worked with this company. NDAs and
 * email messages are deliberately absent: the bounce carried our own NDA back
 * to us, and the resulting NDA row is the artefact of the bug, not evidence
 * against it.
 */
const REAL_DATA_KEYS = [
  'contacts',
  'quotes',
  'orders',
  'invoices',
  'sampleRequests',
  'shipments',
  'opportunities',
  'documents',
  'feedbacks',
  'projects',
  'meetings',
  'tasks',
] as const;

/** normalized company-name label → the infrastructure domain that produces it. */
function infrastructureLabels(): Map<string, string> {
  const labels = new Map<string, string>();
  for (const domain of INFRASTRUCTURE_DOMAINS) {
    const label = normalizeEntityName(organisationNameFromDomain(domain) ?? '');
    if (label && !labels.has(label)) labels.set(label, domain);
  }
  return labels;
}

/**
 * The mail-infrastructure domain a company row is an artefact of, or null.
 *
 * Either the row is NAMED after a relay — `companyNameFromDomain('…pphosted.com')`
 * produced "Pphosted" four times in three days — or it has claimed one as its
 * domain. Both are the same mistake seen from different sides.
 *
 * Exported so a caller can cheaply pre-select candidates before paying for the
 * per-company counts that `proposeFalseCompanies` needs.
 */
export function infrastructureDomainForCompany(row: { legalName: string; domains: string[] }): string | null {
  const registered = row.domains.map(registrableDomainOf).find((d) => d && isInfrastructureDomain(d));
  if (registered) return registered;
  return infrastructureLabels().get(normalizeEntityName(row.legalName)) ?? null;
}

export function proposeFalseCompanies(rows: CompanyFactsRow[]): FalseCompanyProposal[] {
  const byDomain = new Map<string, CompanyFactsRow[]>();

  for (const row of rows) {
    if (!row.tags.includes(AUTO_IMPORT_TAG)) continue;
    if (REAL_DATA_KEYS.some((key) => (row.counts[key] ?? 0) > 0)) continue;
    const domain = infrastructureDomainForCompany(row);
    if (!domain) continue;
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), row]);
  }

  return [...byDomain.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([domain, group]) => {
      const ordered = [...group].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.companyId.localeCompare(b.companyId),
      );
      const [keep, ...duplicates] = ordered;
      const ndasOf = (row: CompanyFactsRow) => row.ndaIds ?? [];
      const foldedNdaIds = duplicates.flatMap(ndasOf);
      return {
        kind: 'PROPOSE-FALSE-COMPANY' as const,
        infrastructureDomain: domain,
        keepCompanyId: keep.companyId,
        keepCompanyName: keep.legalName,
        duplicateCompanyIds: duplicates.map((row) => row.companyId),
        suppressDomain: domain,
        names: ordered.map((row) => row.legalName),
        // Counted from the ids when the caller supplied them, and from the
        // `ndas` count when it did not — the count is always present.
        survivorNdaCount: keep.ndaIds ? keep.ndaIds.length : (keep.counts.ndas ?? 0),
        foldedNdaCount: duplicates.reduce(
          (total, row) => total + (row.ndaIds ? row.ndaIds.length : (row.counts.ndas ?? 0)),
          0,
        ),
        ndaIdsToReview: [...ndasOf(keep), ...foldedNdaIds],
        evidence: [
          `tagged-${AUTO_IMPORT_TAG}`,
          'named-after-mail-infrastructure',
          'no-real-linked-data',
          `rows×${ordered.length}`,
        ],
      };
    });
}
