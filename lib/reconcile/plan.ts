/**
 * The four reconciliation passes, reading through an injected port.
 *
 * This lived inside scripts/reconcile-email-companies.ts until a review found a
 * `const` being reassigned in it — a crash on EVERY run, dry and apply, that
 * nothing caught: `tsconfig.json` excluded `scripts/`, so `npm run typecheck`
 * never read the file, and the only test parsed the source as text instead of
 * executing it.
 *
 * Two things follow from that, and both are the point of this module:
 *
 *  1. It lives under `lib/`, which IS typechecked. The same bug is now a
 *     compile error.
 *  2. Every database read goes through `ReconcileReader`, so a test can supply
 *     plain rows and RUN all four passes end to end. A crash in this code is a
 *     failing test, not a surprise on the operator's terminal.
 *
 * The script keeps only what a script should have: argv, wiring, printing, and
 * the writes.
 */

import { isAutomatedReply } from '@/lib/investor/auto-reply';
import { isFreemailDomain, registrableDomainOf } from '@/lib/email-entity';
import {
  infrastructureDomainForCompany,
  proposeAliasLinks,
  proposeCompanyDomains,
  proposeFalseCompanies,
  proposeUnlinkedDomains,
  type AliasLinkProposal,
  type CompanyEmailDomainSource,
  type CompanyFactsRow,
  type CompanyNameRow,
  type DomainBackfillProposal,
  type DomainCollision,
  type DomainProposal,
  type FalseCompanyProposal,
  type SkippedDomain,
  type UnlinkedDomainGroup,
} from './proposals';

/** Our own mailbox domain. The same constant the Gmail sync excludes. */
export const ORG_DOMAIN = 'italprotein.com';

/** The `gmail-import` tag `ensureCompanyForDomain` stamps on what it creates. */
export const AUTO_IMPORT_TAG = 'gmail-import';

// ── The port ───────────────────────────────────────────────────────────────

export interface ReconcileMessage {
  id: string;
  direction: string;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  companyId: string | null;
  ndaDetected: boolean;
}

export interface ReconcileCandidateCompany {
  id: string;
  legalName: string;
  tradingName: string | null;
  tags: string[];
  createdAt: Date;
  domains: string[];
}

/**
 * Every read the passes need. Implemented once against Prisma by the script,
 * and once against literals by the tests.
 */
export interface ReconcileReader {
  companyDomains(): Promise<{ domain: string; companyId: string }[]>;
  suppressedDomains(): Promise<string[]>;
  contactAddresses(): Promise<{ companyId: string; email: string; secondaryEmail: string | null }[]>;
  companyWebsites(): Promise<{ id: string; website: string | null }[]>;
  messages(): Promise<ReconcileMessage[]>;
  leads(): Promise<{ companyName: string; sourceDomain: string | null }[]>;
  companyNames(): Promise<{ id: string; legalName: string; tradingName: string | null }[]>;
  aliases(): Promise<{ companyId: string; name: string }[]>;
  autoImportedCompanies(): Promise<ReconcileCandidateCompany[]>;
  companyCounts(companyId: string): Promise<Record<string, number>>;
  companyNdaIds(companyId: string): Promise<string[]>;
}

// ── Loading ────────────────────────────────────────────────────────────────

export async function loadDomainRegister(reader: ReconcileReader): Promise<Map<string, string>> {
  const rows = await reader.companyDomains();
  return new Map(rows.map((row) => [row.domain, row.companyId]));
}

export async function loadSuppressedDomains(reader: ReconcileReader): Promise<Set<string>> {
  return new Set(await reader.suppressedDomains());
}

// ── Pass 1: domains for companies that already exist ──────────────────────

export interface DomainPlan {
  proposals: DomainBackfillProposal[];
  collisions: DomainCollision[];
  skipped: SkippedDomain[];
}

export async function planDomains(
  reader: ReconcileReader,
  register: Map<string, string>,
): Promise<DomainPlan> {
  const [contacts, companies] = await Promise.all([
    reader.contactAddresses(),
    reader.companyWebsites(),
  ]);

  const sources: CompanyEmailDomainSource[] = [];
  for (const contact of contacts) {
    for (const address of [contact.email, contact.secondaryEmail]) {
      if (address) sources.push({ companyId: contact.companyId, origin: 'contact', value: address });
    }
  }
  for (const company of companies) {
    if (company.website?.trim()) {
      sources.push({ companyId: company.id, origin: 'website', value: company.website });
    }
  }

  return proposeCompanyDomains({
    sources: sources.filter((source) => registrableDomainOf(source.value) !== ORG_DOMAIN),
    existingDomains: Object.fromEntries(register),
  });
}

// ── Pass 2: stored mail nobody has linked ─────────────────────────────────

export interface MailPlan {
  groups: UnlinkedDomainGroup[];
  proposals: DomainProposal[];
  freemailSkipped: { domain: string; messages: number }[];
  /**
   * Message ids per domain, for apply mode.
   *
   * RETURNED rather than stashed in a module-level map, which is what the
   * original crash was: a `const` map reassigned on each run. A value that
   * belongs to one plan should travel with that plan.
   */
  messageIdsByDomain: Map<string, string[]>;
}

interface MailDraft {
  domain: string;
  senders: Map<string, { email: string; name: string | null; inboundCount: number; automated: boolean }>;
  inboundCount: number;
  hasNdaAttachment: boolean;
  messageIds: string[];
}

export async function planMail(
  reader: ReconcileReader,
  register: Map<string, string>,
  suppressed: Set<string>,
): Promise<MailPlan> {
  const [messages, leads] = await Promise.all([reader.messages(), reader.leads()]);

  const leadsByDomain = new Map<string, string[]>();
  for (const lead of leads) {
    const domain = registrableDomainOf(lead.sourceDomain);
    if (!domain) continue;
    leadsByDomain.set(domain, [...(leadsByDomain.get(domain) ?? []), lead.companyName]);
  }

  // How much mail WE sent to each domain — the two-way signal.
  const outboundByDomain = new Map<string, number>();
  for (const message of messages) {
    if (message.direction !== 'outbound') continue;
    const domains = new Set(
      [...message.toAddresses, ...message.ccAddresses].map(registrableDomainOf).filter(Boolean),
    );
    for (const domain of domains) {
      outboundByDomain.set(domain, (outboundByDomain.get(domain) ?? 0) + 1);
    }
  }

  const drafts = new Map<string, MailDraft>();
  const freemail = new Map<string, number>();

  for (const message of messages) {
    if (message.direction !== 'inbound') continue;
    if (message.companyId) continue;
    const email = message.fromAddress.trim().toLowerCase();
    const domain = registrableDomainOf(email);
    if (!domain || domain === ORG_DOMAIN) continue;
    // A consumer mailbox is a person, and grouping every gmail.com sender into
    // one bucket would manufacture a very convincing candidate for "Gmail".
    if (isFreemailDomain(domain)) {
      freemail.set(domain, (freemail.get(domain) ?? 0) + 1);
      continue;
    }

    let draft = drafts.get(domain);
    if (!draft) {
      draft = { domain, senders: new Map(), inboundCount: 0, hasNdaAttachment: false, messageIds: [] };
      drafts.set(domain, draft);
    }
    draft.inboundCount += 1;
    draft.hasNdaAttachment ||= message.ndaDetected;
    draft.messageIds.push(message.id);

    const sender = draft.senders.get(email);
    if (sender) {
      sender.inboundCount += 1;
      if (!sender.name && message.fromName) sender.name = message.fromName;
    } else {
      draft.senders.set(email, {
        email,
        name: message.fromName,
        // Stored messages carry no headers, so this is the sender + subject half
        // of the one automation detector — never a second detector of our own.
        automated: isAutomatedReply({
          from: message.fromName ? `${message.fromName} <${email}>` : email,
          subject: message.subject,
        }),
        inboundCount: 1,
      });
    }
  }

  const groups: UnlinkedDomainGroup[] = [...drafts.values()].map((draft) => ({
    domain: draft.domain,
    senders: [...draft.senders.values()],
    inboundCount: draft.inboundCount,
    outboundCount: outboundByDomain.get(draft.domain) ?? 0,
    hasNdaAttachment: draft.hasNdaAttachment,
    leadNames: leadsByDomain.get(draft.domain) ?? [],
    suppressed: suppressed.has(draft.domain),
    companyIdForDomain: register.get(draft.domain) ?? null,
  }));

  return {
    groups,
    proposals: proposeUnlinkedDomains(groups),
    freemailSkipped: [...freemail.entries()]
      .map(([domain, count]) => ({ domain, messages: count }))
      .sort((a, b) => b.messages - a.messages),
    messageIdsByDomain: new Map([...drafts.values()].map((draft) => [draft.domain, draft.messageIds])),
  };
}

// ── Pass 3: names that look like one organisation ─────────────────────────

export async function planAliasLinks(reader: ReconcileReader): Promise<AliasLinkProposal[]> {
  const [companies, aliases] = await Promise.all([reader.companyNames(), reader.aliases()]);
  const rows: CompanyNameRow[] = [];
  for (const company of companies) {
    rows.push({ companyId: company.id, name: company.legalName, source: 'legalName' });
    if (company.tradingName) {
      rows.push({ companyId: company.id, name: company.tradingName, source: 'tradingName' });
    }
  }
  for (const alias of aliases) rows.push({ companyId: alias.companyId, name: alias.name, source: 'alias' });
  return proposeAliasLinks(rows);
}

// ── Pass 4: companies the old bug invented ────────────────────────────────

export async function planFalseCompanies(reader: ReconcileReader): Promise<FalseCompanyProposal[]> {
  const candidates = await reader.autoImportedCompanies();

  // Only rows that already look like an artefact pay for the count queries.
  const shortlist = candidates.filter((company) =>
    infrastructureDomainForCompany({ legalName: company.legalName, domains: company.domains }),
  );

  const rows: CompanyFactsRow[] = [];
  for (const company of shortlist) {
    const [counts, ndaIds] = await Promise.all([
      reader.companyCounts(company.id),
      reader.companyNdaIds(company.id),
    ]);
    rows.push({
      companyId: company.id,
      legalName: company.legalName,
      tradingName: company.tradingName,
      tags: company.tags,
      createdAt: company.createdAt.toISOString(),
      domains: company.domains,
      counts,
      ndaIds,
    });
  }
  return proposeFalseCompanies(rows);
}
