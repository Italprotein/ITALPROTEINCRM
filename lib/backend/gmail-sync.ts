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

// Gmail inbox sync engine. For every new inbox message it:
//  1. stores an EmailMessage row (dedupe key: gmailMessageId),
//  2. auto-files ITALPROTEIN NDA attachments as Document (+ version on the
//     company's open NDA, or a new NDA row) — always as under_review, never
//     signed: only a staff member may promote signature state,
//  3. attributes the sender's company NAME to the Italprotein member whose
//     name occurs first in the counterparty's incoming message.

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const FREEMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.it",
  "hotmail.com",
  "hotmail.it",
  "live.com",
  "live.it",
  "yahoo.com",
  "yahoo.it",
  "libero.it",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "gmx.com",
  "gmx.de",
  "mail.com",
  "msn.com",
  "tiscali.it",
  "virgilio.it",
  "alice.it",
  "tin.it",
]);

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
  return FREEMAIL_DOMAINS.has(domain);
}

/** "acme-foods.com" -> "Acme Foods" (crude second-level-domain handling). */
function companyNameFromDomain(domain: string): string | null {
  if (!domain || isFreemail(domain)) return null;
  const parts = domain.split(".");
  if (parts.length < 2) return null;
  const secondLevel = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);
  let label = parts[parts.length - 2];
  if (parts.length >= 3 && secondLevel.has(label)) label = parts[parts.length - 3];
  if (!label) return null;
  const pretty = label
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return pretty || null;
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

async function resolveCompanyId(senderEmail: string, domain: string): Promise<string | null> {
  const orConditions: object[] = [{ email: { equals: senderEmail, mode: "insensitive" } }];
  if (domain && !isFreemail(domain)) {
    orConditions.push(
      { email: { endsWith: `@${domain}`, mode: "insensitive" } },
      { secondaryEmail: { endsWith: `@${domain}`, mode: "insensitive" } },
    );
  }
  const contact = await prisma.contact.findFirst({ where: { OR: orConditions } });
  if (contact) return contact.companyId;
  if (domain && !isFreemail(domain)) {
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

async function createCompanyFromEmail(options: {
  name: string;
  domain: string | null;
  ownerUserId: string;
  emailDate: Date;
  personName?: string;
}): Promise<string> {
  const { name, domain, ownerUserId, emailDate, personName } = options;
  const company = await prisma.company.create({
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
      website: domain ? `https://${domain}` : null,
      relationshipStage: "nda_in_progress",
      // No ndaStatus here: the cache is derived from the register, and the
      // filing step that follows creates the register row and syncs from it.
      // Setting it here produced companies counted with zero NDA rows.
      tags: ["gmail-import"],
      ownerUserId,
    },
  });
  return company.id;
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
    const companyName = companyNameFromDomain(domain);
    if (!companyName) continue;
    const key = companyName.toLocaleLowerCase();
    const bucket = byCompany.get(key) ?? { companyName, sourceDomain: domain, messages: [] };
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
  };
  const auth = await getGmailAuth();
  if (!auth) return { ok: false, error: "gmail_not_connected", ...empty };

  const ndaBackfill = options?.ndaBackfill ?? false;
  const maxMessages = options?.maxMessages ?? (ndaBackfill ? 500 : 200);
  const mailboxEmail = auth.email.toLowerCase();
  const admins = await loadMembers();
  const adminEmails = new Set(admins.map((a) => a.email).filter(Boolean));

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
      const companyName = companyNameFromDomain(senderDomain);
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
              sourceDomain: senderDomain || null,
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
        companyId = await resolveCompanyId(fromEmail, senderDomain);
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
        if (!companyId && isExternal && senderDomain && !isFreemail(senderDomain)) {
          // A real organisation domain we simply have not met yet.
          const ownerId = admin?.id ?? (await fallbackOwnerId(admins));
          const name = companyName ?? from.name ?? from.email.split("@")[0];
          if (ownerId && name) {
            companyId = await createCompanyFromEmail({
              name,
              domain: senderDomain,
              ownerUserId: ownerId,
              emailDate,
              personName: from.name,
            });
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
    const reconciled = await reconcileStoredLeadOwnership(admins, adminEmails);
    result.leadsCreated = reconciled.created;
    result.leadsUpdated = reconciled.updated;
  }
  return result;
}
