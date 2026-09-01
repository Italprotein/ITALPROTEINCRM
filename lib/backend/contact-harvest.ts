/**
 * Reading contacts out of the synced mailbox.
 *
 * The decisions all live in lib/contact-harvest.ts, which has no database
 * import; this module reads rows, hands them over, and writes what comes back.
 * Same split as lib/backend/follow-up-register.ts.
 */

import { prisma } from "@/lib/backend/prisma";
import {
  normalizeEmail,
  parseBounce,
  planContactImport,
  type HarvestAction,
  type HarvestCandidate,
  type HarvestContext,
  type HarvestSkipReason,
} from "@/lib/contact-harvest";

/** Addresses of ours. A colleague on a thread is not a customer contact. */
const OWN_DOMAINS = new Set(["italprotein.com", "proamina.com"]);

export interface HarvestPlan {
  candidates: number;
  creates: Extract<HarvestAction, { kind: "create" }>[];
  skipped: Record<HarvestSkipReason, number>;
  /** Every address Gmail reported as not found, for the report. */
  notFound: string[];
  /** Bounces that are NOT address problems, so nobody mistakes the counts. */
  softBounces: { address: string; status: string | null; marker: string | null }[];
}

const emptySkips = (): Record<HarvestSkipReason, number> => ({
  already_a_contact: 0,
  address_not_found: 0,
  own_domain: 0,
  infrastructure: 0,
  invalid: 0,
});

/**
 * Build the import plan without writing anything.
 *
 * Two passes over the mailbox, in this order and no other:
 *
 *  1. Collect every delivery failure, so the "not found" set is complete before
 *     a single candidate is judged. Doing this lazily would let an address be
 *     approved by an early message and condemned by a later one.
 *  2. Collect the candidates themselves.
 */
export async function planContactHarvest(): Promise<HarvestPlan> {
  const messages = await prisma.emailMessage.findMany({
    select: {
      direction: true,
      fromAddress: true,
      fromName: true,
      toAddresses: true,
      ccAddresses: true,
      bodyText: true,
      companyId: true,
      internalDate: true,
    },
    orderBy: { internalDate: "asc" },
  });

  /* ── Pass 1: the bounces ── */
  const notFound = new Set<string>();
  const softBounces: HarvestPlan["softBounces"] = [];
  for (const message of messages) {
    const bounce = parseBounce(message.bodyText);
    if (!bounce) continue;
    if (bounce.notFound) {
      notFound.add(bounce.address);
    } else {
      // A mailbox that is full, or refused a 30MB attachment, is a mailbox that
      // exists. Recorded so the report can say so out loud.
      softBounces.push({
        address: bounce.address,
        status: bounce.status,
        marker: bounce.marker,
      });
    }
  }

  /* ── Pass 2: the candidates ── */
  const byEmail = new Map<string, HarvestCandidate>();

  const note = (
    rawEmail: string,
    companyId: string,
    displayName: string | null,
    at: Date,
    inbound: boolean,
  ) => {
    const email = normalizeEmail(rawEmail);
    if (!email) return;
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, {
        email,
        companyId,
        displayName,
        messageCount: 1,
        lastSeenAt: at,
        outboundOnly: !inbound,
      });
      return;
    }
    existing.messageCount += 1;
    // Messages are ordered oldest-first, so the last write wins and the newest
    // display name is the one kept — people change how their name is spelled.
    if (displayName) existing.displayName = displayName;
    if (at > new Date(existing.lastSeenAt)) existing.lastSeenAt = at;
    if (inbound) existing.outboundOnly = false;
  };

  for (const message of messages) {
    if (!message.companyId) continue;
    if (message.direction === "inbound") {
      note(message.fromAddress, message.companyId, message.fromName, message.internalDate, true);
    } else {
      // Only the To line. A cc is often a broker, a colleague or a mailing list,
      // and attaching those to the company would invent relationships.
      for (const to of message.toAddresses) {
        note(to, message.companyId, null, message.internalDate, false);
      }
    }
  }

  /* ── Judge them ── */
  const existingContacts = await prisma.contact.findMany({ select: { email: true } });
  const context: HarvestContext = {
    existingEmails: new Set(existingContacts.map((c) => normalizeEmail(c.email)).filter(Boolean)),
    notFoundEmails: notFound,
    ownDomains: OWN_DOMAINS,
  };

  const plan: HarvestPlan = {
    candidates: byEmail.size,
    creates: [],
    skipped: emptySkips(),
    notFound: [...notFound].sort(),
    softBounces,
  };

  for (const candidate of byEmail.values()) {
    const action = planContactImport(candidate, context);
    if (action.kind === "skip") {
      plan.skipped[action.reason] += 1;
    } else {
      plan.creates.push(action);
    }
  }

  plan.creates.sort((a, b) => a.email.localeCompare(b.email));
  return plan;
}

export interface HarvestResult extends HarvestPlan {
  created: number;
}

/**
 * Write the plan.
 *
 * Creates only — it never updates or deletes an existing contact. A row that is
 * already there was put there by a person, and an address harvested from a
 * mailbox is not better evidence than that.
 */
export async function applyContactHarvest(
  options: { actorId?: string | null } = {},
): Promise<HarvestResult> {
  const plan = await planContactHarvest();
  let created = 0;

  for (const create of plan.creates) {
    try {
      await prisma.contact.create({
        data: {
          companyId: create.companyId,
          firstName: create.firstName,
          lastName: create.lastName,
          email: create.email,
          lastContactAt: new Date(create.lastSeenAt),
          notes: "Rilevato automaticamente dalle email sincronizzate.",
          createdById: options.actorId ?? null,
        },
      });
      created += 1;
    } catch {
      // A company deleted between planning and writing, or a race with another
      // run. One address failing must not abandon the rest.
    }
  }

  return { ...plan, created };
}
