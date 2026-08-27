import "dotenv/config";

import { prisma } from "@/lib/backend/prisma";
import { isAutomatedReply } from "@/lib/investor/auto-reply";
import { isFreemailDomain, registrableDomainOf } from "@/lib/email-entity";
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
} from "@/lib/reconcile/proposals";
import { repointCompanyRelations, type RepointableDelegate } from "@/lib/reconcile/merge-runner";

/**
 * Reconcile stored Gmail traffic against the company register.
 *
 *   npm run reconcile:dry     # report only — the default, and the safe one
 *   npm run reconcile:apply   # same report, then write it
 *
 * Task 1 gave the Gmail sync three registers to consult (CompanyDomain,
 * CompanyAlias, SuppressedEntity) and shipped them EMPTY. That is why
 * bulla.com.au — 25 emails from three named people, a Lead row, no company —
 * still resolved to nothing: rungs 2 and 3 of the resolution ladder matched no
 * rows on day one. This script fills them from what is already in the database.
 *
 * Four passes:
 *
 *   1. DOMAINS      Give existing companies their domains, from contact email
 *                   addresses and the website column. Only when unambiguous —
 *                   two companies claiming one domain is reported as a
 *                   COLLISION and never guessed at, because the register is the
 *                   thing the sync trusts most and one wrong row mislinks every
 *                   future message from that domain.
 *   2. MAIL         Group unlinked inbound mail by registrable domain and run
 *                   the Task-1 scorer over the aggregate: LINK when a company
 *                   now owns the domain, SUPPRESS for infrastructure and
 *                   automated-only senders, CREATE-CANDIDATE where a lead
 *                   already stands, UNCERTAIN for a person to decide.
 *   3. ALIASES      Report companies whose names normalise to the same string.
 *                   Report only — no merge happens without a human.
 *   4. FALSE ROWS   Companies the old bug invented (tagged gmail-import, named
 *                   after a relay, nothing real filed under them). Apply mode
 *                   folds the duplicates onto ONE survivor and suppresses the
 *                   domain; the empty duplicate rows are listed for MANUAL
 *                   deletion. This script never deletes a company.
 *
 * Nothing below names bulla.com.au or pphosted.com. Both fall out of the rules.
 *
 * Restartable: every write is keyed on a unique constraint
 * (company_domains.domain, suppressed_entities(kind, normalizedValue)) or is a
 * narrowed updateMany, so a second run after a crash is a no-op.
 */

const APPLY = process.argv.includes("--apply");

/** Our own mailbox domain. Same constant the Gmail sync excludes. */
const ORG_DOMAIN = "italprotein.com";

/**
 * The one gate between the report and the database.
 *
 * Every function in this file that writes calls this FIRST, and
 * tests/reconcile-script.test.ts asserts that property by parsing this source —
 * so "dry run writes nothing" is a checked claim, not a promise.
 */
function requireApply(): void {
  if (!APPLY) throw new Error("reconcile: refusing to write without --apply");
}

// ── Report formatting ──────────────────────────────────────────────────────

function section(title: string): void {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
}
/** One greppable line. Empty parts are dropped so columns stay readable. */
function line(...parts: (string | number)[]): void {
  console.log(parts.filter((part) => part !== "").join(" "));
}
function note(message: string): void {
  console.log(`   ${message}`);
}

/** Addresses and domains only. Never a subject, never a body — this is a log. */
function senderList(emails: string[], limit = 6): string {
  const shown = emails.slice(0, limit).join(",");
  return emails.length > limit ? `${shown},+${emails.length - limit}` : shown;
}

// ── Loading ────────────────────────────────────────────────────────────────

async function loadDomainRegister(): Promise<Map<string, string>> {
  const rows = await prisma.companyDomain.findMany({ select: { domain: true, companyId: true } });
  return new Map(rows.map((row) => [row.domain, row.companyId]));
}

async function loadSuppressedDomains(): Promise<Set<string>> {
  const rows = await prisma.suppressedEntity.findMany({
    where: { kind: "domain" },
    select: { normalizedValue: true },
  });
  return new Set(rows.map((row) => row.normalizedValue));
}

// ── Pass 1: domains for companies that already exist ──────────────────────

async function planDomains(register: Map<string, string>): Promise<{
  proposals: DomainBackfillProposal[];
  collisions: DomainCollision[];
  skipped: SkippedDomain[];
}> {
  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({ select: { companyId: true, email: true, secondaryEmail: true } }),
    prisma.company.findMany({ where: { NOT: { website: null } }, select: { id: true, website: true } }),
  ]);

  const sources: CompanyEmailDomainSource[] = [];
  for (const contact of contacts) {
    for (const address of [contact.email, contact.secondaryEmail]) {
      if (address) sources.push({ companyId: contact.companyId, origin: "contact", value: address });
    }
  }
  for (const company of companies) {
    if (company.website?.trim()) {
      sources.push({ companyId: company.id, origin: "website", value: company.website });
    }
  }

  return proposeCompanyDomains({
    sources: sources.filter((source) => registrableDomainOf(source.value) !== ORG_DOMAIN),
    existingDomains: Object.fromEntries(register),
  });
}

async function applyDomains(proposals: DomainBackfillProposal[]): Promise<number> {
  requireApply();
  let written = 0;
  for (const proposal of proposals) {
    // One transaction per proposal: a crash halfway leaves whole domains
    // written or not written, never a domain without its audit row.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.companyDomain.create({
          data: {
            companyId: proposal.companyId,
            domain: proposal.domain,
            verified: true,
            source: "reconciliation",
          },
        });
        await tx.auditEvent.create({
          data: {
            action: "reconciliation.domain_added",
            entityType: "company",
            entityId: proposal.companyId,
            companyId: proposal.companyId,
            summary: `Reconciliation registered ${proposal.domain} to this company (${proposal.origins.join(", ")}).`,
            after: { domain: proposal.domain, evidence: proposal.evidence },
            result: "success",
          },
        });
      });
      written += 1;
    } catch {
      // company_domains.domain is globally UNIQUE: another run, or the live
      // sync, claimed it between the plan and the write. That is the constraint
      // doing its job — re-read it on the next run.
      note(`SKIP-RACE ${proposal.domain} (claimed while applying)`);
    }
  }
  return written;
}

// ── Pass 2: stored mail nobody has linked ─────────────────────────────────

/**
 * Message ids per domain, filled by planMail and read by applyMailLinks.
 * Kept out of the proposal objects so the pure module never carries row ids.
 */
const messageIdsByDomain = new Map<string, string[]>();

interface MailPlan {
  groups: UnlinkedDomainGroup[];
  proposals: DomainProposal[];
  freemailSkipped: { domain: string; messages: number }[];
}

async function planMail(register: Map<string, string>, suppressed: Set<string>): Promise<MailPlan> {
  const [messages, leads] = await Promise.all([
    prisma.emailMessage.findMany({
      select: {
        id: true,
        direction: true,
        fromAddress: true,
        fromName: true,
        subject: true,
        toAddresses: true,
        ccAddresses: true,
        companyId: true,
        ndaDetected: true,
      },
    }),
    prisma.lead.findMany({ select: { companyName: true, sourceDomain: true } }),
  ]);

  const leadsByDomain = new Map<string, string[]>();
  for (const lead of leads) {
    const domain = registrableDomainOf(lead.sourceDomain);
    if (!domain) continue;
    leadsByDomain.set(domain, [...(leadsByDomain.get(domain) ?? []), lead.companyName]);
  }

  // How much mail WE sent to each domain — the two-way signal.
  const outboundByDomain = new Map<string, number>();
  for (const message of messages) {
    if (message.direction !== "outbound") continue;
    const domains = new Set(
      [...message.toAddresses, ...message.ccAddresses].map(registrableDomainOf).filter(Boolean),
    );
    for (const domain of domains) {
      outboundByDomain.set(domain, (outboundByDomain.get(domain) ?? 0) + 1);
    }
  }

  interface Draft {
    domain: string;
    senders: Map<string, { email: string; name: string | null; inboundCount: number; automated: boolean }>;
    inboundCount: number;
    hasNdaAttachment: boolean;
    messageIds: string[];
  }
  const drafts = new Map<string, Draft>();
  const freemail = new Map<string, number>();

  for (const message of messages) {
    if (message.direction !== "inbound") continue;
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

    const draft =
      drafts.get(domain) ??
      ({ domain, senders: new Map(), inboundCount: 0, hasNdaAttachment: false, messageIds: [] } satisfies Draft);
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
    drafts.set(domain, draft);
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

  // Keep the message ids beside the plan so apply mode does not re-derive them.
  messageIdsByDomain = new Map([...drafts.values()].map((draft) => [draft.domain, draft.messageIds]));

  return {
    groups,
    proposals: proposeUnlinkedDomains(groups),
    freemailSkipped: [...freemail.entries()]
      .map(([domain, messages_]) => ({ domain, messages: messages_ }))
      .sort((a, b) => b.messages - a.messages),
  };
}

async function applyMailLinks(proposals: DomainProposal[]): Promise<number> {
  requireApply();
  let linked = 0;
  for (const proposal of proposals) {
    if (proposal.kind !== "PROPOSE-LINK" || !proposal.companyId) continue;
    const ids = messageIdsByDomain.get(proposal.domain) ?? [];
    if (!ids.length) continue;
    const companyId = proposal.companyId;
    await prisma.$transaction(async (tx) => {
      // `companyId: null` keeps this idempotent AND keeps a human's manual
      // attribution: whoever moved a message by hand outranks this script.
      const result = await tx.emailMessage.updateMany({
        where: { id: { in: ids }, companyId: null },
        data: { companyId },
      });
      if (!result.count) return;
      linked += result.count;
      await tx.auditEvent.create({
        data: {
          action: "reconciliation.messages_linked",
          entityType: "company",
          entityId: companyId,
          companyId,
          summary: `Reconciliation linked ${result.count} stored email(s) from ${proposal.domain}.`,
          after: { domain: proposal.domain, messages: result.count },
          result: "success",
        },
      });
    });
  }
  return linked;
}

async function applySuppressions(proposals: DomainProposal[]): Promise<number> {
  requireApply();
  let written = 0;
  for (const proposal of proposals) {
    if (proposal.kind !== "PROPOSE-SUPPRESS") continue;
    // Already suppressed: nothing to do, and no audit row for a no-op.
    if (proposal.evidence.includes("suppressed-domain")) continue;
    await prisma.$transaction(async (tx) => {
      await tx.suppressedEntity.upsert({
        where: { kind_normalizedValue: { kind: "domain", normalizedValue: proposal.domain } },
        create: {
          kind: "domain",
          value: proposal.domain,
          normalizedValue: proposal.domain,
          reason: `Reconciliation: ${proposal.evidence.join(", ")}`,
        },
        update: {},
      });
      await tx.auditEvent.create({
        data: {
          action: "reconciliation.domain_suppressed",
          entityType: "suppressed_entity",
          entityId: proposal.domain,
          summary: `Reconciliation suppressed ${proposal.domain} (${proposal.evidence.join(", ")}).`,
          after: { domain: proposal.domain, messages: proposal.messageCount, evidence: proposal.evidence },
          result: "success",
        },
      });
    });
    written += 1;
  }
  return written;
}

// ── Pass 3: names that look like one organisation ─────────────────────────

async function planAliasLinks(): Promise<AliasLinkProposal[]> {
  const [companies, aliases] = await Promise.all([
    prisma.company.findMany({ select: { id: true, legalName: true, tradingName: true } }),
    prisma.companyAlias.findMany({ select: { companyId: true, name: true } }),
  ]);
  const rows: CompanyNameRow[] = [];
  for (const company of companies) {
    rows.push({ companyId: company.id, name: company.legalName, source: "legalName" });
    if (company.tradingName) rows.push({ companyId: company.id, name: company.tradingName, source: "tradingName" });
  }
  for (const alias of aliases) rows.push({ companyId: alias.companyId, name: alias.name, source: "alias" });
  return proposeAliasLinks(rows);
}

// ── Pass 4: companies the old bug invented ────────────────────────────────

async function planFalseCompanies(): Promise<FalseCompanyProposal[]> {
  const candidates = await prisma.company.findMany({
    where: { tags: { has: "gmail-import" } },
    select: {
      id: true,
      legalName: true,
      tradingName: true,
      tags: true,
      createdAt: true,
      domains: { select: { domain: true } },
    },
  });

  // Only rows that already look like an artefact pay for the count queries.
  const shortlist = candidates.filter((company) =>
    infrastructureDomainForCompany({
      legalName: company.legalName,
      domains: company.domains.map((d) => d.domain),
    }),
  );

  const rows: CompanyFactsRow[] = [];
  for (const company of shortlist) {
    const where = { companyId: company.id };
    const [
      contacts, ndas, emailMessages, quotes, orders, invoices, sampleRequests,
      shipments, opportunities, documents, feedbacks, projects, meetings, tasks,
    ] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.nDA.count({ where }),
      prisma.emailMessage.count({ where }),
      prisma.quote.count({ where }),
      prisma.order.count({ where }),
      prisma.invoice.count({ where }),
      prisma.sampleRequest.count({ where }),
      prisma.shipment.count({ where }),
      prisma.opportunity.count({ where }),
      prisma.document.count({ where }),
      prisma.feedback.count({ where }),
      prisma.applicationProject.count({ where }),
      prisma.meeting.count({ where }),
      prisma.task.count({ where }),
    ]);
    rows.push({
      companyId: company.id,
      legalName: company.legalName,
      tradingName: company.tradingName,
      tags: company.tags,
      createdAt: company.createdAt.toISOString(),
      domains: company.domains.map((d) => d.domain),
      counts: {
        contacts, ndas, emailMessages, quotes, orders, invoices, sampleRequests,
        shipments, opportunities, documents, feedbacks, projects, meetings, tasks,
      },
    });
  }
  return proposeFalseCompanies(rows);
}

/**
 * Fold the duplicates onto the survivor and suppress the domain.
 *
 * The duplicate COMPANY ROWS are left standing, empty, for a person to delete.
 * A script that deletes company rows on its own reading of the evidence is the
 * same class of mistake as a sync that creates them on its own reading of the
 * evidence, and this whole task exists because of the second one.
 */
async function applyFalseCompanies(proposals: FalseCompanyProposal[]): Promise<number> {
  requireApply();
  let handled = 0;
  for (const proposal of proposals) {
    await prisma.$transaction(async (tx) => {
      const resolve = (name: string) => (tx as unknown as Record<string, RepointableDelegate>)[name];
      const moved: Record<string, Record<string, number>> = {};
      for (const duplicateId of proposal.duplicateCompanyIds) {
        moved[duplicateId] = await repointCompanyRelations(resolve, duplicateId, proposal.keepCompanyId);
      }
      await tx.suppressedEntity.upsert({
        where: { kind_normalizedValue: { kind: "domain", normalizedValue: proposal.suppressDomain } },
        create: {
          kind: "domain",
          value: proposal.suppressDomain,
          normalizedValue: proposal.suppressDomain,
          reason: "Reconciliation: mail infrastructure, mistaken for a company",
        },
        update: {},
      });
      await tx.auditEvent.create({
        data: {
          action: "reconciliation.false_company_folded",
          entityType: "company",
          entityId: proposal.keepCompanyId,
          companyId: proposal.keepCompanyId,
          summary:
            `Reconciliation folded ${proposal.duplicateCompanyIds.length} bounce-born row(s) into this one and ` +
            `suppressed ${proposal.suppressDomain}. The empty rows await MANUAL deletion.`,
          after: {
            suppressedDomain: proposal.suppressDomain,
            keep: proposal.keepCompanyId,
            deleteManually: proposal.duplicateCompanyIds,
            moved,
            evidence: proposal.evidence,
          },
          result: "success",
        },
      });
    });
    handled += 1;
  }
  return handled;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    APPLY
      ? "reconcile-email-companies — APPLY MODE (writing)"
      : "reconcile-email-companies — DRY RUN (no writes; pass --apply to write)",
  );

  const register = await loadDomainRegister();
  const suppressed = await loadSuppressedDomains();
  console.log(`register: ${register.size} domain(s), ${suppressed.size} suppression(s)`);

  // ── 1 ──
  section("1. DOMAINS for companies that already exist");
  const domains = await planDomains(register);
  for (const proposal of domains.proposals) {
    line("PROPOSE-DOMAIN", proposal.domain, "->", proposal.companyId, `[${proposal.origins.join(" ")}]`);
  }
  for (const collision of domains.collisions) {
    line("COLLISION", collision.domain, "claimed by", collision.companyIds.join(","));
  }
  const skipTally = new Map<string, number>();
  for (const skip of domains.skipped) skipTally.set(skip.reason, (skipTally.get(skip.reason) ?? 0) + 1);
  for (const [reason, count] of skipTally) line("SKIP-DOMAIN", reason, count);
  note(
    `${domains.proposals.length} proposed · ${domains.collisions.length} collisions · ${domains.skipped.length} skipped`,
  );

  if (APPLY && domains.proposals.length) {
    const written = await applyDomains(domains.proposals);
    note(`APPLIED ${written} domain(s)`);
    // Pass 2 must see what pass 1 just wrote, or every freshly registered
    // domain would be reported as UNCERTAIN on the very run that fixed it.
    for (const proposal of domains.proposals) register.set(proposal.domain, proposal.companyId);
  }

  // ── 2 ──
  section("2. STORED MAIL grouped by registrable domain");
  const mail = await planMail(register, suppressed);
  for (const proposal of mail.proposals) {
    const senders = proposal.humanSenders.length ? `senders=${senderList(proposal.humanSenders)}` : "";
    const lead = proposal.leadNames.length ? `lead="${proposal.leadNames.join('","')}"` : "";
    line(
      proposal.kind,
      proposal.domain,
      `msgs=${proposal.messageCount}`,
      `score=${proposal.score}`,
      proposal.strength,
      proposal.companyId ? `company=${proposal.companyId}` : "",
      senders,
      lead,
      `[${proposal.evidence.join(" ")}]`,
    );
  }
  for (const skip of mail.freemailSkipped) line("SKIP-FREEMAIL", skip.domain, `msgs=${skip.messages}`);
  const tally = new Map<string, number>();
  for (const proposal of mail.proposals) tally.set(proposal.kind, (tally.get(proposal.kind) ?? 0) + 1);
  note([...tally.entries()].map(([kind, count]) => `${kind}=${count}`).join(" · ") || "nothing to do");

  if (APPLY) {
    const linked = await applyMailLinks(mail.proposals);
    const suppressedCount = await applySuppressions(mail.proposals);
    note(`APPLIED ${linked} message link(s) · ${suppressedCount} suppression(s)`);
  }

  // ── 3 ──
  section("3. ALIAS candidates (report only — never merged automatically)");
  const aliasLinks = await planAliasLinks();
  for (const link of aliasLinks) {
    line(
      "PROPOSE-ALIAS-LINK",
      `"${link.normalizedName}"`,
      link.companies.map((c) => `${c.companyId}(${c.source})`).join(","),
    );
  }
  note(`${aliasLinks.length} name group(s) spanning more than one company`);

  // ── 4 ──
  section("4. FALSE COMPANIES from the old auto-create bug");
  const falseCompanies = await planFalseCompanies();
  for (const proposal of falseCompanies) {
    line(
      "PROPOSE-FALSE-COMPANY",
      proposal.infrastructureDomain,
      `keep=${proposal.keepCompanyId}`,
      `rows=${proposal.duplicateCompanyIds.length + 1}`,
      `[${proposal.evidence.join(" ")}]`,
    );
    line("PROPOSE-SUPPRESS", proposal.suppressDomain, "[false-company]");
    if (proposal.duplicateCompanyIds.length) {
      line("MANUAL-DELETE", proposal.duplicateCompanyIds.join(","));
    }
  }
  note(`${falseCompanies.length} infrastructure-born group(s)`);

  if (APPLY && falseCompanies.length) {
    const handled = await applyFalseCompanies(falseCompanies);
    note(`APPLIED ${handled} fold(s). Delete the MANUAL-DELETE rows by hand once you have checked them.`);
  }

  console.log(
    APPLY
      ? "\ndone — applied. Re-run in dry mode to confirm the report is now empty."
      : "\ndone — nothing was written. Re-run with --apply to act on the report above.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
