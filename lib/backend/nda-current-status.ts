import type { Prisma, NDAStatus } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";

// Plain module, deliberately NOT "use server": these are shared helpers, not
// server actions, and both nda.actions.ts and company.actions.ts import them.

/** Same ordering `listNdas` uses, so "current" means the same row everywhere. */
const CURRENT_ORDER: Prisma.NDAOrderByWithRelationInput[] = [
  { updatedAt: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
];

export interface CurrentNda {
  status: NDAStatus;
  expiryDate: Date | null;
}

/** External users see only their own company's NDAs; internal users see all. */
export async function ndaScopeWhere(): Promise<Prisma.NDAWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

/** One current register row per company — the only thing any count reads. */
export async function currentNdaByCompany(
  where: Prisma.NDAWhereInput,
): Promise<Map<string, CurrentNda>> {
  const rows = await prisma.nDA.findMany({
    where,
    orderBy: CURRENT_ORDER,
    select: { companyId: true, status: true, expiryDate: true },
  });
  const current = new Map<string, CurrentNda>();
  for (const row of rows) {
    if (current.has(row.companyId)) continue;
    current.set(row.companyId, { status: row.status, expiryDate: row.expiryDate });
  }
  return current;
}
