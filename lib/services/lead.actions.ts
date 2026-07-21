"use server";

import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import { leadToDTO } from "./email.mapper";
import type { LeadEntry } from "@/lib/types";

// "My Leads" — company names extracted from Gmail, one list per admin.

export async function listMyLeads(): Promise<LeadEntry[]> {
  const user = await getCurrentUser();
  if (!user || user.kind !== "internal") return [];
  const rows = await prisma.lead.findMany({
    where: { adminUserId: user.id },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map(leadToDTO);
}

export async function listLeads(): Promise<LeadEntry[]> {
  const user = await getCurrentUser();
  if (!user || user.kind !== "internal") return [];
  const rows = await prisma.lead.findMany({ orderBy: { lastSeenAt: "desc" } });
  return rows.map(leadToDTO);
}

export async function leadsByAdmin(adminUserId: string): Promise<LeadEntry[]> {
  const user = await getCurrentUser();
  if (!user || user.kind !== "internal") return [];
  const rows = await prisma.lead.findMany({
    where: { adminUserId },
    orderBy: { lastSeenAt: "desc" },
  });
  return rows.map(leadToDTO);
}

export async function removeLead(id: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.kind !== "internal") return;
  // Admins may prune their own list; super_admin may prune any.
  const where = user.role === "super_admin" ? { id } : { id, adminUserId: user.id };
  await prisma.lead.deleteMany({ where }).catch(() => undefined);
}

export async function leadStatistics(): Promise<{ total: number; mine: number }> {
  const user = await getCurrentUser();
  if (!user || user.kind !== "internal") return { total: 0, mine: 0 };
  const [total, mine] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { adminUserId: user.id } }),
  ]);
  return { total, mine };
}
