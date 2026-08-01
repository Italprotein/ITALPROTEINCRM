"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireSection } from "@/lib/backend/session";

/**
 * One number for the Settings "Data records" card. Counted in the database —
 * shipping five full DTO lists to the browser to read `.length` was the
 * previous implementation.
 */
export async function workspaceRecordCount(): Promise<number> {
  await requireSection("settings");
  const counts = await prisma.$transaction([
    prisma.company.count(),
    prisma.contact.count(),
    prisma.sampleRequest.count(),
    prisma.nDA.count(),
    prisma.document.count(),
    prisma.task.count(),
    prisma.emailMessage.count(),
    prisma.lead.count(),
  ]);
  return counts.reduce((sum, n) => sum + n, 0);
}
