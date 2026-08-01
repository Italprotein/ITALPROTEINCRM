"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireSection } from "@/lib/backend/session";

export interface AuditLogRow {
  id: string;
  at: string;
  actorId?: string;
  /** Server-resolved display name — audit actors are not always staff-directory members. */
  actorName?: string;
  action: string;
  entity: string;
  summary: string;
}

/**
 * The real audit trail (AuditEvent), newest first. Guarded by the same section
 * that gates /admin/audit itself — settings rights are not required to read it.
 */
export async function listAuditEvents(limit = 500): Promise<AuditLogRow[]> {
  await requireSection("audit");
  const rows = await prisma.auditEvent.findMany({
    orderBy: { occurredAt: "desc" },
    take: Math.min(limit, 1000),
    include: { actorUser: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    at: row.occurredAt.toISOString(),
    actorId: row.actorUserId ?? undefined,
    actorName: row.actorUser?.name ?? undefined,
    action: row.action,
    entity: row.entityType,
    summary: row.summary,
  }));
}
