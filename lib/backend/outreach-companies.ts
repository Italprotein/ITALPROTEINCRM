/**
 * Every company we reached out to, whether or not they answered.
 *
 * The decisions live in lib/outreach.ts, which has no database import; this
 * reads the mailbox, asks that module what each recipient is, and writes the
 * rows. Same split as lib/backend/follow-up-register.ts.
 *
 * Deliberately NOT "use server" — every export in such a file becomes a public
 * POST endpoint. The guarded entry points are the importer script and
 * app/api/companies/sync-outreach/route.ts.
 */

import { prisma } from "@/lib/backend/prisma";
import { registrableDomainOf } from "@/lib/email-entity";
import {
  agentFromSignature,
  classifyOutreachRecipient,
  companyNameFromDomain,
  countryFromDomain,
  initialsFromName,
  organisationLabelOf,
  type OutreachIgnoreReason,
} from "@/lib/outreach";
import { deriveContactName, normalizeEmail } from "@/lib/contact-harvest";

/**
 * The type given to an imported company.
 *
 * `other` rather than `fb_manufacturer`, even though almost every one of these
 * is a food or beverage manufacturer: the domain proves we emailed them, not
 * what they make. Recording a guess as fact would put 150 unverified rows into
 * every "by type" chart in Analytics. The importer takes --type to override
 * this in one pass once somebody has actually looked at the list.
 */
const DEFAULT_TYPE = "other";

/** Marks the rows this importer made, so they can be found and reviewed. */
export const OUTREACH_TAG = "outreach-import";

export interface OutreachCandidate {
  /** Primary domain — the one with the most messages. */
  domain: string;
  /**
   * Every domain that resolved to this organisation. A group's regional
   * sites (mccain.com, mccain.ca, mccain.co.uk) are one company with three
   * domains, not three companies with the same name.
   */
  domains: string[];
  /** The addresses we wrote to at this domain. */
  recipients: string[];
  messageCount: number;
  firstContactAt: Date;
  lastContactAt: Date;
  /** Email of the Italprotein agent who signed the outreach, if identifiable. */
  agentEmail: string | null;
  /** True when anyone at this domain ever wrote back. */
  replied: boolean;
}

export interface OutreachPlan {
  /** Distinct recipient domains seen in outbound mail. */
  domains: number;
  /** Domains that would become new company rows. */
  creates: OutreachCandidate[];
  /** Already a company — nothing to do beyond the mail already being linked. */
  linked: number;
  ignored: Record<OutreachIgnoreReason, number>;
  /** Ignored domains, listed so the filtering can be audited. */
  ignoredDomains: { domain: string; reason: OutreachIgnoreReason }[];
  /** How the outreach splits between the people who signed it. */
  byAgent: Record<string, number>;
  /** Candidates whose signature named nobody we could resolve. */
  unattributed: number;
}

const emptyIgnored = (): Record<OutreachIgnoreReason, number> => ({
  "no-domain": 0,
  "own-domain": 0,
  freemail: 0,
  "isp-mailbox": 0,
  infrastructure: 0,
  "service-provider": 0,
  investor: 0,
  suppressed: 0,
});

/**
 * Work out what the mailbox says, without writing anything.
 *
 * Exported so the dry run and the apply share one code path — a dry run that
 * computes something different from what the apply does is worse than no dry
 * run at all.
 */
export async function planOutreachImport(): Promise<OutreachPlan> {
  const [outbound, inbound, companyDomains, investors, suppressed] = await Promise.all([
    prisma.emailMessage.findMany({
      where: { direction: "outbound" },
      select: { toAddresses: true, bodyText: true, internalDate: true },
      orderBy: { internalDate: "asc" },
    }),
    prisma.emailMessage.findMany({
      where: { direction: "inbound" },
      select: { fromAddress: true },
    }),
    prisma.companyDomain.findMany({ select: { domain: true } }),
    prisma.investor.findMany({ select: { domain: true, emails: true } }),
    prisma.suppressedEntity.findMany({
      where: { kind: "domain" },
      select: { normalizedValue: true },
    }),
  ]);

  const knownDomains = new Set(
    companyDomains.map((row) => registrableDomainOf(row.domain)).filter(Boolean),
  );
  const investorDomains = new Set(
    investors
      .flatMap((row) => [row.domain, ...row.emails])
      .map((value) => registrableDomainOf(value))
      .filter(Boolean),
  );
  const suppressedDomains = new Set(
    suppressed.map((row) => registrableDomainOf(row.normalizedValue)).filter(Boolean),
  );
  const repliedDomains = new Set(
    inbound.map((row) => registrableDomainOf(row.fromAddress)).filter(Boolean),
  );

  const byDomain = new Map<string, OutreachCandidate>();
  const plan: OutreachPlan = {
    domains: 0,
    creates: [],
    linked: 0,
    ignored: emptyIgnored(),
    ignoredDomains: [],
    byAgent: {},
    unattributed: 0,
  };

  const seenIgnored = new Set<string>();
  const seenLinked = new Set<string>();

  for (const message of outbound) {
    // Read the signature once per message, not once per recipient.
    const agentEmail = agentFromSignature(message.bodyText);

    for (const raw of message.toAddresses) {
      const email = normalizeEmail(raw);
      if (!email) continue;

      const verdict = classifyOutreachRecipient({
        email,
        knownDomains,
        investorDomains,
        suppressedDomains,
      });

      if (verdict.verdict === "ignore") {
        if (verdict.domain && !seenIgnored.has(verdict.domain)) {
          seenIgnored.add(verdict.domain);
          plan.ignored[verdict.reason!] += 1;
          plan.ignoredDomains.push({ domain: verdict.domain, reason: verdict.reason! });
        }
        continue;
      }

      if (verdict.verdict === "link") {
        seenLinked.add(verdict.domain);
        continue;
      }

      // Grouped by organisation label so a group's regional domains land on
      // one company; see organisationLabelOf.
      const label = organisationLabelOf(verdict.domain) || verdict.domain;
      const existing = byDomain.get(label);
      if (!existing) {
        byDomain.set(label, {
          domain: verdict.domain,
          domains: [verdict.domain],
          recipients: [email],
          messageCount: 1,
          firstContactAt: message.internalDate,
          lastContactAt: message.internalDate,
          agentEmail,
          replied: repliedDomains.has(verdict.domain),
        });
        continue;
      }

      existing.messageCount += 1;
      if (!existing.recipients.includes(email)) existing.recipients.push(email);
      if (!existing.domains.includes(verdict.domain)) existing.domains.push(verdict.domain);
      if (message.internalDate > existing.lastContactAt) {
        existing.lastContactAt = message.internalDate;
      }
      // Messages are oldest-first, so the first agent seen is the one who
      // opened the conversation — that is who owns it.
      if (!existing.agentEmail && agentEmail) existing.agentEmail = agentEmail;
    }
  }

  plan.creates = [...byDomain.values()].sort((a, b) => b.messageCount - a.messageCount);
  plan.linked = seenLinked.size;
  plan.domains = byDomain.size + seenLinked.size + seenIgnored.size;

  for (const candidate of plan.creates) {
    if (!candidate.agentEmail) {
      plan.unattributed += 1;
      continue;
    }
    plan.byAgent[candidate.agentEmail] = (plan.byAgent[candidate.agentEmail] ?? 0) + 1;
  }

  return plan;
}

export interface OutreachImportResult extends OutreachPlan {
  companiesCreated: number;
  contactsCreated: number;
  domainsRegistered: number;
  messagesLinked: number;
}

/**
 * Write the plan.
 *
 * Creates only. An existing company is never edited: this importer's evidence
 * is "we sent mail here", which is weaker than anything a person entered by
 * hand, so it may add rows but never overwrite them.
 */
export async function runOutreachImport(options: {
  companyType?: string;
  fallbackOwnerEmail?: string;
} = {}): Promise<OutreachImportResult> {
  const plan = await planOutreachImport();
  const result: OutreachImportResult = {
    ...plan,
    companiesCreated: 0,
    contactsCreated: 0,
    domainsRegistered: 0,
    messagesLinked: 0,
  };

  // Resolve the signing agents to real users once, up front.
  const agentEmails = [...new Set(plan.creates.map((c) => c.agentEmail).filter(Boolean))];
  const users = await prisma.user.findMany({
    where: { email: { in: agentEmails as string[] } },
    select: { id: true, email: true },
  });
  const userByEmail = new Map(users.map((u) => [u.email!.toLowerCase(), u.id]));

  // Company.ownerUserId is required, so an unattributed company still needs an
  // owner. The fallback is explicit rather than "whoever sorts first".
  const fallback = await prisma.user.findFirst({
    where: options.fallbackOwnerEmail
      ? { email: options.fallbackOwnerEmail }
      : { email: "ad@italprotein.com" },
    select: { id: true },
  });
  const fallbackOwnerId =
    fallback?.id ??
    (await prisma.user.findFirst({ where: { kind: "internal" }, select: { id: true } }))?.id;
  if (!fallbackOwnerId) throw new Error("no internal user to own imported companies");

  const type = (options.companyType ?? DEFAULT_TYPE) as never;

  for (const candidate of plan.creates) {
    const name = companyNameFromDomain(candidate.domain);
    if (!name) continue;

    const country = countryFromDomain(candidate.domain);
    const ownerUserId = candidate.agentEmail
      ? (userByEmail.get(candidate.agentEmail.toLowerCase()) ?? fallbackOwnerId)
      : fallbackOwnerId;

    try {
      const company = await prisma.company.create({
        data: {
          legalName: name,
          type,
          initials: initialsFromName(name),
          headquarters: {
            city: "",
            line1: country?.name ?? "",
            country: country?.name ?? "",
          },
          country: country?.name ?? "Unknown",
          countryCode: country?.code ?? "XX",
          city: "",
          website: `https://${candidate.domain}`,
          leadSource: "email",
          // Contacted, and nothing more is claimed: a reply would have made
          // this company resolvable already, so most of these never answered.
          relationshipStage: "contacted",
          firstContact: {
            date: candidate.firstContactAt.toISOString(),
            channel: "gmail",
          },
          lastActivityAt: candidate.lastContactAt,
          tags: [OUTREACH_TAG],
          commercialNotes:
            `Importata dalle email in uscita: ${candidate.messageCount} messaggi, ` +
            `${candidate.replied ? "ha risposto" : "nessuna risposta"}. ` +
            `Tipo e sede da verificare.`,
          ownerUserId,
          domains: {
            create: candidate.domains.map((domain) => ({
              domain,
              source: "gmail_sync" as const,
            })),
          },
        },
        select: { id: true },
      });
      result.companiesCreated += 1;
      result.domainsRegistered += candidate.domains.length;

      // One contact per address we actually wrote to.
      for (const recipient of candidate.recipients) {
        const { firstName, lastName } = deriveContactName(null, recipient);
        await prisma.contact
          .create({
            data: {
              companyId: company.id,
              firstName,
              lastName,
              email: recipient,
              lastContactAt: candidate.lastContactAt,
              notes: "Destinatario delle email in uscita, importato automaticamente.",
            },
          })
          .then(() => {
            result.contactsCreated += 1;
          })
          .catch(() => undefined);
      }

      // Attach the mail that produced this company, so its history is not empty.
      const linked = await prisma.emailMessage.updateMany({
        where: {
          direction: "outbound",
          companyId: null,
          OR: candidate.recipients.map((address) => ({ toAddresses: { has: address } })),
        },
        data: { companyId: company.id },
      });
      result.messagesLinked += linked.count;
    } catch {
      // A concurrent import, or a company created between planning and writing.
    }
  }

  return result;
}
