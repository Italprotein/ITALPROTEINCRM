import { Prisma } from "@/lib/generated/prisma/client";
import type { InternalRole } from "@/lib/types";
import type { StaffMember } from "@/fixtures";

// Prisma row <-> StaffMember DTO. The internal staff directory flattens the
// Prisma User (+ its role relation + ownedCompanies back-relation) into the
// fixture StaffMember shape. New transforms vs Company/Sample: role from the
// related role.key, name<->firstName/lastName split, assignedCompanyIds derived
// from the ownedCompanies relation, lastLoginAt<->lastActiveAt, and a UserStatus
// enum narrowed to the StaffMember status union. passwordHash is NEVER exposed.
//
// Note: jobTitle, avatarColor and phone have no column on the Prisma User model;
// they are surfaced as best-effort (image -> avatarColor when it looks like a
// color) and otherwise omitted. Writes for those fields are no-ops (// TODO:
// extend the User model with a staff-profile table to persist them).

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

// Prisma User with the relations the mapper needs included.
export type UserWithRelations = Prisma.UserGetPayload<{
  include: { role: true; ownedCompanies: { select: { id: true } } };
}>;

export const userInclude = {
  role: true,
  ownedCompanies: { select: { id: true } },
} satisfies Prisma.UserInclude;

/** Narrow the Prisma UserStatus enum to the StaffMember status union. */
function toStaffStatus(status: string): StaffMember["status"] {
  if (status === "active" || status === "invited" || status === "suspended") return status;
  return "suspended"; // "disabled" (and any future value) collapses to suspended for the UI
}

/** Split a single display name into first/last (last name = remainder). */
function splitName(name: string | null): { firstName: string; lastName: string } {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Prisma row (with relations) -> StaffMember DTO. */
export function userToDTO(u: UserWithRelations): StaffMember {
  const { firstName, lastName } = splitName(u.name);
  const avatarColor =
    u.image && u.image.startsWith("#") ? u.image : undefined;
  return {
    id: u.id,
    firstName,
    lastName,
    email: u.email ?? "",
    role: u.role.key as InternalRole,
    jobTitle: u.role.name ?? "",
    avatarColor,
    status: toStaffStatus(u.status),
    lastActiveAt: (u.lastLoginAt ?? u.createdAt).toISOString(),
    phone: undefined, // no column on User; not persisted
    assignedCompanyIds: u.ownedCompanies.map((c) => c.id),
  };
}

/**
 * StaffMember DTO -> Prisma User scalar write payload (shared by create/update).
 * roleId is resolved separately (the action looks it up from role.key), so it is
 * not produced here. assignedCompanyIds, jobTitle, avatarColor and phone are NOT
 * persisted onto the User row (no columns) — see file header.
 */
export function userWriteData(input: StaffMember, actorId: string | null) {
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  return {
    name: name || null,
    email: input.email || null,
    status: input.status,
    // avatarColor is round-tripped through image when it is a hex color.
    image: input.avatarColor ?? undefined,
    // TODO: jobTitle/phone/avatarColor and assignedCompanyIds have no User columns;
    // persist via a future staff-profile table. They are intentionally dropped here.
    updatedById: actorId,
  };
}
