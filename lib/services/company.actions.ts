"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireAction } from "@/lib/backend/session";
import { can } from "@/lib/permissions";
import type { Company } from "@/lib/types";
import type { CompanyQuery } from "@/lib/mock-services/companyService";
import { companyToDTO, companyWriteData } from "./company.mapper";

// Server-side company scope: external users see only their own company; internal
// users see all. The server is the authority — client-supplied ids are ignored.
async function scopeWhere(): Promise<Prisma.CompanyWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { id: user.companyId ?? "__no_company__" };
  return {};
}

function queryWhere(q: CompanyQuery): Prisma.CompanyWhereInput {
  const where: Prisma.CompanyWhereInput = {};
  if (q.search) {
    where.OR = [
      { legalName: { contains: q.search, mode: "insensitive" } },
      { tradingName: { contains: q.search, mode: "insensitive" } },
      { city: { contains: q.search, mode: "insensitive" } },
      { country: { contains: q.search, mode: "insensitive" } },
      { tags: { has: q.search } },
    ];
  }
  if (q.types?.length) where.type = { in: q.types };
  if (q.countries?.length) where.country = { in: q.countries };
  if (q.stages?.length) where.relationshipStage = { in: q.stages };
  if (q.ownerId) where.ownerUserId = q.ownerId;
  if (q.ndaStatuses?.length) where.ndaStatus = { in: q.ndaStatuses };
  if (q.priorities?.length) where.priority = { in: q.priorities };
  if (q.tag) where.tags = { has: q.tag };
  return where;
}

export async function listCompanies(query: CompanyQuery = {}): Promise<Company[]> {
  // Authenticated-only, not section-gated: the `companies` section is hidden for
  // external roles, but portal users legitimately read their own company here —
  // scopeWhere() below is what limits them to it.
  await requireUser();
  const where: Prisma.CompanyWhereInput = { AND: [await scopeWhere(), queryWhere(query)] };
  const rows = await prisma.company.findMany({ where, orderBy: { legalName: "asc" } });
  return rows.map(companyToDTO);
}

export async function getCompany(id: string): Promise<Company | undefined> {
  await requireUser();
  const rows = await prisma.company.findMany({ where: { AND: [await scopeWhere(), { id }] }, take: 1 });
  return rows[0] ? companyToDTO(rows[0]) : undefined;
}

export async function createCompany(input: Company): Promise<Company> {
  const actor = await requireAction("company.create");
  const row = await prisma.company.create({
    data: { ...companyWriteData(input, actor.id), id: input.id, createdById: actor.id },
  });
  return companyToDTO(row);
}

export async function updateCompany(id: string, patch: Partial<Company>): Promise<Company | undefined> {
  // Two legitimate callers: internal staff with `company.edit`, and portal
  // company owners editing their own profile via `portal.edit_company`
  // (app/[locale]/portal/profile gates its form on exactly that action).
  // Gating on `company.edit` alone would silently break the portal form.
  const actor = await requireUser();
  if (!can(actor.role, "company.edit") && !can(actor.role, "portal.edit_company")) {
    throw new Error("FORBIDDEN");
  }
  // Scope the target to what this actor may touch: scopeWhere() limits an
  // external portal owner to their OWN company, while internal staff reach any.
  // Without this, a portal owner could pass another company's id (IDOR) and edit
  // records outside their scope. Missing/foreign id -> undefined (not "forbidden",
  // so we don't confirm the row exists).
  const existing = await prisma.company.findFirst({ where: { AND: [await scopeWhere(), { id }] } });
  if (!existing) return undefined;
  const merged: Company = { ...companyToDTO(existing), ...patch };
  const row = await prisma.company.update({ where: { id }, data: companyWriteData(merged, actor.id) });
  return companyToDTO(row);
}

/**
 * Prefix for the "this company still holds records worth keeping" refusal.
 *
 * A plain Error, not a subclass: a "use server" module may only export async
 * functions, and a custom error class would not survive the server-action
 * boundary as its own type anyway — only the message crosses. The client
 * matches on this prefix.
 */
const DELETE_BLOCKED = "COMPANY_DELETE_BLOCKED";

export async function removeCompany(id: string): Promise<void> {
  // No `company.delete` action exists; deletion is at least as privileged as
  // editing, and `company.edit` is internal-only, which is the intent here.
  await requireAction("company.edit");

  // Financial records outlive the company relationship — an issued invoice is
  // an accounting fact, not a CRM detail. Refuse rather than destroy them.
  const [quotes, orders, invoices] = await Promise.all([
    prisma.quote.count({ where: { companyId: id } }),
    prisma.order.count({ where: { companyId: id } }),
    prisma.invoice.count({ where: { companyId: id } }),
  ]);
  const blocking: string[] = [];
  if (quotes) blocking.push(`${quotes} quote(s)`);
  if (orders) blocking.push(`${orders} order(s)`);
  if (invoices) blocking.push(`${invoices} invoice(s)`);
  if (blocking.length) throw new Error(`${DELETE_BLOCKED}: ${blocking.join(", ")}`);

  // Everything else belongs to the company and goes with it. Most of these
  // relations have no ON DELETE CASCADE, so a single related row — one draft
  // sample request was enough — made the delete fail. That failure used to be
  // swallowed, so the UI reported success while the row stayed in the database.
  await prisma.$transaction([
    prisma.supportMessage.deleteMany({ where: { supportRequest: { companyId: id } } }),
    prisma.supportRequest.deleteMany({ where: { companyId: id } }),
    prisma.attachment.deleteMany({ where: { document: { companyId: id } } }),
    prisma.googleDriveFileLink.deleteMany({ where: { companyId: id } }),
    prisma.documentAccessEvent.deleteMany({ where: { document: { companyId: id } } }),
    prisma.document.deleteMany({ where: { companyId: id } }),
    prisma.nDA.deleteMany({ where: { companyId: id } }),
    prisma.feedback.deleteMany({ where: { companyId: id } }),
    prisma.applicationProject.deleteMany({ where: { companyId: id } }),
    prisma.shipment.deleteMany({ where: { companyId: id } }),
    prisma.sampleRequest.deleteMany({ where: { companyId: id } }),
    prisma.opportunity.deleteMany({ where: { companyId: id } }),
    prisma.meeting.deleteMany({ where: { companyId: id } }),
    prisma.task.deleteMany({ where: { companyId: id } }),
    prisma.activity.deleteMany({ where: { companyId: id } }),
    prisma.notification.deleteMany({ where: { companyId: id } }),
    prisma.assistantThread.deleteMany({ where: { companyId: id } }),
    prisma.contact.deleteMany({ where: { companyId: id } }),
    prisma.company.delete({ where: { id } }),
  ]);
  // Anything still referencing the company (audit events, email logs) keeps its
  // history with a null link, which is the point of an audit trail.
}

export async function countCompanies(): Promise<number> {
  await requireUser();
  return prisma.company.count({ where: await scopeWhere() });
}

export async function companiesByCountry(): Promise<
  { country: string; countryCode: string; count: number }[]
> {
  await requireUser();
  const rows = await prisma.company.findMany({
    where: await scopeWhere(),
    select: { country: true, countryCode: true },
  });
  const map = new Map<string, { country: string; countryCode: string; count: number }>();
  for (const r of rows) {
    const e = map.get(r.country) ?? { country: r.country, countryCode: r.countryCode, count: 0 };
    e.count++;
    map.set(r.country, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export async function companiesByType(): Promise<{ type: Company["type"]; count: number }[]> {
  await requireUser();
  const grouped = await prisma.company.groupBy({
    by: ["type"],
    where: await scopeWhere(),
    _count: { _all: true },
  });
  return grouped
    .map((g) => ({ type: g.type as Company["type"], count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

export async function companyStatistics() {
  await requireUser();
  const rows = await prisma.company.findMany({
    where: await scopeWhere(),
    select: {
      relationshipStage: true,
      ndaStatus: true,
      priority: true,
      opportunityValueMinor: true,
      estimatedAnnualPotentialMinor: true,
    },
  });
  const ACTIVE_EXCLUDE = ["lost", "dormant"];
  const byStage = new Map<string, number>();
  for (const r of rows) byStage.set(r.relationshipStage, (byStage.get(r.relationshipStage) ?? 0) + 1);
  return {
    total: rows.length,
    active: rows.filter((r) => !ACTIVE_EXCLUDE.includes(r.relationshipStage)).length,
    customers: rows.filter((r) => ["customer", "repeat_customer"].includes(r.relationshipStage)).length,
    ndaSigned: rows.filter((r) => r.ndaStatus === "fully_signed").length,
    pipelineValue: rows.reduce((s, r) => s + (r.opportunityValueMinor ?? 0) / 100, 0),
    estimatedPotential: rows.reduce((s, r) => s + (r.estimatedAnnualPotentialMinor ?? 0) / 100, 0),
    highPriority: rows.filter((r) => r.priority === "high" || r.priority === "urgent").length,
    byStage: [...byStage.entries()].map(([stage, count]) => ({
      stage: stage as Company["relationshipStage"],
      count,
    })),
  };
}
