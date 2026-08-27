"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireInternal } from "@/lib/backend/session";
import { FOLLOW_UP_AFTER_DAYS, type FollowUpCandidate } from "@/lib/follow-up";

/**
 * Companies that answered us at least once and have since gone quiet.
 *
 * The pair of conditions is the point: an inbound reply proves the relationship
 * is real, and the silence since proves it has stalled. A company that never
 * replied is a prospecting problem, not a follow-up — it does not belong here.
 */
export async function followUpCandidates(limit = 12): Promise<FollowUpCandidate[]> {
  await requireInternal();

  const cutoff = new Date(Date.now() - FOLLOW_UP_AFTER_DAYS * 86_400_000);

  // Companies we have heard from at least once.
  const inbound = await prisma.emailMessage.findMany({
    where: { direction: "inbound", companyId: { not: null } },
    orderBy: { internalDate: "desc" },
    select: { companyId: true, subject: true, internalDate: true },
  });
  if (!inbound.length) return [];

  const replied = new Map<string, { count: number; subject: string | null; at: Date }>();
  for (const message of inbound) {
    const id = message.companyId!;
    const seen = replied.get(id);
    if (seen) {
      seen.count += 1;
    } else {
      // First pass wins: the list is newest-first, so this is their latest reply.
      replied.set(id, { count: 1, subject: message.subject, at: message.internalDate });
    }
  }

  // Last contact in EITHER direction — a reply of ours restarts the clock, so
  // counting only their messages would resurface companies we answered
  // yesterday.
  const latestAny = await prisma.emailMessage.groupBy({
    by: ["companyId"],
    where: { companyId: { in: [...replied.keys()] } },
    _max: { internalDate: true },
  });
  const lastTouch = new Map(
    latestAny.map((row) => [row.companyId!, row._max.internalDate] as const),
  );

  const stalled = [...replied.entries()].filter(([id]) => {
    const touched = lastTouch.get(id);
    return touched != null && touched < cutoff;
  });
  if (!stalled.length) return [];

  const companies = await prisma.company.findMany({
    where: {
      id: { in: stalled.map(([id]) => id) },
      // A lost or dormant account is a decision, not an oversight.
      relationshipStage: { notIn: ["lost", "dormant"] },
    },
    select: { id: true, legalName: true, tradingName: true, countryCode: true },
  });
  const byId = new Map(companies.map((company) => [company.id, company]));

  const now = Date.now();
  return stalled
    .filter(([id]) => byId.has(id))
    .map(([id, reply]) => {
      const company = byId.get(id)!;
      const touched = lastTouch.get(id)!;
      return {
        companyId: id,
        companyName: company.tradingName || company.legalName,
        countryCode: company.countryCode,
        quietDays: Math.floor((now - touched.getTime()) / 86_400_000),
        inboundCount: reply.count,
        lastInboundSubject: reply.subject,
        lastInboundAt: reply.at.toISOString(),
        lastContactAt: touched.toISOString(),
      };
    })
    .sort((a, b) => b.quietDays - a.quietDays)
    .slice(0, limit);
}
