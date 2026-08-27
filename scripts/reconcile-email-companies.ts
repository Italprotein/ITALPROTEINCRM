import "dotenv/config";

import { prisma } from "@/lib/backend/prisma";
import {
  loadDomainRegister,
  loadSuppressedDomains,
  planAliasLinks,
  planDomains,
  planFalseCompanies,
  planMail,
  AUTO_IMPORT_TAG,
  type ReconcileReader,
} from "@/lib/reconcile/plan";
import type {
  DomainBackfillProposal,
  DomainProposal,
  FalseCompanyProposal,
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
 *                   COLLISION and never guessed at.
 *   2. MAIL         Group unlinked inbound mail by registrable domain: LINK
 *                   when a company now owns the domain, SUPPRESS for
 *                   infrastructure and automated-only senders,
 *                   CREATE-CANDIDATE where a lead already stands, UNCERTAIN for
 *                   a person to decide.
 *   3. ALIASES      Report companies whose names normalise to the same string.
 *   4. FALSE ROWS   Companies the old bug invented. Apply mode folds the
 *                   duplicates onto ONE survivor and suppresses the domain; the
 *                   emptied duplicates AND the survivor are listed for manual
 *                   review. This script never deletes a company.
 *
 * WHAT LIVES WHERE, and why: every decision is in lib/reconcile/proposals.ts,
 * and every read-and-shape step is in lib/reconcile/plan.ts. Both are under
 * `lib/`, which `npm run typecheck` covers and tests can execute. This file
 * holds argv, wiring, printing and the writes — and is itself pinned into
 * tsconfig's `files` so it is typechecked despite `scripts/` being excluded.
 * That exclusion is how a reassigned `const` once shipped in here: a crash on
 * every single run that no gate could see.
 *
 * Restartable: every write is keyed on a unique constraint or is a narrowed
 * updateMany, so a second run after a crash is a no-op.
 */

const APPLY = process.argv.includes("--apply");

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

// ── The Prisma side of lib/reconcile/plan.ts's port ───────────────────────

const reader: ReconcileReader = {
  companyDomains: () => prisma.companyDomain.findMany({ select: { domain: true, companyId: true } }),
  suppressedDomains: async () =>
    (
      await prisma.suppressedEntity.findMany({
        where: { kind: "domain" },
        select: { normalizedValue: true },
      })
    ).map((row) => row.normalizedValue),
  contactAddresses: () =>
    prisma.contact.findMany({ select: { companyId: true, email: true, secondaryEmail: true } }),
  companyWebsites: () =>
    prisma.company.findMany({ where: { NOT: { website: null } }, select: { id: true, website: true } }),
  messages: () =>
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
  leads: () => prisma.lead.findMany({ select: { companyName: true, sourceDomain: true } }),
  companyNames: () =>
    prisma.company.findMany({ select: { id: true, legalName: true, tradingName: true } }),
  aliases: () => prisma.companyAlias.findMany({ select: { companyId: true, name: true } }),
  autoImportedCompanies: async () =>
    (
      await prisma.company.findMany({
        where: { tags: { has: AUTO_IMPORT_TAG } },
        select: {
          id: true,
          legalName: true,
          tradingName: true,
          tags: true,
          createdAt: true,
          domains: { select: { domain: true } },
        },
      })
    ).map((company) => ({ ...company, domains: company.domains.map((d) => d.domain) })),
  companyCounts: async (companyId) => {
    const where = { companyId };
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
    return {
      contacts, ndas, emailMessages, quotes, orders, invoices, sampleRequests,
      shipments, opportunities, documents, feedbacks, projects, meetings, tasks,
    };
  },
  companyNdaIds: async (companyId) =>
    (await prisma.nDA.findMany({ where: { companyId }, select: { id: true } })).map((row) => row.id),
};

// ── Writes ─────────────────────────────────────────────────────────────────

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

async function applyMailLinks(
  proposals: DomainProposal[],
  messageIdsByDomain: Map<string, string[]>,
): Promise<number> {
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

/**
 * Fold the duplicates onto the survivor and suppress the domain.
 *
 * NO company row is deleted, and that includes the survivor: it is still a row
 * named after a bounce handler, now holding every bounce-born NDA the group
 * produced. It is reported as MANUAL-REVIEW-SURVIVOR and the NDA ids go into
 * the audit event, so folding does not quietly bless one of the four.
 *
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
        // The shared runner — it moves the relation-less company-id columns
        // (email_logs) too, which a hand-rolled loop here once forgot, leaving
        // them dangling at a row the operator was told to delete.
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
            `suppressed ${proposal.suppressDomain}. This row is NOT a real company either: it now holds ` +
            `${proposal.survivorNdaCount + proposal.foldedNdaCount} bounce-filed NDA(s) and awaits manual review. ` +
            `The emptied rows await MANUAL deletion.`,
          after: {
            suppressedDomain: proposal.suppressDomain,
            keep: proposal.keepCompanyId,
            reviewSurvivor: true,
            deleteManually: proposal.duplicateCompanyIds,
            bounceNdaIds: proposal.ndaIdsToReview,
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

  const register = await loadDomainRegister(reader);
  const suppressed = await loadSuppressedDomains(reader);
  console.log(`register: ${register.size} domain(s), ${suppressed.size} suppression(s)`);

  // ── 1 ──
  section("1. DOMAINS for companies that already exist");
  const domains = await planDomains(reader, register);
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
  const mail = await planMail(reader, register, suppressed);
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
    const linked = await applyMailLinks(mail.proposals, mail.messageIdsByDomain);
    const suppressedCount = await applySuppressions(mail.proposals);
    note(`APPLIED ${linked} message link(s) · ${suppressedCount} suppression(s)`);
  }

  // ── 3 ──
  section("3. ALIAS candidates (report only — never merged automatically)");
  const aliasLinks = await planAliasLinks(reader);
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
  const falseCompanies = await planFalseCompanies(reader);
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
    // The survivor is not exonerated by surviving. It keeps the name of a
    // bounce handler and inherits every bounce-filed NDA in the group.
    line(
      "MANUAL-REVIEW-SURVIVOR",
      proposal.keepCompanyId,
      `"${proposal.keepCompanyName}"`,
      `ndas=${proposal.survivorNdaCount + proposal.foldedNdaCount}`,
      `(own=${proposal.survivorNdaCount} folded=${proposal.foldedNdaCount})`,
      `domain=${proposal.infrastructureDomain}`,
    );
    if (proposal.ndaIdsToReview.length) {
      line("MANUAL-REVIEW-NDA", proposal.ndaIdsToReview.join(","));
    }
  }
  note(`${falseCompanies.length} infrastructure-born group(s)`);

  if (APPLY && falseCompanies.length) {
    const handled = await applyFalseCompanies(falseCompanies);
    note(
      `APPLIED ${handled} fold(s). Delete the MANUAL-DELETE rows and judge the ` +
        `MANUAL-REVIEW-SURVIVOR row by hand — this script deletes no company.`,
    );
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
