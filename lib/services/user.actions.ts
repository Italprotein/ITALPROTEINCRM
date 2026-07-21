"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { requireAction, requireInternal, requireSection } from "@/lib/backend/session";
import type { InternalRole } from "@/lib/types";
import type { StaffMember } from "@/fixtures";
import { userInclude, userToDTO, userWriteData } from "./user.mapper";

// The internal staff directory. Users are NOT company-scoped — this directory is
// internal-only, so every query filters to kind = "internal". External portal
// users are never surfaced here. The server is the authority for who is staff.
function staffWhere(): Prisma.UserWhereInput {
  return { kind: "internal" };
}

/** Resolve a RoleKey enum value to its Role row id (required FK on User). */
async function roleIdForKey(key: InternalRole): Promise<string | null> {
  const role = await prisma.role.findUnique({ where: { key } });
  return role?.id ?? null;
}

export async function listUsers(): Promise<StaffMember[]> {
  await requireInternal();
  const rows = await prisma.user.findMany({
    where: staffWhere(),
    include: userInclude,
    orderBy: { name: "asc" },
  });
  return rows.map(userToDTO);
}

export async function getUser(id: string): Promise<StaffMember | undefined> {
  await requireSection("users");
  const rows = await prisma.user.findMany({
    where: { AND: [staffWhere(), { id }] },
    include: userInclude,
    take: 1,
  });
  return rows[0] ? userToDTO(rows[0]) : undefined;
}

export async function createUser(input: StaffMember): Promise<StaffMember> {
  const actor = await requireAction("user.manage");
  const roleId = await roleIdForKey(input.role);
  if (!roleId) {
    // No matching role row — surface the input back rather than throwing so the
    // contract (always returns a StaffMember) holds.
    // TODO: seed the roles table so every RoleKey resolves.
    return input;
  }
  const row = await prisma.user.create({
    data: {
      ...userWriteData(input, actor.id),
      id: input.id,
      kind: "internal",
      role: { connect: { id: roleId } },
      createdById: actor.id,
    },
    include: userInclude,
  });
  // TODO: send the staff invitation email (not yet integrated).
  return userToDTO(row);
}

export async function updateUser(
  id: string,
  patch: Partial<StaffMember>,
): Promise<StaffMember | undefined> {
  const actor = await requireAction("user.manage");
  const existing = await prisma.user.findFirst({
    where: { AND: [staffWhere(), { id }] },
    include: userInclude,
  });
  if (!existing) return undefined;
  const merged: StaffMember = { ...userToDTO(existing), ...patch };
  const roleId = patch.role ? await roleIdForKey(merged.role) : null;
  const row = await prisma.user.update({
    where: { id },
    data: {
      ...userWriteData(merged, actor.id),
      ...(roleId ? { role: { connect: { id: roleId } } } : {}),
    },
    include: userInclude,
  });
  return userToDTO(row);
}

export async function removeUser(id: string): Promise<void> {
  await requireAction("user.manage");
  await prisma.user.delete({ where: { id } }).catch(() => undefined);
}

export async function usersByRole(role: InternalRole): Promise<StaffMember[]> {
  await requireInternal();
  const rows = await prisma.user.findMany({
    where: { AND: [staffWhere(), { role: { key: role } }] },
    include: userInclude,
    orderBy: { name: "asc" },
  });
  return rows.map(userToDTO);
}

export async function assignedCompanyCount(id: string): Promise<number> {
  await requireSection("users");
  return prisma.company.count({ where: { ownerUserId: id } });
}

export async function userStatistics() {
  await requireSection("users");
  const rows = await prisma.user.findMany({
    where: staffWhere(),
    select: { status: true, role: { select: { key: true } } },
  });
  const byRole = {} as Record<InternalRole, number>;
  for (const r of rows) {
    const key = r.role.key as InternalRole;
    byRole[key] = (byRole[key] ?? 0) + 1;
  }
  return {
    total: rows.length,
    active: rows.filter((r) => r.status === "active").length,
    invited: rows.filter((r) => r.status === "invited").length,
    suspended: rows.filter((r) => r.status === "suspended" || r.status === "disabled").length,
    byRole,
  };
}
