"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireSection } from "@/lib/backend/session";
import type {
  ApplicationCategory,
  CompanyType,
  InternalRole,
  RelationshipStage,
} from "@/lib/types";
import {
  MONTHS,
  daysBetween,
  firstContactOf,
  monthKey,
  monthLabel,
  sampleRank,
} from "./analytics.mapper";

// Cross-module READ-ONLY analytics. Mirrors lib/mock-services/analyticsService.ts
// exactly (same method names + return shapes). This is an internal/global
// dashboard: like the mock (which reads raw fixtures regardless of viewer) it is
// NOT company-scoped. Agencies are Company rows with type = "agency"; the mock's
// ALL_COMPANIES = every company, while COMPANIES (companiesOverTime) excludes
// agencies — reproduced here with a type filter.
//
// AUTHZ: every export here returns cross-company aggregate business intelligence
// (pipeline shape, conversion rates, customer counts, staff productivity) and is
// reachable as a POST endpoint by any caller that knows the action id, so each
// one opens with requireSection('analytics').
//
// requireSection is the right granularity, verified against the consumers: these
// functions are only ever called from /admin pages (analytics, overview, samples,
// feedback, ndas, shipments) — NO portal page imports analyticsService, so none
// of them feeds a company-scoped dashboard and none needs company scoping. Every
// internal role has analytics at 'view' or 'full', so no internal role loses a
// chart; 'analytics' is not a PORTAL_SECTION, so canView() is false for all five
// external roles and the guard shuts the portal out of internal BI entirely.

export async function companiesOverTime(): Promise<
  { month: string; label: string; count: number; cumulative: number }[]
> {
  await requireSection("analytics");
  const rows = await prisma.company.findMany({
    where: { type: { not: "agency" } },
    select: { createdAt: true },
  });
  let cumulative = 0;
  return MONTHS.map((k) => {
    const count = rows.filter((c) => monthKey(c.createdAt.toISOString()) === k).length;
    cumulative += count;
    return { month: k, label: monthLabel(k), count, cumulative };
  });
}

export async function companiesByCountry(): Promise<
  { country: string; countryCode: string; count: number }[]
> {
  await requireSection("analytics");
  const rows = await prisma.company.findMany({ select: { country: true, countryCode: true } });
  const map = new Map<string, { country: string; countryCode: string; count: number }>();
  for (const c of rows) {
    const e = map.get(c.country) ?? { country: c.country, countryCode: c.countryCode, count: 0 };
    e.count++;
    map.set(c.country, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export async function companiesByCategory(): Promise<{ type: CompanyType; count: number }[]> {
  await requireSection("analytics");
  const grouped = await prisma.company.groupBy({ by: ["type"], _count: { _all: true } });
  return grouped
    .map((g) => ({ type: g.type as CompanyType, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function pipelineDistribution(): Promise<
  { stage: RelationshipStage; count: number }[]
> {
  await requireSection("analytics");
  const order: RelationshipStage[] = [
    "lead", "contacted", "interested", "qualified", "nda_in_progress", "nda_signed",
    "sampling", "testing", "commercial_discussion", "customer", "repeat_customer", "dormant", "lost",
  ];
  const grouped = await prisma.company.groupBy({
    by: ["relationshipStage"],
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const g of grouped) counts.set(g.relationshipStage, g._count._all);
  return order
    .map((stage) => ({ stage, count: counts.get(stage) ?? 0 }))
    .filter((d) => d.count > 0);
}

export async function ndaFunnel(): Promise<{ name: string; value: number }[]> {
  await requireSection("analytics");
  const rows = await prisma.nDA.findMany({ select: { status: true, dateSent: true } });
  const sentStatuses = [
    "sent", "under_review", "changes_requested", "approved",
    "awaiting_italprotein_signature", "awaiting_counterparty_signature",
    "partially_signed", "fully_signed",
  ];
  const prepared = rows.filter((n) => n.status !== "not_required").length;
  const sent = rows.filter((n) => !!n.dateSent || sentStatuses.includes(n.status)).length;
  const signed = rows.filter((n) => n.status === "fully_signed").length;
  return [
    { name: "Prepared", value: prepared },
    { name: "Sent", value: sent },
    { name: "Signed", value: signed },
  ];
}

export async function sampleFunnel(): Promise<{ name: string; value: number }[]> {
  await requireSection("analytics");
  const rows = await prisma.sampleRequest.findMany({ select: { status: true } });
  const atLeast = (status: string) =>
    rows.filter(
      (s) =>
        sampleRank(s.status) >= sampleRank(status) &&
        s.status !== "cancelled" &&
        s.status !== "rejected",
    ).length;
  return [
    { name: "Requested", value: rows.filter((s) => s.status !== "draft").length },
    { name: "Approved", value: atLeast("approved") },
    { name: "Shipped", value: atLeast("shipped") },
    { name: "Delivered", value: atLeast("delivered") },
    { name: "Feedback", value: atLeast("feedback_received") },
  ];
}

export async function samplesOverTime(): Promise<
  { month: string; label: string; count: number }[]
> {
  await requireSection("analytics");
  const rows = await prisma.sampleRequest.findMany({ select: { requestDate: true } });
  return MONTHS.map((k) => ({
    month: k,
    label: monthLabel(k),
    count: rows.filter((s) => monthKey(s.requestDate.toISOString()) === k).length,
  }));
}

export async function ndaCompletionTrend(): Promise<
  { month: string; label: string; signed: number; sent: number }[]
> {
  await requireSection("analytics");
  const rows = await prisma.nDA.findMany({
    select: { status: true, effectiveDate: true, dateSent: true },
  });
  return MONTHS.map((k) => ({
    month: k,
    label: monthLabel(k),
    signed: rows.filter(
      (n) =>
        n.status === "fully_signed" &&
        monthKey((n.effectiveDate ?? n.dateSent)?.toISOString()) === k,
    ).length,
    sent: rows.filter((n) => monthKey(n.dateSent?.toISOString()) === k).length,
  }));
}

export async function shipmentStatusBreakdown(): Promise<{ name: string; value: number }[]> {
  await requireSection("analytics");
  const rows = await prisma.shipment.findMany({
    select: { actualDelivery: true, shipmentDate: true, customsStatus: true },
  });
  const inCustoms = (s: (typeof rows)[number]) =>
    s.customsStatus === "hold" || s.customsStatus === "in_clearance";
  const delivered = rows.filter((s) => s.actualDelivery).length;
  const customs = rows.filter((s) => !s.actualDelivery && inCustoms(s)).length;
  const inTransit = rows.filter((s) => !s.actualDelivery && s.shipmentDate && !inCustoms(s)).length;
  const preparing = rows.filter((s) => !s.shipmentDate && !s.actualDelivery).length;
  return [
    { name: "Delivered", value: delivered },
    { name: "In transit", value: inTransit },
    { name: "Customs", value: customs },
    { name: "Preparing", value: preparing },
  ].filter((d) => d.value > 0);
}

export async function shipmentPerformance(): Promise<{
  avgDeliveryDays: number;
  onTimePct: number;
  delayedCount: number;
  totalDelivered: number;
}> {
  await requireSection("analytics");
  const rows = await prisma.shipment.findMany({
    select: {
      actualDelivery: true,
      shipmentDate: true,
      estimatedDelivery: true,
      isDelayed: true,
    },
  });
  const delivered = rows.filter((s) => s.actualDelivery);
  const days = delivered
    .map((s) => daysBetween(s.shipmentDate?.toISOString(), s.actualDelivery?.toISOString()))
    .filter((d): d is number => d != null && d >= 0);
  const avgDeliveryDays = days.length
    ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10
    : 0;
  const onTime = delivered.filter(
    (s) =>
      !s.estimatedDelivery ||
      (s.actualDelivery && s.actualDelivery <= s.estimatedDelivery),
  ).length;
  return {
    avgDeliveryDays,
    onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
    delayedCount: rows.filter((s) => s.isDelayed).length,
    totalDelivered: delivered.length,
  };
}

export async function avgFirstContactToNda(): Promise<number> {
  await requireSection("analytics");
  const ndas = await prisma.nDA.findMany({
    where: { status: "fully_signed" },
    select: { companyId: true, effectiveDate: true, dateSent: true },
  });
  const companies = await prisma.company.findMany({ select: { id: true, firstContact: true } });
  const byId = new Map(companies.map((c) => [c.id, firstContactOf(c.firstContact)]));
  const spans: number[] = [];
  for (const n of ndas) {
    const fc = byId.get(n.companyId);
    const d = daysBetween(fc?.date, (n.effectiveDate ?? n.dateSent)?.toISOString());
    if (d != null && d >= 0) spans.push(d);
  }
  return spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : 0;
}

export async function avgNdaToShipment(): Promise<number> {
  await requireSection("analytics");
  const shipments = await prisma.shipment.findMany({
    select: { companyId: true, shipmentDate: true },
  });
  const ndas = await prisma.nDA.findMany({
    where: { status: "fully_signed" },
    select: { companyId: true, effectiveDate: true, dateSent: true },
  });
  // First fully-signed NDA per company (mirrors the mock's .find()).
  const ndaByCompany = new Map<string, (typeof ndas)[number]>();
  for (const n of ndas) if (!ndaByCompany.has(n.companyId)) ndaByCompany.set(n.companyId, n);
  const spans: number[] = [];
  for (const s of shipments) {
    const nda = ndaByCompany.get(s.companyId);
    const d = daysBetween(
      (nda?.effectiveDate ?? nda?.dateSent)?.toISOString(),
      s.shipmentDate?.toISOString(),
    );
    if (d != null && d >= 0) spans.push(d);
  }
  return spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : 0;
}

export async function teamActivity(): Promise<
  { userId: string; name: string; role: InternalRole; activities: number; tasks: number; companies: number }[]
> {
  await requireSection("analytics");
  // STAFF in the mock = internal users. name from User.name, role from role.key,
  // companies = companies the user owns (ownerUserId), activities/tasks counted
  // from their respective tables.
  const staff = await prisma.user.findMany({
    where: { kind: "internal" },
    select: { id: true, name: true, role: { select: { key: true } } },
  });
  const result = await Promise.all(
    staff.map(async (u) => {
      const [activities, tasks, companies] = await Promise.all([
        prisma.activity.count({ where: { actorUserId: u.id } }),
        prisma.task.count({
          where: { ownerUserId: u.id, status: { notIn: ["done", "cancelled"] } },
        }),
        prisma.company.count({ where: { ownerUserId: u.id } }),
      ]);
      return {
        userId: u.id,
        name: u.name ?? "",
        role: u.role.key as InternalRole,
        activities,
        tasks,
        companies,
      };
    }),
  );
  return result.sort((a, b) => b.activities - a.activities);
}

export async function taskCompletionRate(): Promise<{ done: number; total: number; rate: number }> {
  await requireSection("analytics");
  const [done, total] = await Promise.all([
    prisma.task.count({ where: { status: "done" } }),
    prisma.task.count(),
  ]);
  return { done, total, rate: total ? Math.round((done / total) * 100) : 0 };
}

export async function topMarkets(): Promise<
  { country: string; countryCode: string; count: number }[]
> {
  // companiesByCountry() re-checks the same guard; the duplicate check is cheap
  // and keeps this action safe on its own if that delegation ever changes.
  await requireSection("analytics");
  return (await companiesByCountry()).slice(0, 8);
}

export async function topApplications(): Promise<
  { category: ApplicationCategory; count: number }[]
> {
  await requireSection("analytics");
  const grouped = await prisma.sampleRequest.groupBy({
    by: ["applicationCategory"],
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({ category: g.applicationCategory as ApplicationCategory, count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

export async function feedbackResults(): Promise<
  { name: "positive" | "mixed" | "negative" | "inconclusive"; value: number }[]
> {
  await requireSection("analytics");
  const results = ["positive", "mixed", "negative", "inconclusive"] as const;
  const grouped = await prisma.feedback.groupBy({
    by: ["overallResult"],
    _count: { _all: true },
  });
  const counts = new Map<string, number>();
  for (const g of grouped) if (g.overallResult) counts.set(g.overallResult, g._count._all);
  return results
    .map((r) => ({ name: r, value: counts.get(r) ?? 0 }))
    .filter((d) => d.value > 0);
}
