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

// Gmail inbox sync engine. For every new inbox message it:
//  1. stores an EmailMessage row (dedupe key: gmailMessageId),
//  2. auto-files "NDA" attachments as Document + DocumentVersion + NDA rows,
//  3. attributes the sender's company NAME to an admin's "My Leads" list —
//     matched via the "Dear <admin>" greeting, falling back to the admin
//     signature on the FIRST sent mail of the thread.

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const NDA_FILE_EXTENSIONS = new Set(["pdf", "doc", "docx", "rtf", "odt"]);
const GREETING_WORDS = ["dear", "hi", "hello", "ciao", "gentile", "caro", "cara", "buongiorno"];

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

interface AdminRecord {
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

async function loadAdmins(): Promise<AdminRecord[]> {
  const rows = await prisma.user.findMany({
    where: { kind: "internal", status: "active" },
    include: { role: true },
  });
  return rows
    .filter((r) => ["super_admin", "crm_admin"].includes(r.role.key) && r.name)
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

// ── Admin matching ("Dear <name>" / signature) ─────────────────────────────

function matchAdminInGreeting(body: string, admins: AdminRecord[]): AdminRecord | null {
  const head = body.slice(0, 600);
  const greeting = new RegExp(
    `\\b(?:${GREETING_WORDS.join("|")})\\s+([\\p{L}'’-]+)(?:\\s+([\\p{L}'’-]+))?`,
    "iu",
  );
  const match = head.match(greeting);
  if (!match) return null;
  const first = (match[1] ?? "").toLowerCase();
  const second = (match[2] ?? "").toLowerCase();
  for (const admin of admins) {
    const fn = admin.firstName.toLowerCase();
    const ln = admin.lastName.toLowerCase();
    if (first === fn && (!second || !ln || second === ln)) return admin;
    if (ln && first === ln && second === fn) return admin;
  }
  return null;
}

/** Look for an admin name in the signature zone (last lines) of a sent mail. */
function matchAdminInSignature(body: string, admins: AdminRecord[]): AdminRecord | null {
  const lines = body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith(">"));
  const zone = lines.slice(-12);
  for (const admin of admins) {
    const full = admin.fullName.toLowerCase();
    for (const line of zone) {
      const lower = line.toLowerCase();
      if (full && lower.includes(full)) return admin;
      // Signature-like short line that is exactly / starts with the first name.
      if (
        line.split(/\s+/).length <= 4 &&
        (lower === admin.firstName.toLowerCase() ||
          lower.startsWith(`${admin.firstName.toLowerCase()} `))
      ) {
        return admin;
      }
    }
  }
  return null;
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

async function fallbackOwnerId(admins: AdminRecord[]): Promise<string | null> {
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
      ndaStatus: "under_review",
      tags: ["gmail-import"],
      ownerUserId,
    },
  });
  return company.id;
}

// ── NDA detection + filing ─────────────────────────────────────────────────

function fileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function pickNdaAttachment(
  attachments: GmailAttachmentMeta[],
  subject: string,
  body: string,
): GmailAttachmentMeta | null {
  const docs = attachments.filter((a) => NDA_FILE_EXTENSIONS.has(fileExtension(a.filename)));
  const byName = docs.find((a) => /nda/i.test(a.filename));
  if (byName) return byName;
  // "NDA" as an uppercase word in the mail itself + a document attached.
  if (/\bNDA\b/.test(`${subject}\n${body}`)) return docs[0] ?? null;
  return null;
}

async function nextNdaReference(): Promise<string> {
  const year = new Date().getFullYear();
  for (let i = 0; i < 6; i += 1) {
    const candidate = `NDA-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const existing = await prisma.nDA.findUnique({ where: { reference: candidate } });
    if (!existing) return candidate;
  }
  return `NDA-${year}-${Date.now().toString(36).toUpperCase()}`;
}

async function fileNdaFromAttachment(options: {
  auth: GmailAuth;
  message: GmailMessage;
  attachment: GmailAttachmentMeta;
  companyId: string;
  senderEmail: string;
  emailDate: Date;
}): Promise<string | null> {
  const { auth, message, attachment, companyId, senderEmail, emailDate } = options;
  if (attachment.sizeBytes > MAX_ATTACHMENT_BYTES) return null;

  const bytes = await getAttachmentBytes(auth, message.id, attachment.attachmentId);
  const signed = /sign/i.test(attachment.filename);
  const reference = await nextNdaReference();
  const ext = fileExtension(attachment.filename) || "pdf";

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
      description: `Received by email from ${senderEmail} (Gmail sync).`,
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

  const nda = await prisma.nDA.create({
    data: {
      reference,
      companyId,
      type: "mutual",
      status: signed ? "fully_signed" : "under_review",
      dateSent: emailDate,
      sentAt: emailDate,
      signedAt: signed ? emailDate : null,
      signedFileId: signed ? document.id : null,
      versions: {
        create: [
          {
            version: "v1.0",
            versionDate: emailDate,
            note: `Received via email from ${senderEmail}`,
            documentId: document.id,
            storageKey,
            mimeType: attachment.mimeType,
            sizeBytes: bytes.length,
          },
        ],
      },
    },
  });

  // Keep the denormalized Company.ndaStatus in sync (portal gating reads it).
  await prisma.company
    .update({
      where: { id: companyId },
      data: { ndaStatus: signed ? "fully_signed" : "under_review", lastActivityAt: emailDate },
    })
    .catch(() => undefined);

  return nda.id;
}

// ── Main sync ──────────────────────────────────────────────────────────────

export async function runGmailSync(options?: { maxMessages?: number }): Promise<GmailSyncResult> {
  const empty = { fetched: 0, created: 0, ndasCreated: 0, leadsCreated: 0, leadsUpdated: 0 };
  const auth = await getGmailAuth();
  if (!auth) return { ok: false, error: "gmail_not_connected", ...empty };

  const maxMessages = options?.maxMessages ?? 200;
  const mailboxEmail = auth.email.toLowerCase();
  const admins = await loadAdmins();
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
    refs = await listMessageIds(auth, query, maxMessages);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "gmail_list_failed", ...empty };
  }

  const existing = new Set(
    (
      await prisma.emailMessage.findMany({
        where: { gmailMessageId: { in: refs.map((r) => r.id) } },
        select: { gmailMessageId: true },
      })
    ).map((r) => r.gmailMessageId),
  );
  const fresh = refs.filter((r) => !existing.has(r.id));

  const result: GmailSyncResult = { ok: true, ...empty, fetched: refs.length };
  const threadCache = new Map<string, GmailMessage[]>();

  for (const ref of fresh) {
    try {
      const message = await getMessage(auth, ref.id);
      const from = parseAddressList(headerValue(message, "From"))[0];
      if (!from) continue;
      const to = parseAddressList(headerValue(message, "To")).map((a) => a.email);
      const cc = parseAddressList(headerValue(message, "Cc")).map((a) => a.email);
      const subject = headerValue(message, "Subject") ?? "";
      const body = extractBodyText(message.payload);
      const attachments = listAttachmentMeta(message.payload);
      const emailDate = new Date(Number(message.internalDate ?? Date.now()));
      const direction = from.email === mailboxEmail ? "outbound" : "inbound";
      const senderDomain = domainOf(from.email);

      const row = await prisma.emailMessage.create({
        data: {
          gmailMessageId: message.id,
          gmailThreadId: message.threadId,
          direction,
          fromAddress: from.email,
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
      });
      result.created += 1;

      // External senders only from here on (skip our own mailbox + admins).
      const isExternal =
        direction === "inbound" &&
        senderDomain !== "italprotein.com" &&
        !adminEmails.has(from.email);
      if (!isExternal) continue;

      // ── Admin attribution: greeting first, first-sent-mail signature second.
      let admin = matchAdminInGreeting(body, admins);
      if (!admin) {
        let thread = threadCache.get(message.threadId);
        if (!thread) {
          thread = (await getThread(auth, message.threadId)).messages ?? [];
          threadCache.set(message.threadId, thread);
        }
        const firstSent = thread
          .filter((m) => {
            const f = parseAddressList(headerValue(m, "From"))[0];
            return f?.email === mailboxEmail;
          })
          .sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0))[0];
        if (firstSent) {
          admin = matchAdminInSignature(extractBodyText(firstSent.payload), admins);
        }
      }

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

      // ── NDA auto-filing.
      let ndaId: string | null = null;
      let companyId: string | null = null;
      const ndaAttachment = pickNdaAttachment(attachments, subject, body);
      if (ndaAttachment) {
        companyId = await resolveCompanyId(from.email, senderDomain);
        if (!companyId) {
          const ownerId = admin?.id ?? (await fallbackOwnerId(admins));
          const name = companyName ?? from.name ?? from.email.split("@")[0];
          if (ownerId && name) {
            companyId = await createCompanyFromEmail({
              name,
              domain: senderDomain && !isFreemail(senderDomain) ? senderDomain : null,
              ownerUserId: ownerId,
              emailDate,
              personName: from.name,
            });
          }
        }
        if (companyId) {
          ndaId = await fileNdaFromAttachment({
            auth,
            message,
            attachment: ndaAttachment,
            companyId,
            senderEmail: from.email,
            emailDate,
          });
          if (ndaId) result.ndasCreated += 1;
        }
      }

      if (admin || leadId || ndaId || companyId) {
        await prisma.emailMessage.update({
          where: { id: row.id },
          data: {
            matchedAdminUserId: admin?.id ?? null,
            leadId,
            ndaId,
            ndaDetected: Boolean(ndaId),
            companyId,
          },
        });
      }
    } catch {
      // One malformed message must not abort the whole sync run.
      continue;
    }
  }

  return result;
}
