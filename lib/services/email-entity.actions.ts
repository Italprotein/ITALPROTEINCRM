"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { requireAction, requireInternal, type SessionUser } from "@/lib/backend/session";
import {
  classifyEmailEntity,
  isFreemailDomain,
  isInfrastructureDomain,
  normalizeEntityName,
  registrableDomainOf,
} from "@/lib/email-entity";
import { COMPANY_ID_COLUMNS_WITHOUT_RELATIONS } from "@/lib/reconcile/company-merge";
import {
  blockingRelationCounts,
  repointCompanyRelations,
  type RepointableDelegate,
} from "@/lib/reconcile/merge-runner";

/**
 * Human decisions about who is on the other end of an email.
 *
 * Task 1 built the registers (CompanyAlias / CompanyDomain / SuppressedEntity)
 * and taught the Gmail sync to read them. It shipped them EMPTY, which is why
 * bulla.com.au still linked to nothing: a Lead row existed and nothing could
 * promote it. These are the actions that fill them — approve a lead into a
 * company, reject a domain for good, link a lead to a company that already
 * exists, curate aliases and domains, and merge two rows that were always one
 * organisation.
 *
 * Two rules run through the whole file:
 *
 *  - Business refusals are RETURNED as `{ ok: false, reason }`, never thrown.
 *    Next redacts thrown server-action messages in production, so a thrown rule
 *    reaches the user as "Action failed" and nothing more — the same lesson
 *    already written down on removeCompany() in company.actions.ts.
 *  - Authorization still throws. FORBIDDEN is not a business outcome to render.
 *
 * Everything is keyed on unique constraints (CompanyDomain.domain,
 * CompanyAlias(companyId, normalizedName), SuppressedEntity(kind, value)), so
 * every action can be run twice with the same result as running it once.
 */

// ── Result types ───────────────────────────────────────────────────────────

export type AliasKind = "legal_name" | "trading_name" | "former_name" | "spelling";

export interface LeadSender {
  email: string;
  name: string | null;
  messageCount: number;
}

export interface LeadReviewRow {
  id: string;
  companyName: string;
  adminUserId: string;
  sourceDomain: string | null;
  emailCount: number;
  lastSeenAt: string;
  /** Set when the lead's domain is ALREADY registered to a company. */
  existingCompanyId: string | null;
  existingCompanyName: string | null;
}

export interface CompanyIdentity {
  aliases: { id: string; name: string; normalizedName: string; kind: AliasKind }[];
  domains: { id: string; domain: string; verified: boolean; source: string }[];
}

export type ApproveLeadResult =
  | {
      ok: true;
      companyId: string;
      companyName: string;
      /** False when the domain was already registered and we absorbed into it. */
      created: boolean;
      contactsCreated: number;
      messagesLinked: number;
    }
  | {
      ok: false;
      reason: "lead_not_found" | "no_source_domain" | "unusable_domain" | "suppressed_domain" | "invalid_name";
    };

export type RejectLeadResult =
  | { ok: true; domain: string }
  | { ok: false; reason: "lead_not_found" | "no_source_domain" };

export type LinkLeadResult =
  | { ok: true; companyId: string; messagesLinked: number }
  | {
      ok: false;
      reason: "lead_not_found" | "company_not_found" | "no_source_domain" | "unusable_domain" | "domain_taken";
      details?: string;
    };

export type AliasResult =
  | { ok: true; aliasId: string }
  | { ok: false; reason: "company_not_found" | "invalid_name" | "duplicate" };

export type DomainResult =
  | { ok: true; domainId: string }
  | { ok: false; reason: "company_not_found" | "invalid_domain" | "domain_taken"; details?: string };

export type MergeCompaniesResult =
  | {
      ok: true;
      sourceId: string;
      targetId: string;
      sourceName: string;
      /** Rows moved, per relation field of model Company. Written to the audit event. */
      moved: Record<string, number>;
      aliasesAdded: number;
    }
  | {
      ok: false;
      reason:
        | "same_company"
        | "source_not_found"
        | "target_not_found"
        | "financial_records"
        | "linked_records";
      details?: string;
    };

// ── Shared helpers ─────────────────────────────────────────────────────────

/** The Prisma interactive-transaction client, named once. */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Reach a Prisma delegate by NAME.
 *
 * COMPANY_MERGE_RELATIONS is data — so a schema-diff test can check it against
 * prisma/schema.prisma — which means the matching delegate has to be resolved
 * dynamically. The cast is confined to this one function, and the test proves
 * each `delegate`/`foreignKey` pair names something the schema declares.
 */
function delegateOf(client: TxClient | typeof prisma, name: string): RepointableDelegate {
  return (client as unknown as Record<string, RepointableDelegate>)[name];
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "?"
  );
}

/**
 * A person's name from what the mail client sent.
 *
 * Display names arrive as "Olivia Li", as "Li, Olivia", and — very often —
 * not at all, in which case the local part is the only thing left:
 * `olivia.li@bulla.com.au` → Olivia / Li. A single token becomes a first name
 * with an empty surname rather than a guess.
 */
function personNameFrom(fromName: string | null | undefined, email: string): { firstName: string; lastName: string } {
  const cleaned = (fromName ?? "").replace(/["<>]/g, "").trim();
  const reordered = /^[^,]+,\s*[^,]+$/.test(cleaned)
    ? cleaned
        .split(",")
        .map((part) => part.trim())
        .reverse()
        .join(" ")
    : cleaned;
  const parts = reordered.split(/\s+/).filter(Boolean);
  if (!reordered.includes("@") && parts.length >= 2) {
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }
  const local = (email.split("@")[0] ?? "").trim();
  const tokens = local.split(/[._\-+]+/).filter(Boolean).map(capitalise);
  if (tokens.length >= 2) return { firstName: tokens[0], lastName: tokens.slice(1).join(" ") };
  if (!reordered.includes("@") && parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: tokens[0] ?? local ?? email, lastName: "" };
}

/**
 * Stored inbound mail whose sender sits on this registrable domain.
 *
 * The database cannot compute a registrable domain, so the `contains` filter is
 * only a cheap pre-filter — every row is re-tested in JS. Without that,
 * "bulla.com.au" would also collect "notbulla.com.au.example.org".
 */
async function inboundMessagesForDomain(registrable: string) {
  const rows = await prisma.emailMessage.findMany({
    where: { direction: "inbound", fromAddress: { contains: registrable, mode: "insensitive" } },
    select: { id: true, fromAddress: true, fromName: true, companyId: true, internalDate: true },
    orderBy: { internalDate: "asc" },
  });
  return rows.filter((row) => registrableDomainOf(row.fromAddress) === registrable);
}

type InboundRow = Awaited<ReturnType<typeof inboundMessagesForDomain>>[number];

/** One entry per distinct sender, in first-seen order, robots dropped. */
function humanSendersOf(rows: InboundRow[]): LeadSender[] {
  const senders = new Map<string, LeadSender>();
  for (const row of rows) {
    const email = row.fromAddress.trim().toLowerCase();
    if (!email.includes("@")) continue;
    const existing = senders.get(email);
    if (existing) {
      existing.messageCount += 1;
      if (!existing.name && row.fromName) existing.name = row.fromName;
      continue;
    }
    senders.set(email, { email, name: row.fromName ?? null, messageCount: 1 });
  }
  // The same scorer the sync uses, so "who counts as a person" has one answer.
  return [...senders.values()].filter(
    (sender) =>
      classifyEmailEntity({
        fromEmail: sender.email,
        fromName: sender.name,
        isAutomatedReply: false,
        hasNdaAttachment: false,
        humanReplyCount: sender.messageCount,
        twoWay: false,
      }).verdict !== "ignore",
  );
}

async function writeAudit(
  tx: TxClient,
  actor: Pick<SessionUser, "id" | "role">,
  event: {
    action: string;
    entityType: string;
    entityId: string;
    companyId?: string | null;
    summary: string;
    before?: object;
    after?: object;
  },
) {
  await tx.auditEvent.create({
    data: {
      actorUserId: actor.id,
      actorRole: actor.role,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      companyId: event.companyId ?? null,
      summary: event.summary,
      before: event.before ?? undefined,
      after: event.after ?? undefined,
      result: "success",
    },
  });
}

// ── Reads for the review surface ───────────────────────────────────────────

/**
 * Every Gmail-derived lead, with the one fact the list cannot show without a
 * join: whether its domain is already registered to a company (in which case
 * "approve" absorbs into that company instead of creating a second one).
 */
export async function listLeadsForReview(): Promise<LeadReviewRow[]> {
  await requireInternal();
  const leads = await prisma.lead.findMany({ orderBy: [{ emailCount: "desc" }, { lastSeenAt: "desc" }] });
  const domains = [...new Set(leads.map((lead) => registrableDomainOf(lead.sourceDomain)).filter(Boolean))];
  const registered = domains.length
    ? await prisma.companyDomain.findMany({
        where: { domain: { in: domains } },
        select: { domain: true, companyId: true, company: { select: { legalName: true, tradingName: true } } },
      })
    : [];
  const byDomain = new Map(registered.map((row) => [row.domain, row]));

  return leads.map((lead) => {
    const domain = registrableDomainOf(lead.sourceDomain);
    const match = domain ? byDomain.get(domain) : undefined;
    return {
      id: lead.id,
      companyName: lead.companyName,
      adminUserId: lead.adminUserId,
      sourceDomain: domain || null,
      emailCount: lead.emailCount,
      lastSeenAt: lead.lastSeenAt.toISOString(),
      existingCompanyId: match?.companyId ?? null,
      existingCompanyName: match ? match.company.tradingName ?? match.company.legalName : null,
    };
  });
}

/** The people who actually wrote from a lead's domain — shown in the approve dialog. */
export async function leadSenders(leadId: string): Promise<LeadSender[]> {
  await requireInternal();
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { sourceDomain: true } });
  const registrable = registrableDomainOf(lead?.sourceDomain);
  if (!registrable) return [];
  return humanSendersOf(await inboundMessagesForDomain(registrable));
}

export async function getCompanyIdentity(companyId: string): Promise<CompanyIdentity> {
  await requireInternal();
  const [aliases, domains] = await Promise.all([
    prisma.companyAlias.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.companyDomain.findMany({ where: { companyId }, orderBy: { domain: "asc" } }),
  ]);
  return {
    aliases: aliases.map((alias) => ({
      id: alias.id,
      name: alias.name,
      normalizedName: alias.normalizedName,
      kind: alias.kind as AliasKind,
    })),
    domains: domains.map((domain) => ({
      id: domain.id,
      domain: domain.domain,
      verified: domain.verified,
      source: domain.source,
    })),
  };
}

// ── Lead review ────────────────────────────────────────────────────────────

/**
 * Promote a Gmail lead into a real company.
 *
 * This is the missing half of the false negative. The lead row for bulla.com.au
 * has existed since the first of those 25 emails arrived; until now the only
 * control next to it was a bin icon. Approving writes the domain into the
 * register, so every future message from it takes rung 2 of the sync's
 * resolution ladder without anybody doing anything.
 *
 * Idempotent by construction: if the domain is ALREADY registered, the company
 * that owns it absorbs the lead and no second row is created. CompanyDomain.domain
 * is globally unique, so two people clicking at once cannot both win.
 */
export async function approveLeadAsCompany(
  leadId: string,
  input?: { legalName?: string },
): Promise<ApproveLeadResult> {
  const actor = await requireAction("company.create");

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, reason: "lead_not_found" };

  const registrable = registrableDomainOf(lead.sourceDomain);
  if (!registrable) return { ok: false, reason: "no_source_domain" };
  // A consumer mailbox names a person and a relay names nobody; neither is an
  // organisation, and approving one would put exactly the wrong row in the
  // register the sync trusts most.
  if (isFreemailDomain(registrable) || isInfrastructureDomain(registrable)) {
    return { ok: false, reason: "unusable_domain" };
  }

  const suppression = await prisma.suppressedEntity.findUnique({
    where: { kind_normalizedValue: { kind: "domain", normalizedValue: registrable } },
    select: { id: true },
  });
  if (suppression) return { ok: false, reason: "suppressed_domain" };

  const name = (input?.legalName ?? lead.companyName).trim();
  if (normalizeEntityName(name).length < 2) return { ok: false, reason: "invalid_name" };

  // Read the mail OUTSIDE the transaction: a domain with hundreds of stored
  // messages must not hold a write transaction open while it is fetched.
  const messages = await inboundMessagesForDomain(registrable);
  const senders = humanSendersOf(messages);

  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.companyDomain.findUnique({
      where: { domain: registrable },
      select: { companyId: true, company: { select: { legalName: true, tradingName: true } } },
    });

    let companyId: string;
    let companyName: string;
    let created = false;

    if (existing) {
      companyId = existing.companyId;
      companyName = existing.company.tradingName ?? existing.company.legalName;
    } else {
      const company = await tx.company.create({
        data: {
          legalName: name,
          type: "other",
          initials: initialsOf(name),
          headquarters: { line1: "", city: "", country: "", countryCode: "" },
          firstContact: {
            date: (messages[0]?.internalDate ?? lead.firstSeenAt).toISOString(),
            channel: "gmail",
            note: "Approved from a Gmail lead",
          },
          country: "",
          countryCode: "",
          city: "",
          website: `https://${registrable}`,
          // The schema's initial stage. NOT nda_in_progress: the old auto-create
          // path used that and produced companies counted as being mid-NDA with
          // no NDA row behind them.
          relationshipStage: "lead",
          leadSource: "gmail",
          tags: ["gmail-import"],
          ownerUserId: lead.adminUserId,
          createdById: actor.id,
        },
      });
      companyId = company.id;
      companyName = company.legalName;
      created = true;
      await tx.companyDomain.create({
        data: {
          companyId,
          domain: registrable,
          verified: true,
          source: "reconciliation",
          createdById: actor.id,
        },
      });
    }

    // Both the chosen name and the name the sync derived: a later message
    // signing itself either way then resolves without a second company.
    for (const candidate of [name, lead.companyName]) {
      const normalizedName = normalizeEntityName(candidate);
      if (normalizedName.length < 2) continue;
      await tx.companyAlias.upsert({
        where: { companyId_normalizedName: { companyId, normalizedName } },
        create: { companyId, name: candidate, normalizedName, kind: "legal_name", createdById: actor.id },
        update: {},
      });
    }

    // Every contact of the company, compared case-folded in JS: an `in` filter
    // would have to trust the stored casing, and contact addresses arrive from
    // imports, forms and mail headers with no agreement between them.
    const existingContacts = await tx.contact.findMany({
      where: { companyId },
      select: { email: true },
    });
    const known = new Set(existingContacts.map((contact) => contact.email.trim().toLowerCase()));
    let contactsCreated = 0;
    for (const sender of senders) {
      if (known.has(sender.email)) continue;
      const { firstName, lastName } = personNameFrom(sender.name, sender.email);
      await tx.contact.create({
        data: {
          companyId,
          firstName,
          lastName,
          email: sender.email,
          communicationPreferences: [],
          isPrimary: contactsCreated === 0 && existingContacts.length === 0,
          ownerUserId: lead.adminUserId,
          createdById: actor.id,
          notes: "Created from stored Gmail correspondence",
        },
      });
      contactsCreated += 1;
    }

    // Only messages nobody has attributed yet. An operator who moved one to
    // another company by hand outranks this.
    const linked = await tx.emailMessage.updateMany({
      where: { id: { in: messages.map((message) => message.id) }, companyId: null },
      data: { companyId },
    });

    await writeAudit(tx, actor, {
      action: "company.approved_from_lead",
      entityType: "company",
      entityId: companyId,
      companyId,
      summary:
        `Approved lead "${lead.companyName}" (${registrable}) as ${created ? "new company" : "existing company"} ` +
        `"${companyName}": ${contactsCreated} contact(s), ${linked.count} email(s) linked.`,
      after: {
        leadId: lead.id,
        domain: registrable,
        created,
        contactsCreated,
        messagesLinked: linked.count,
        senders: senders.map((sender) => sender.email),
      },
    });

    // The lead has become the company. EmailMessage.leadId is SetNull, so the
    // mail keeps its history and simply stops pointing at a promoted row.
    await tx.lead.delete({ where: { id: lead.id } });

    return { companyId, companyName, created, contactsCreated, messagesLinked: linked.count };
  });

  return { ok: true, ...outcome };
}

/**
 * "Not a company" — suppress the domain permanently and drop the lead.
 *
 * The suppression has to outlive the lead, because reconcileStoredLeadOwnership
 * DELETES and rebuilds every gmail-source lead on each sync. A flag on the Lead
 * row would be wiped by the next run and the courier, the mailer-daemon or the
 * conference organiser would walk straight back in. SuppressedEntity is a
 * separate table for exactly that reason, and the rebuild reads it.
 */
export async function rejectLeadAsCompany(leadId: string, reason?: string): Promise<RejectLeadResult> {
  const actor = await requireAction("company.create");

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, reason: "lead_not_found" };
  const registrable = registrableDomainOf(lead.sourceDomain);
  if (!registrable) return { ok: false, reason: "no_source_domain" };

  await prisma.$transaction(async (tx) => {
    await tx.suppressedEntity.upsert({
      where: { kind_normalizedValue: { kind: "domain", normalizedValue: registrable } },
      create: {
        kind: "domain",
        value: registrable,
        normalizedValue: registrable,
        reason: reason?.trim() || `Rejected from lead "${lead.companyName}"`,
        createdById: actor.id,
      },
      update: { reason: reason?.trim() || undefined },
    });
    await writeAudit(tx, actor, {
      action: "company.lead_rejected",
      entityType: "lead",
      entityId: lead.id,
      summary: `Rejected lead "${lead.companyName}"; suppressed ${registrable} from ever becoming a company.`,
      before: { companyName: lead.companyName, domain: registrable, emailCount: lead.emailCount },
      after: { suppressedDomain: registrable, reason: reason?.trim() || null },
    });
    await tx.lead.delete({ where: { id: lead.id } });
  });

  return { ok: true, domain: registrable };
}

/** Attach a lead's domain and mail to a company that already exists. */
export async function linkLeadToCompany(leadId: string, companyId: string): Promise<LinkLeadResult> {
  const actor = await requireAction("company.edit");

  const [lead, company] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true, legalName: true, tradingName: true } }),
  ]);
  if (!lead) return { ok: false, reason: "lead_not_found" };
  if (!company) return { ok: false, reason: "company_not_found" };

  const registrable = registrableDomainOf(lead.sourceDomain);
  if (!registrable) return { ok: false, reason: "no_source_domain" };
  if (isFreemailDomain(registrable) || isInfrastructureDomain(registrable)) {
    return { ok: false, reason: "unusable_domain" };
  }

  const claimed = await prisma.companyDomain.findUnique({
    where: { domain: registrable },
    select: { companyId: true, company: { select: { legalName: true } } },
  });
  // One domain, one company. Silently repointing it would move every past and
  // future message from that domain without anyone being told.
  if (claimed && claimed.companyId !== companyId) {
    return { ok: false, reason: "domain_taken", details: claimed.company.legalName };
  }

  const messages = await inboundMessagesForDomain(registrable);

  const linked = await prisma.$transaction(async (tx) => {
    if (!claimed) {
      await tx.companyDomain.create({
        data: {
          companyId,
          domain: registrable,
          verified: true,
          source: "reconciliation",
          createdById: actor.id,
        },
      });
    }
    const normalizedName = normalizeEntityName(lead.companyName);
    if (normalizedName.length >= 2) {
      await tx.companyAlias.upsert({
        where: { companyId_normalizedName: { companyId, normalizedName } },
        create: { companyId, name: lead.companyName, normalizedName, kind: "spelling", createdById: actor.id },
        update: {},
      });
    }
    const updated = await tx.emailMessage.updateMany({
      where: { id: { in: messages.map((message) => message.id) }, companyId: null },
      data: { companyId },
    });
    await writeAudit(tx, actor, {
      action: "company.lead_linked",
      entityType: "company",
      entityId: companyId,
      companyId,
      summary:
        `Linked lead "${lead.companyName}" (${registrable}) to ${company.tradingName ?? company.legalName}: ` +
        `${updated.count} email(s).`,
      after: { leadId: lead.id, domain: registrable, messagesLinked: updated.count },
    });
    await tx.lead.delete({ where: { id: lead.id } });
    return updated.count;
  });

  return { ok: true, companyId, messagesLinked: linked };
}

// ── Alias and domain curation ──────────────────────────────────────────────

export async function addCompanyAlias(companyId: string, name: string, kind: AliasKind): Promise<AliasResult> {
  const actor = await requireAction("company.edit");
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { legalName: true } });
  if (!company) return { ok: false, reason: "company_not_found" };

  const trimmed = name.trim();
  const normalizedName = normalizeEntityName(trimmed);
  if (normalizedName.length < 2) return { ok: false, reason: "invalid_name" };

  const existing = await prisma.companyAlias.findUnique({
    where: { companyId_normalizedName: { companyId, normalizedName } },
    select: { id: true },
  });
  if (existing) return { ok: false, reason: "duplicate" };

  const alias = await prisma.$transaction(async (tx) => {
    const row = await tx.companyAlias.create({
      data: { companyId, name: trimmed, normalizedName, kind, createdById: actor.id },
    });
    await writeAudit(tx, actor, {
      action: "company.alias_added",
      entityType: "company",
      entityId: companyId,
      companyId,
      summary: `Added alias "${trimmed}" (${kind}) to ${company.legalName}.`,
      after: { aliasId: row.id, name: trimmed, normalizedName, kind },
    });
    return row;
  });
  return { ok: true, aliasId: alias.id };
}

export async function removeCompanyAlias(aliasId: string): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const actor = await requireAction("company.edit");
  const alias = await prisma.companyAlias.findUnique({ where: { id: aliasId } });
  // Idempotent, and no audit row — this call deleted nothing.
  if (!alias) return { ok: false, reason: "not_found" };

  await prisma.$transaction(async (tx) => {
    await tx.companyAlias.delete({ where: { id: aliasId } });
    await writeAudit(tx, actor, {
      action: "company.alias_removed",
      entityType: "company",
      entityId: alias.companyId,
      companyId: alias.companyId,
      summary: `Removed alias "${alias.name}".`,
      before: { aliasId: alias.id, name: alias.name, normalizedName: alias.normalizedName, kind: alias.kind },
    });
  });
  return { ok: true };
}

export async function addCompanyDomain(companyId: string, domain: string): Promise<DomainResult> {
  const actor = await requireAction("company.edit");
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { legalName: true } });
  if (!company) return { ok: false, reason: "company_not_found" };

  const registrable = registrableDomainOf(domain);
  if (!registrable || isFreemailDomain(registrable) || isInfrastructureDomain(registrable)) {
    return { ok: false, reason: "invalid_domain" };
  }
  const claimed = await prisma.companyDomain.findUnique({
    where: { domain: registrable },
    select: { companyId: true, company: { select: { legalName: true } } },
  });
  if (claimed) {
    if (claimed.companyId === companyId) return { ok: false, reason: "domain_taken", details: company.legalName };
    return { ok: false, reason: "domain_taken", details: claimed.company.legalName };
  }

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.companyDomain.create({
      data: { companyId, domain: registrable, verified: true, source: "manual", createdById: actor.id },
    });
    await writeAudit(tx, actor, {
      action: "company.domain_added",
      entityType: "company",
      entityId: companyId,
      companyId,
      summary: `Added domain ${registrable} to ${company.legalName}.`,
      after: { domainId: created.id, domain: registrable },
    });
    return created;
  });
  return { ok: true, domainId: row.id };
}

export async function removeCompanyDomain(
  domainId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  const actor = await requireAction("company.edit");
  const domain = await prisma.companyDomain.findUnique({ where: { id: domainId } });
  if (!domain) return { ok: false, reason: "not_found" };

  await prisma.$transaction(async (tx) => {
    await tx.companyDomain.delete({ where: { id: domainId } });
    await writeAudit(tx, actor, {
      action: "company.domain_removed",
      entityType: "company",
      entityId: domain.companyId,
      companyId: domain.companyId,
      summary: `Removed domain ${domain.domain}.`,
      before: { domainId: domain.id, domain: domain.domain, source: domain.source },
    });
  });
  return { ok: true };
}

// ── Merge ──────────────────────────────────────────────────────────────────

/**
 * Fold `sourceId` into `targetId` and delete the source row.
 *
 * Every foreign key that names the source is repointed in ONE transaction,
 * driven by COMPANY_MERGE_RELATIONS — which a schema-diff test keeps in step
 * with prisma/schema.prisma, so a relation added to Company next year breaks a
 * test instead of breaking a merge.
 *
 * Financial records refuse the merge rather than moving: an issued quote, order
 * or invoice is an accounting fact about a named counterparty. Same rule, same
 * reason, as removeCompany().
 */
export async function mergeCompanies(sourceId: string, targetId: string): Promise<MergeCompaniesResult> {
  const actor = await requireAction("company.edit");
  if (sourceId === targetId) return { ok: false, reason: "same_company" };

  const [source, target] = await Promise.all([
    prisma.company.findUnique({
      where: { id: sourceId },
      select: { id: true, legalName: true, tradingName: true },
    }),
    prisma.company.findUnique({ where: { id: targetId }, select: { id: true, legalName: true } }),
  ]);
  if (!source) return { ok: false, reason: "source_not_found" };
  if (!target) return { ok: false, reason: "target_not_found" };

  const blocking = await blockingRelationCounts((name) => delegateOf(prisma, name), sourceId);
  if (blocking.length) {
    return { ok: false, reason: "financial_records", details: blocking.join(", ") };
  }

  let outcome: { moved: Record<string, number>; aliasesAdded: number };
  try {
    outcome = await prisma.$transaction(async (tx) => {
      // Shared with scripts/reconcile-email-companies.ts so the two cannot drift.
      const moved = await repointCompanyRelations((name) => delegateOf(tx, name), sourceId, targetId);

      for (const column of COMPANY_ID_COLUMNS_WITHOUT_RELATIONS) {
        if (column.strategy !== "repoint") continue;
        const result = await delegateOf(tx, column.delegate).updateMany({
          where: { [column.foreignKey]: sourceId },
          data: { [column.foreignKey]: targetId },
        });
        moved[column.delegate] = result.count;
      }

      // The source's own names survive as aliases, so mail signed with the old
      // name still resolves to the surviving company.
      let aliasesAdded = 0;
      for (const candidate of [source.legalName, source.tradingName]) {
        const normalizedName = normalizeEntityName(candidate);
        if (normalizedName.length < 2) continue;
        const existing = await tx.companyAlias.findUnique({
          where: { companyId_normalizedName: { companyId: targetId, normalizedName } },
          select: { id: true },
        });
        if (existing) continue;
        await tx.companyAlias.create({
          data: {
            companyId: targetId,
            name: candidate!,
            normalizedName,
            kind: "former_name",
            createdById: actor.id,
          },
        });
        aliasesAdded += 1;
      }

      await tx.company.delete({ where: { id: sourceId } });

      // Same transaction as the delete: an audit row that can be lost while the
      // merge commits is not an audit trail. `before` carries the source's name,
      // which is the only thing left to identify it by afterwards.
      await writeAudit(tx, actor, {
        action: "company.merged",
        entityType: "company",
        entityId: targetId,
        companyId: targetId,
        summary: `Merged "${source.legalName}" into "${target.legalName}".`,
        before: { sourceId, legalName: source.legalName, tradingName: source.tradingName },
        after: { targetId, moved, aliasesAdded },
      });

      return { moved, aliasesAdded };
    });
  } catch (error) {
    // P2003 = foreign key constraint. COMPANY_MERGE_RELATIONS is kept complete
    // by a schema-diff test, so reaching here means something referenced the
    // source AFTER the blocking counts were taken — a quote raised while the
    // dialog was open, say. Raw, that surfaces as an unreadable P2003; named,
    // the user learns records elsewhere are holding the row.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return { ok: false, reason: "linked_records" };
    }
    throw error;
  }

  return {
    ok: true,
    sourceId,
    targetId,
    sourceName: source.legalName,
    moved: outcome.moved,
    aliasesAdded: outcome.aliasesAdded,
  };
}
