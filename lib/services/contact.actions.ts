"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireUser, requireAction } from "@/lib/backend/session";
import { can } from "@/lib/permissions";
import type { Contact } from "@/lib/types";
import { contactToDTO, contactWriteData } from "./contact.mapper";

// External users see only their own company's contacts; internal users see all.
// The server is the authority — client-supplied scope is ignored.
async function scopeWhere(): Promise<Prisma.ContactWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

// Always pull the optional portal-account relation so the DTO can expose portalAccountId.
const include = { portalUser: { select: { id: true } } } satisfies Prisma.ContactInclude;

export async function listContacts(): Promise<Contact[]> {
  // Authenticated-only: the `contacts` section is hidden for external roles, but
  // portal users read their own company's team here. scopeWhere() limits them.
  await requireUser();
  const rows = await prisma.contact.findMany({
    where: await scopeWhere(),
    include,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map(contactToDTO);
}

export async function getContact(id: string): Promise<Contact | undefined> {
  await requireUser();
  const rows = await prisma.contact.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include,
    take: 1,
  });
  return rows[0] ? contactToDTO(rows[0]) : undefined;
}

export async function createContact(input: Contact): Promise<Contact> {
  // Internal staff use `contact.edit`; portal company owners add teammates from
  // their profile page, which is gated on `portal.edit_company`. Requiring
  // `contact.edit` alone would silently break that portal flow.
  const actor = await requireUser();
  if (!can(actor.role, "contact.edit") && !can(actor.role, "portal.edit_company")) {
    throw new Error("FORBIDDEN");
  }
  const row = await prisma.contact.create({
    data: { ...contactWriteData(input, actor.id), id: input.id, createdById: actor.id },
    include,
  });
  return contactToDTO(row);
}

export async function updateContact(
  id: string,
  patch: Partial<Contact>,
): Promise<Contact | undefined> {
  const actor = await requireAction("contact.edit");
  const existing = await prisma.contact.findUnique({ where: { id }, include });
  if (!existing) return undefined;
  const merged: Contact = { ...contactToDTO(existing), ...patch };
  const row = await prisma.contact.update({
    where: { id },
    data: contactWriteData(merged, actor.id),
    include,
  });
  return contactToDTO(row);
}

export async function removeContact(id: string): Promise<void> {
  await requireAction("contact.edit");
  await prisma.contact.delete({ where: { id } }).catch(() => undefined);
}

export async function contactsByCompany(companyId: string): Promise<Contact[]> {
  await requireUser();
  const rows = await prisma.contact.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map(contactToDTO);
}

export async function searchContacts(q: string): Promise<Contact[]> {
  await requireUser();
  const s = q.trim();
  if (!s) return listContacts();
  const where: Prisma.ContactWhereInput = {
    AND: [
      await scopeWhere(),
      {
        OR: [
          { firstName: { contains: s, mode: "insensitive" } },
          { lastName: { contains: s, mode: "insensitive" } },
          { email: { contains: s, mode: "insensitive" } },
          { jobTitle: { contains: s, mode: "insensitive" } },
          { department: { contains: s, mode: "insensitive" } },
        ],
      },
    ],
  };
  const rows = await prisma.contact.findMany({
    where,
    include,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map(contactToDTO);
}

export async function contactStatistics() {
  await requireUser();
  const rows = await prisma.contact.findMany({
    where: await scopeWhere(),
    select: { isPrimary: true, isTechnical: true, isCommercial: true },
  });
  return {
    total: rows.length,
    primary: rows.filter((c) => c.isPrimary).length,
    technical: rows.filter((c) => c.isTechnical).length,
    commercial: rows.filter((c) => c.isCommercial).length,
  };
}
