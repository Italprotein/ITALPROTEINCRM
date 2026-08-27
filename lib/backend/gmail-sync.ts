import { prisma } from "./prisma";
import {
  extractBodyText,
  getAttachmentBytes,
  getGmailAuth,
  getMessage,
  getThread,
  headerValue,
  listAttachmentMeta,
  listMessageIds,
  parseAddressList,
  type GmailAttachmentMeta,
  type GmailAuth,
  type GmailMessage,
} from "./gmail";
import type { GmailSyncResult } from "@/lib/types";
import {
  fileExtensionOf,
  pickNdaAttachments,
  type NdaMatchConfidence,
} from "./nda-classification";
import { firstMentionedLeadMember } from "./lead-attribution";
import { syncCompanyNdaStatus } from "./nda-status-sync";
import {
  classifyEmailEntity,
  isFreemailDomain,
  isInfrastructureDomain,
  normalizeEntityName,
  organisationNameFromDomain,
  registrableDomainOf,
} from "@/lib/email-entity";
import { isAutomatedReply } from "@/lib/investor/auto-reply";

// Gmail inbox sync engine. For every new inbox message it:
//  1. stores an EmailMessage row (dedupe key: gmailMessageId),
//  2. auto-files ITALPROTEIN NDA attachments as Document (+ version on the
//     company's open NDA, or a new NDA row) — always as under_review, never
//     signed: only a staff member may promote signature state,
//  3. attributes the sender's company NAME to the Italprotein member whose
//     name occurs first in the counterparty's incoming message.

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

// The freemail list, the domain reducer and the entity scorer all live in
// lib/email-entity.ts, which imports no Prisma and is unit-tested. This file
// keeps the I/O; it must not keep a second copy of any of those rules.

interface MemberRecord {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
}

function splitName(name: string | null): { firstName: string; lastName: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

async function loadMembers(): Promise<MemberRecord[]> {
  const rows = await prisma.user.findMany({
    where: { kind: "internal", status: "active" },
    include: { role: true },
  });
  return rows
    .filter((r) => r.name)
    .map((r) => {
      const { firstName, lastName } = splitName(r.name);
      return {
        id: r.id,
        fullName: (r.name ?? "").trim(),
        firstName,
        lastName,
        email: (r.email ?? "").toLowerCase(),
      };
    })
    .filter((a) => a.firstName.length >= 2);
}

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function isFreemail(domain: string): boolean {
  return isFreemailDomain(domain);
}

/** All headers of a message as a plain record, for the auto-reply probe. */
function headerRecord(message: GmailMessage): Record<string, string> {
  const record: Record<string, string> = {};
  for (const header of message.payload?.headers ?? []) {
    if (header?.name) record[header.name] = header.value ?? "";
  }
  return record;
}

/**
 * Domains, and individual addresses, an operator has said must never become
 * anything. Read once per sync run: the register is tiny and every message in
 * the batch is checked against it.
 */
interface SuppressionSets {
  domains: Set<string>;
  emails: Set<string>;
}

async function loadSuppressions(): Promise<SuppressionSets> {
  const rows = await prisma.suppressedEntity.findMany({
    where: { kind: { in: ["domain", "email"] } },
    select: { kind: true, normalizedValue: true },
  });
  return {
    domains: new Set(rows.filter((r) => r.kind === "domain").map((r) => r.normalizedValue)),
    emails: new Set(rows.filter((r) => r.kind === "email").map((r) => r.normalizedValue)),
  };
}

function isSuppressedSender(
  email: string,
  registrableDomain: string,
  suppressions: SuppressionSets,
): boolean {
  if (suppressions.emails.has(email.trim().toLowerCase())) return true;
  return registrableDomain !== "" && suppressions.domains.has(registrableDomain);
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

// ── Member matching ────────────────────────────────────────────────────────

function matchLeadMember(body: string, admins: MemberRecord[]): MemberRecord | null {
  return firstMentionedLeadMember(body, admins);
}

// ── Company resolution for NDA filing ──────────────────────────────────────

/**
 * Which company is this address? A ladder, strongest evidence first.
 *
 *  1. a Contact row carrying the address, or an address on the same domain
 *  2. the CompanyDomain register, matched on the REGISTRABLE domain
 *  3. the CompanyAlias register, when we have a name to match
 *  4. Company.website containing the domain — last, because it is a substring
 *     test on a free-text field: website "https://acme.com/partners/foo.it"
 *     contains "foo.it".
 *
 * Every rung is a read. Nothing here writes, so a wrong answer costs one
 * mis-linked message that a person can move, not a row nobody asked for.
 */
async function resolveCompanyId(
  senderEmail: string,
  domain: string,
  senderName?: string | null,
): Promise<string | null> {
  const registrable = registrableDomainOf(senderEmail) || registrableDomainOf(domain);
  const usableDomain = Boolean(domain) && !isFreemail(domain) && !isInfrastructureDomain(domain);

  // 1. Contacts.
  const orConditions: object[] = [{ email: { equals: senderEmail, mode: "insensitive" } }];
  if (usableDomain) {
    orConditions.push(
      { email: { endsWith: `@${domain}`, mode: "insensitive" } },
      { secondaryEmail: { endsWith: `@${domain}`, mode: "insensitive" } },
    );
  }
  const contact = await prisma.contact.findFirst({ where: { OR: orConditions } });
  if (contact) return contact.companyId;

  // 2. The domain register. Both the literal sending domain and its registrable
  // base, so a company registered as "bulla.com.au" still matches mail sent
  // from "mail.bulla.com.au".
  if (usableDomain && registrable) {
    const candidates = [...new Set([domain, registrable])];
    const mapped = await prisma.companyDomain.findFirst({
      where: { domain: { in: candidates }, verified: true },
      select: { companyId: true },
    });
    if (mapped) return mapped.companyId;
  }

  // 3. The alias register. The sender's display name first (a signature block
  // often carries the trading name), then the name the domain implies.
  const nameCandidates = [senderName, usableDomain ? organisationNameFromDomain(registrable) : null];
  for (const candidate of nameCandidates) {
    const normalizedName = normalizeEntityName(candidate);
    // Two characters is not a company name, it is a coin flip.
    if (normalizedName.length < 3) continue;
    const matches = await prisma.companyAlias.findMany({
      where: { normalizedName },
      select: { companyId: true },
      take: 2,
    });
    const companyIds = [...new Set(matches.map((match) => match.companyId))];
    // Exactly one, or the name is ambiguous across companies and links nothing.
    if (companyIds.length === 1) return companyIds[0];
  }

  // 4. The old website-substring fallback, kept last.
  if (usableDomain) {
    const company = await prisma.company.findFirst({
      where: { website: { contains: domain, mode: "insensitive" } },
    });
    if (company) return company.id;
  }
  return null;
}

async function resolveUniqueCompanyFromEmails(
  emails: string[],
  adminEmails: Set<string>,
): Promise<{ companyId: string | null; counterpartyEmail: string | null }> {
  const externalEmails = [...new Set(emails.map((email) => email.toLowerCase()))].filter((email) => {
    const domain = domainOf(email);
    return domain && domain !== "italprotein.com" && !adminEmails.has(email);
  });
  const resolved = await Promise.all(
    externalEmails.slice(0, 20).map(async (email) => ({
      email,
      companyId: await resolveCompanyId(email, domainOf(email)),
    })),
  );
  const companyIds = [...new Set(resolved.map((item) => item.companyId).filter(Boolean))];
  if (companyIds.length !== 1) return { companyId: null, counterpartyEmail: externalEmails[0] ?? null };
  const companyId = companyIds[0] ?? null;
  const resolvedDomains = new Set(
    resolved.filter((item) => item.companyId === companyId).map((item) => domainOf(item.email)),
  );
  const hasUnknownOutsideCompanyDomain = resolved.some(
    (item) => !item.companyId && !resolvedDomains.has(domainOf(item.email)),
  );
  if (hasUnknownOutsideCompanyDomain) {
    return { companyId: null, counterpartyEmail: externalEmails[0] ?? null };
  }
  return {
    companyId,
    counterpartyEmail: resolved.find((item) => item.companyId === companyId)?.email ?? externalEmails[0] ?? null,
  };
}

async function fallbackOwnerId(admins: MemberRecord[]): Promise<string | null> {
  if (admins.length) return admins[0].id;
  const anyInternal = await prisma.user.findFirst({
    where: { kind: "internal", status: "active" },
    orderBy: { createdAt: "asc" },
  });
  return anyInternal?.id ?? null;
}

/**
 * Find or create the company that owns a registrable domain, idempotently.
 *
 * This replaced a bare `prisma.company.create`, which is how production ended
 * up with FOUR "Pphosted" companies created on 2026-08-24 — one per Proofpoint
 * bounce, each bounce arriving from a different per-message host
 * (mx0a-0025e601.pphosted.com and friends) so nothing ever looked like a
 * repeat. Two things fix that and both are needed:
 *
 *  - the caller only gets here after classifyEmailEntity returns
 *    `link_or_create`, which a bounce cannot reach; and
 *  - the domain is stored REGISTRABLE in company_domains, whose UNIQUE
 *    constraint makes the second attempt a lookup instead of an insert —
 *    including two sync runs racing on the same domain in the same instant.
 *
 * The audit event is not optional bookkeeping. A company nobody asked for is
 * only tolerable if the answer to "why is this here" is one query away, so the
 * scorer's evidence array is written with the row.
 */
async function ensureCompanyForDomain(options: {
  name: string;
  registrableDomain: string;
  ownerUserId: string;
  emailDate: Date;
  personName?: string | null;
  senderEmail: string;
  score: number;
  evidence: string[];
}): Promise<{ companyId: string | null; created: boolean }> {
  const {
    name,
    registrableDomain,
    ownerUserId,
    emailDate,
    personName,
    senderEmail,
    score,
    evidence,
  } = options;
  const normalizedName = normalizeEntityName(name);

  const attachDomain = async (
    tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
    companyId: string,
  ) => {
    await tx.companyDomain.create({
      data: { companyId, domain: registrableDomain, verified: true, source: "gmail_sync" },
    });
  };

  try {
    return await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction: the resolution ladder ran before the
      // attachments were read, which is a long time in a 200-message batch.
      const mapped = await tx.companyDomain.findUnique({
        where: { domain: registrableDomain },
        select: { companyId: true },
      });
      if (mapped) return { companyId: mapped.companyId, created: false };

      // A company we already hold under this name: adopt it and record the
      // domain, so the next message from it takes rung 2 of the ladder.
      if (normalizedName.length >= 3) {
        const aliasMatches = await tx.companyAlias.findMany({
          where: { normalizedName },
          select: { companyId: true },
          take: 2,
        });
        const aliasIds = [...new Set(aliasMatches.map((match) => match.companyId))];
        if (aliasIds.length === 1) {
          await attachDomain(tx, aliasIds[0]);
          return { companyId: aliasIds[0], created: false };
        }
        if (aliasIds.length > 1) return { companyId: null, created: false };
      }
      const byName = await tx.company.findFirst({
        where: {
          OR: [
            { legalName: { equals: name, mode: "insensitive" } },
            { tradingName: { equals: name, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (byName) {
        await attachDomain(tx, byName.id);
        return { companyId: byName.id, created: false };
      }

      const company = await tx.company.create({
        data: {
          legalName: name,
          type: "other",
          initials: initialsOf(name),
          headquarters: { line1: "", city: "", country: "", countryCode: "" },
          firstContact: {
            date: emailDate.toISOString(),
            channel: "gmail",
            personName: personName ?? undefined,
            note: "Auto-created from Gmail sync",
          },
          country: "",
          countryCode: "",
          city: "",
          website: `https://${registrableDomain}`,
          relationshipStage: "nda_in_progress",
          // No ndaStatus here: the cache is derived from the register, and the
          // filing step that follows creates the register row and syncs from it.
          // Setting it here produced companies counted with zero NDA rows.
          tags: ["gmail-import"],
          ownerUserId,
        },
      });
      await attachDomain(tx, company.id);
      await tx.companyAlias.create({
        data: { companyId: company.id, name, normalizedName, kind: "legal_name" },
      });
      await tx.auditEvent.create({
        data: {
          action: "company.auto_created",
          entityType: "company",
          entityId: company.id,
          companyId: company.id,
          summary: `Auto-created "${name}" (${registrableDomain}) from an NDA attachment sent by ${senderEmail}.`,
          after: { source: "gmail_sync", domain: registrableDomain, senderEmail, score, evidence },
          result: "success",
        },
      });
      return { companyId: company.id, created: true };
    });
  } catch {
    // Almost certainly the UNIQUE on company_domains.domain: another run won
    // the race, and its company is the right answer for this message too.
    const mapped = await prisma.companyDomain
      .findUnique({ where: { domain: registrableDomain }, select: { companyId: true } })
      .catch(() => null);
    return { companyId: mapped?.companyId ?? null, created: false };
  }
}

// ── NDA detection + filing ─────────────────────────────────────────────────

async function nextNdaReference(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 6; i += 1) {
    const candidate = `NDA-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const existing = await prisma.nDA.findUnique({ where: { reference: candidate } });
    if (!existing) return candidate;
  }
  return `NDA-${year}-${Date.now().toString(36).toUpperCase()}`;
}

/** Store the attachment bytes as a Document (+Attachment) and return both ids. */
async function storeNdaDocument(options: {
  auth: GmailAuth;
  message: GmailMessage;
  attachment: GmailAttachmentMeta;
  companyId: string | null;
  emailDate: Date;
  description: string;
}): Promise<{ documentId: string; storageKey: string; sizeBytes: number } | null> {
  const { auth, message, attachment, companyId, emailDate, description } = options;
  if (attachment.sizeBytes > MAX_ATTACHMENT_BYTES) return null;

  // Cheap idempotency: the same file arriving again (forward, re-send, second
  // sync overlap window) must not produce a second Document row.
  const duplicate = await prisma.document.findFirst({
    where: {
      companyId,
      category: "nda",
      title: attachment.filename,
      sizeBytes: attachment.sizeBytes,
    },
    select: { id: true },
  });
  if (duplicate) return null;

  const bytes = await getAttachmentBytes(auth, message.id, attachment.attachmentId);
  const ext = fileExtensionOf(attachment.filename) || "pdf";

  const document = await prisma.document.create({
    data: {
      title: attachment.filename,
      category: "nda",
      confidentialityClass: "internal",
      companyId,
      fileType: ext,
      mimeType: attachment.mimeType,
      sizeBytes: bytes.length,
      uploadedAt: emailDate,
      description,
    },
  });
  const stored = await prisma.attachment.create({
    data: {
      name: attachment.filename,
      fileType: ext,
      mimeType: attachment.mimeType,
      sizeBytes: bytes.length,
      sizeKb: Math.round(bytes.length / 1024),
      bytes: new Uint8Array(bytes),
      documentId: document.id,
      uploadedAt: emailDate,
    },
  });
  const storageKey = `db:attachment:${stored.id}`;
  await prisma.attachment.update({ where: { id: stored.id }, data: { storageKey } });
  await prisma.document.update({ where: { id: document.id }, data: { storageKey } });
  return { documentId: document.id, storageKey, sizeBytes: bytes.length };
}

/**
 * Advance the register row into review, then re-derive the company cache from
 * it. Company.ndaStatus is the portal's access gate, so `neverRegress` keeps an
 * inbound email from walking a company back out of a signature state a staff
 * member already asserted.
 */
async function advanceCompanyNdaStatus(
  companyId: string,
  emailDate: Date,
  ndaId?: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    if (ndaId) {
      await tx.nDA.updateMany({
        where: { id: ndaId, status: { in: ["not_required", "to_prepare", "draft", "sent"] } },
        data: { status: "under_review" },
      });
    }
    await tx.company.update({ where: { id: companyId }, data: { lastActivityAt: emailDate } });
    await syncCompanyNdaStatus(tx, companyId, { neverRegress: true });
  }).catch(() => undefined);
}

/**
 * File one matched attachment for a known company. If the company already has
 * an open NDA, the file lands as its next DocumentVersion instead of minting a
 * duplicate NDA row. Status is under_review, always — never signed.
 */
async function fileNdaFromAttachment(options: {
  auth: GmailAuth;
  message: GmailMessage;
  attachment: GmailAttachmentMeta;
  confidence: NdaMatchConfidence;
  companyId: string;
  senderEmail: string;
  emailDate: Date;
}): Promise<{ ndaId: string; createdNda: boolean } | null> {
  const { auth, message, attachment, confidence, companyId, senderEmail, emailDate } = options;

  const stored = await storeNdaDocument({
    auth,
    message,
    attachment,
    companyId,
    emailDate,
    description:
      confidence === "high"
        ? `Imported from the Gmail thread with ${senderEmail}.`
        : `Imported from the Gmail thread with ${senderEmail} (NDA filename match — verify).`,
  });
  if (!stored) return null;

  const open = await prisma.nDA.findFirst({
    where: { companyId, status: { notIn: ["expired", "terminated"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true, _count: { select: { versions: true } } },
  });

  if (open) {
    await prisma.documentVersion.create({
      data: {
        ndaId: open.id,
        documentId: stored.documentId,
        version: `v1.${open._count.versions}`,
        versionDate: emailDate,
        note: `Received via email from ${senderEmail}`,
        storageKey: stored.storageKey,
        mimeType: attachment.mimeType,
        sizeBytes: stored.sizeBytes,
      },
    });
    await advanceCompanyNdaStatus(companyId, emailDate, open.id);
    return { ndaId: open.id, createdNda: false };
  }

  const nda = await prisma.nDA.create({
    data: {
      reference: await nextNdaReference(),
      companyId,
      type: "mutual",
      status: "under_review",
      dateSent: emailDate,
      sentAt: emailDate,
      signedAt: null,
      signedFileId: null,
      versions: {
        create: [
          {
            version: "v1.0",
            versionDate: emailDate,
            note: `Received via email from ${senderEmail}`,
            documentId: stored.documentId,
            storageKey: stored.storageKey,
            mimeType: attachment.mimeType,
            sizeBytes: stored.sizeBytes,
          },
        ],
      },
    },
  });
  await advanceCompanyNdaStatus(companyId, emailDate, nda.id);
  return { ndaId: nda.id, createdNda: true };
}

/**
 * NDA from a sender we cannot attribute (freemail, no usable domain): keep the
 * file, skip the guesswork. No company row, no NDA row — an internal-class
 * Document plus an audit event that lands it in the review queue.
 */
async function parkUnattributedNda(options: {
  auth: GmailAuth;
  message: GmailMessage;
  attachment: GmailAttachmentMeta;
  senderEmail: string;
  emailDate: Date;
}): Promise<void> {
  const { auth, message, attachment, senderEmail, emailDate } = options;
  const stored = await storeNdaDocument({
    auth,
    message,
    attachment,
    companyId: null,
    emailDate,
    description: `Unattributed NDA from ${senderEmail} — needs company assignment.`,
  });
  if (!stored) return;
  await prisma.auditEvent
    .create({
      data: {
        action: "nda.auto_file_unattributed",
        entityType: "document",
        entityId: stored.documentId,
        summary: `NDA-named attachment "${attachment.filename}" from ${senderEmail} filed without a company — assign manually.`,
      },
    })
    .catch(() => undefined);
}

/**
 * Rebuild Gmail-derived leads from stored inbound messages. This makes the new
 * ownership rule apply to historical mail as well as messages fetched today.
 * The first inbound message for a company that mentions a member establishes
 * that company's responsible owner; quoted thread history is ignored.
 */
async function reconcileStoredLeadOwnership(
  members: MemberRecord[],
  memberEmails: Set<string>,
  suppressions: SuppressionSets,
): Promise<{ created: number; updated: number }> {
  const messages = await prisma.emailMessage.findMany({
    where: { direction: "inbound" },
    orderBy: { internalDate: "asc" },
    select: { id: true, fromAddress: true, bodyText: true, internalDate: true },
  });

  type StoredMessage = (typeof messages)[number];
  const byCompany = new Map<
    string,
    { companyName: string; sourceDomain: string; messages: StoredMessage[] }
  >();

  for (const message of messages) {
    const from = message.fromAddress.toLowerCase();
    const domain = domainOf(from);
    if (!domain || domain === "italprotein.com" || memberEmails.has(from)) continue;
    // Mail infrastructure and anything an operator suppressed are skipped here
    // as well as on the creation path. This rebuild wipes and re-derives every
    // gmail-source lead on each run, so without this rung a bounce handler that
    // was cleaned out by hand simply reappears as a lead the next time the sync
    // runs, and "Pphosted is gone" would only ever be true until tomorrow.
    const registrable = registrableDomainOf(from);
    if (!registrable) continue;
    if (isInfrastructureDomain(domain) || isSuppressedSender(from, registrable, suppressions)) {
      continue;
    }
    const companyName = organisationNameFromDomain(registrable);
    if (!companyName) continue;
    const key = companyName.toLocaleLowerCase();
    // The registrable base, not the sending host: this is the string a future
    // promotion writes into CompanyDomain, and it has to be the one the sync
    // matches on.
    const bucket = byCompany.get(key) ?? { companyName, sourceDomain: registrable, messages: [] };
    bucket.messages.push(message);
    byCompany.set(key, bucket);
  }

  const desired = [...byCompany.values()]
    .map((bucket) => {
      const establishingMessage = bucket.messages.find((message) =>
        firstMentionedLeadMember(message.bodyText ?? "", members),
      );
      if (!establishingMessage) return null;
      const owner = firstMentionedLeadMember(establishingMessage.bodyText ?? "", members);
      if (!owner) return null;
      return {
        ...bucket,
        owner,
        firstSeenAt: bucket.messages[0].internalDate,
        lastSeenAt: bucket.messages[bucket.messages.length - 1].internalDate,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const oldLeads = await prisma.lead.findMany({ where: { source: "gmail" } });
  let created = 0;
  let updated = 0;

  await prisma.$transaction(async (tx) => {
    if (oldLeads.length) {
      await tx.emailMessage.updateMany({
        where: { leadId: { in: oldLeads.map((lead) => lead.id) } },
        data: { leadId: null, matchedAdminUserId: null },
      });
    }

    const retained = new Set<string>();
    for (const entry of desired) {
      const existing = oldLeads.find(
        (lead) =>
          lead.adminUserId === entry.owner.id &&
          lead.companyName.toLocaleLowerCase() === entry.companyName.toLocaleLowerCase(),
      );
      const lead = existing
        ? await tx.lead.update({
            where: { id: existing.id },
            data: {
              sourceDomain: entry.sourceDomain,
              emailCount: entry.messages.length,
              firstSeenAt: entry.firstSeenAt,
              lastSeenAt: entry.lastSeenAt,
            },
          })
        : await tx.lead.create({
            data: {
              adminUserId: entry.owner.id,
              companyName: entry.companyName,
              sourceDomain: entry.sourceDomain,
              source: "gmail",
              emailCount: entry.messages.length,
              firstSeenAt: entry.firstSeenAt,
              lastSeenAt: entry.lastSeenAt,
            },
          });
      existing ? (updated += 1) : (created += 1);
      retained.add(lead.id);
      await tx.emailMessage.updateMany({
        where: { id: { in: entry.messages.map((message) => message.id) } },
        data: { leadId: lead.id, matchedAdminUserId: entry.owner.id },
      });
    }

    const obsoleteIds = oldLeads
      .map((lead) => lead.id)
      .filter((leadId) => !retained.has(leadId));
    if (obsoleteIds.length) {
      await tx.lead.deleteMany({ where: { id: { in: obsoleteIds } } });
    }
  });

  return { created, updated };
}

// ── Main sync ──────────────────────────────────────────────────────────────

export async function runGmailSync(options?: {
  maxMessages?: number;
  ndaBackfill?: boolean;
}): Promise<GmailSyncResult> {
  const empty = {
    fetched: 0,
    created: 0,
    ndasCreated: 0,
    ndaFilesImported: 0,
    leadsCreated: 0,
    leadsUpdated: 0,
    companiesCreated: 0,
    companiesSkipped: 0,
  };
  const auth = await getGmailAuth();
  if (!auth) return { ok: false, error: "gmail_not_connected", ...empty };

  const ndaBackfill = options?.ndaBackfill ?? false;
  const maxMessages = options?.maxMessages ?? (ndaBackfill ? 500 : 200);
  const mailboxEmail = auth.email.toLowerCase();
  const admins = await loadMembers();
  const adminEmails = new Set(admins.map((a) => a.email).filter(Boolean));
  const suppressions = await loadSuppressions();

  const newest = await prisma.emailMessage.findFirst({
    where: { direction: "inbound" },
    orderBy: { internalDate: "desc" },
    select: { internalDate: true },
  });
  const query = newest
    ? `in:inbox after:${Math.floor((newest.internalDate.getTime() - 24 * 3600 * 1000) / 1000)}`
    : "in:inbox newer_than:90d";

  let refs;
  try {
    if (ndaBackfill) {
      // Search Inbox and Sent so the NDA page rescans established company
      // threads instead of looking only at new inbound messages.
      refs = await listMessageIds(
        auth,
        'newer_than:5y has:attachment {filename:nda filename:"n.d.a"}',
        maxMessages,
      );
    } else {
      const [regular, courier] = await Promise.all([
        listMessageIds(auth, query, maxMessages),
        listMessageIds(
          auth,
          "newer_than:2y {from:(dhl.com) from:(brt.it) from:(poste.it) from:(sda.it) subject:(DHL) subject:(BRT)}",
          500,
        ),
      ]);
      refs = [...new Map([...regular, ...courier].map((item) => [item.id, item])).values()];
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "gmail_list_failed", ...empty };
  }

  const existingRows = await prisma.emailMessage.findMany({
    where: { gmailMessageId: { in: refs.map((r) => r.id) } },
    select: { id: true, gmailMessageId: true, gmailThreadId: true, companyId: true },
  });
  const existingByMessageId = new Map(
    existingRows.map((row) => [row.gmailMessageId, row]),
  );
  const candidates = ndaBackfill
    ? refs
    : refs.filter((ref) => !existingByMessageId.has(ref.id));
  const threadCompanyIds = new Map<string, string>();
  for (const row of existingRows) {
    if (row.companyId) threadCompanyIds.set(row.gmailThreadId, row.companyId);
  }

  const result: GmailSyncResult = { ok: true, ...empty, fetched: refs.length };
  for (const ref of candidates) {
    try {
      const message = await getMessage(auth, ref.id);
      const from = parseAddressList(headerValue(message, "From"))[0];
      if (!from) continue;
      const to = parseAddressList(headerValue(message, "To")).map((a) => a.email.toLowerCase());
      const cc = parseAddressList(headerValue(message, "Cc")).map((a) => a.email.toLowerCase());
      const subject = headerValue(message, "Subject") ?? "";
      const body = extractBodyText(message.payload);
      const attachments = listAttachmentMeta(message.payload);
      const emailDate = new Date(Number(message.internalDate ?? Date.now()));
      const fromEmail = from.email.toLowerCase();
      const direction = fromEmail === mailboxEmail ? "outbound" : "inbound";
      const senderDomain = domainOf(fromEmail);
      const senderRegistrable = registrableDomainOf(fromEmail);
      const headers = headerRecord(message);
      // One automation verdict per message, from the one detector
      // (lib/investor/auto-reply.ts). Everything downstream consumes this flag
      // rather than re-deriving it, so the two can never disagree.
      const automatedSender = isAutomatedReply({
        from: headerValue(message, "From") ?? fromEmail,
        subject,
        headers,
      });
      // A sender that must never become a lead, a company, or anything else.
      const senderIsNoise =
        !senderRegistrable ||
        isInfrastructureDomain(senderDomain) ||
        isSuppressedSender(fromEmail, senderRegistrable, suppressions);

      const existingRow = existingByMessageId.get(message.id);
      const row = existingRow ?? (await prisma.emailMessage.create({
          data: {
            gmailMessageId: message.id,
            gmailThreadId: message.threadId,
            direction,
            fromAddress: fromEmail,
            fromName: from.name ?? null,
            toAddresses: to,
            ccAddresses: cc,
            subject: subject || null,
            snippet: message.snippet ?? null,
            bodyText: body ? body.slice(0, 20_000) : null,
            internalDate: emailDate,
            hasAttachments: attachments.length > 0,
            attachmentNames: attachments.map((a) => a.filename),
          },
        }));
      if (!existingRow) result.created += 1;

      // Normal sync continues with external inbound messages. The NDA backfill
      // also continues with sent messages so it can inspect the whole thread.
      const isExternal =
        direction === "inbound" &&
        senderDomain !== "italprotein.com" &&
        !adminEmails.has(fromEmail);
      if (!isExternal && !ndaBackfill) continue;

      // ── Lead attribution: first Italprotein member named by the sender.
      const admin = isExternal && !ndaBackfill ? matchLeadMember(body, admins) : null;

      // ── My Leads: store the counterparty company NAME under the admin.
      let leadId: string | null = null;
      const companyName = senderIsNoise ? null : organisationNameFromDomain(senderRegistrable);
      if (admin && companyName) {
        const existingLead = await prisma.lead.findUnique({
          where: { adminUserId_companyName: { adminUserId: admin.id, companyName } },
        });
        if (existingLead) {
          await prisma.lead.update({
            where: { id: existingLead.id },
            data: {
              emailCount: { increment: 1 },
              lastSeenAt:
                emailDate > existingLead.lastSeenAt ? emailDate : existingLead.lastSeenAt,
            },
          });
          leadId = existingLead.id;
          result.leadsUpdated += 1;
        } else {
          const lead = await prisma.lead.create({
            data: {
              adminUserId: admin.id,
              companyName,
              sourceDomain: senderRegistrable || null,
              source: "gmail",
              firstSeenAt: emailDate,
              lastSeenAt: emailDate,
            },
          });
          leadId = lead.id;
          result.leadsCreated += 1;
        }
      }

      // ── Company attribution, then NDA auto-filing.
      let ndaId: string | null = null;
      let ndaDetected = false;

      // Attribute every inbound message we can place. This lookup used to live
      // inside the NDA branch below, so a message was only ever linked to a
      // company when the sender happened to attach an agreement: on production
      // that left 18 of 317 inbound emails attributed, and every one of the 18
      // was an NDA. Ordinary correspondence — samples, pricing, logistics —
      // was invisible to anything reasoning about a company's history.
      let companyId: string | null =
        existingRow?.companyId ?? threadCompanyIds.get(message.threadId) ?? null;
      if (!companyId) {
        const linkedThreadMessage = await prisma.emailMessage.findFirst({
          where: { gmailThreadId: message.threadId, companyId: { not: null } },
          orderBy: { internalDate: "desc" },
          select: { companyId: true },
        });
        companyId = linkedThreadMessage?.companyId ?? null;
      }

      let counterpartyEmail = fromEmail;
      if (isExternal && !companyId) {
        companyId = await resolveCompanyId(fromEmail, senderDomain, from.name ?? null);
      } else if (direction === "outbound") {
        const resolvedRecipients = await resolveUniqueCompanyFromEmails([...to, ...cc], adminEmails);
        counterpartyEmail = resolvedRecipients.counterpartyEmail ?? fromEmail;
        if (!companyId) {
          companyId = resolvedRecipients.companyId;
        }
      }
      if (!companyId && ndaBackfill) {
        // If the attachment message itself is not enough, inspect every sender
        // and recipient in its Gmail thread and accept only one unambiguous CRM
        // company. This prevents cross-company filing on multi-party threads.
        const thread = await getThread(auth, message.threadId).catch(() => ({ messages: [] }));
        const threadEmails = (thread.messages ?? []).flatMap((threadMessage) => [
          ...parseAddressList(headerValue(threadMessage, "From")).map((address) => address.email),
          ...parseAddressList(headerValue(threadMessage, "To")).map((address) => address.email),
          ...parseAddressList(headerValue(threadMessage, "Cc")).map((address) => address.email),
        ]);
        const resolvedThread = await resolveUniqueCompanyFromEmails(threadEmails, adminEmails);
        companyId = resolvedThread.companyId;
        counterpartyEmail = resolvedThread.counterpartyEmail ?? counterpartyEmail;
      }
      if (companyId) threadCompanyIds.set(message.threadId, companyId);

      const ndaMatches = pickNdaAttachments(attachments, subject);
      if (ndaMatches.length) {
        ndaDetected = true;
        // Creating a company from a sender we have never met stays on the NDA
        // path deliberately. An agreement is evidence of a real relationship;
        // an ordinary email is not, and auto-creating from every unknown domain
        // would fill the CRM with couriers and newsletters.
        //
        // "Has an NDA-looking attachment" was, on its own, the whole test until
        // 2026-08-27 — and a Proofpoint bounce returning OUR OWN NDA passes it.
        // Now the sender has to survive the scorer as well, which a machine, a
        // relay and a suppressed domain each cannot.
        if (!companyId && isExternal && senderDomain) {
          const classification = classifyEmailEntity({
            fromEmail,
            fromName: from.name ?? null,
            subject,
            headers,
            isAutomatedReply: automatedSender,
            hasNdaAttachment: true,
            isSuppressed: senderIsNoise,
          });
          const ownerId =
            classification.verdict === "link_or_create"
              ? admin?.id ?? (await fallbackOwnerId(admins))
              : null;
          // Deliberately NOT `?? from.name`: the display name on an email is a
          // person, and "Olivia Li" is not a company. If the domain cannot name
          // an organisation, nothing here can, and the attachment is parked for
          // a human to assign instead.
          const name = companyName;
          if (ownerId && name && senderRegistrable) {
            const outcome = await ensureCompanyForDomain({
              name,
              registrableDomain: senderRegistrable,
              ownerUserId: ownerId,
              emailDate,
              personName: from.name,
              senderEmail: fromEmail,
              score: classification.score,
              evidence: classification.evidence,
            });
            companyId = outcome.companyId;
            if (outcome.created) result.companiesCreated += 1;
            if (!outcome.companyId) result.companiesSkipped += 1;
          } else {
            // Counted, not logged: a skip is a normal outcome on a mailbox that
            // receives bounces, and the count is what tells an operator whether
            // the guard is doing anything.
            result.companiesSkipped += 1;
          }
        }
        for (const match of ndaMatches) {
          if (companyId) {
            const filed = await fileNdaFromAttachment({
              auth,
              message,
              attachment: match.attachment,
              confidence: match.confidence,
              companyId,
              senderEmail: counterpartyEmail,
              emailDate,
            });
            if (filed) {
              ndaId = filed.ndaId;
              result.ndaFilesImported += 1;
              if (filed.createdNda) result.ndasCreated += 1;
            }
          } else {
            // Freemail / unattributable sender: keep the file, skip the guess.
            await parkUnattributedNda({
              auth,
              message,
              attachment: match.attachment,
              senderEmail: counterpartyEmail,
              emailDate,
            });
          }
        }
      }

      if (admin || leadId || ndaId || companyId || ndaDetected) {
        await prisma.emailMessage.update({
          where: { id: row.id },
          data: {
            ...(admin ? { matchedAdminUserId: admin.id } : {}),
            ...(leadId ? { leadId } : {}),
            ...(ndaId ? { ndaId } : {}),
            ...(ndaDetected ? { ndaDetected: true } : {}),
            ...(companyId ? { companyId } : {}),
          },
        });
      }
    } catch {
      // One malformed message must not abort the whole sync run.
      continue;
    }
  }

  if (!ndaBackfill) {
    const reconciled = await reconcileStoredLeadOwnership(admins, adminEmails, suppressions);
    result.leadsCreated = reconciled.created;
    result.leadsUpdated = reconciled.updated;
  }
  return result;
}
