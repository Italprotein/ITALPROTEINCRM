"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser, requireSectionEdit, requireUser } from "@/lib/backend/session";
import type { Meeting } from "@/lib/types";
import { meetingToDTO, meetingWriteData } from "./meeting.mapper";

// Always load the contacts join so the DTO can expose contactIds[].
const include = { participants: true } as const;

// External users see only their own company's meetings; internal users see all.
// Meetings may have a null companyId (internal-only), which external users never see.
async function scopeWhere(): Promise<Prisma.MeetingWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

// Replace the MeetingContact join rows for a meeting to match the DTO's contactIds.
async function syncParticipants(meetingId: string, contactIds: string[] | undefined): Promise<void> {
  if (contactIds === undefined) return;
  await prisma.meetingContact.deleteMany({ where: { meetingId } });
  if (contactIds.length) {
    await prisma.meetingContact.createMany({
      data: contactIds.map((contactId) => ({ meetingId, contactId })),
      skipDuplicates: true,
    });
  }
}

export async function listMeetings(): Promise<Meeting[]> {
  await requireUser();
  const rows = await prisma.meeting.findMany({
    where: await scopeWhere(),
    include,
    orderBy: { start: "desc" },
  });
  return rows.map(meetingToDTO);
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  await requireUser();
  const rows = await prisma.meeting.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include,
    take: 1,
  });
  return rows[0] ? meetingToDTO(rows[0]) : undefined;
}

export async function createMeeting(input: Meeting): Promise<Meeting> {
  const user = await requireSectionEdit("calendar");
  await prisma.meeting.create({
    data: {
      ...meetingWriteData(input, user.id),
      id: input.id,
      createdById: user.id,
    },
  });
  await syncParticipants(input.id, input.contactIds);
  // TODO: send calendar invites / sync to external calendar provider when integrated.
  const row = await prisma.meeting.findUnique({ where: { id: input.id }, include });
  return meetingToDTO(row!);
}

export async function updateMeeting(
  id: string,
  patch: Partial<Meeting>,
): Promise<Meeting | undefined> {
  const user = await requireSectionEdit("calendar");
  const existing = await prisma.meeting.findUnique({ where: { id }, include });
  if (!existing) return undefined;
  const merged: Meeting = { ...meetingToDTO(existing), ...patch };
  await prisma.meeting.update({ where: { id }, data: meetingWriteData(merged, user.id) });
  if (patch.contactIds !== undefined) await syncParticipants(id, merged.contactIds);
  const row = await prisma.meeting.findUnique({ where: { id }, include });
  return meetingToDTO(row!);
}

export async function removeMeeting(id: string): Promise<void> {
  await requireSectionEdit("calendar");
  await prisma.meeting.delete({ where: { id } }).catch(() => undefined);
}

export async function meetingsByCompany(companyId: string): Promise<Meeting[]> {
  await requireUser();
  const rows = await prisma.meeting.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include,
    orderBy: { start: "desc" },
  });
  return rows.map(meetingToDTO);
}

export async function upcomingMeetings(now: Date = new Date()): Promise<Meeting[]> {
  // `requireUser()` only: the client portal dashboard calls this for external
  // users, who have no `calendar` section at all. Company scoping below is the
  // boundary that keeps them to their own meetings.
  await requireUser();
  const rows = await prisma.meeting.findMany({
    where: { AND: [await scopeWhere(), { status: "scheduled", start: { gte: now } }] },
    include,
    orderBy: { start: "asc" },
  });
  return rows.map(meetingToDTO);
}

export async function meetingStatistics(): Promise<{
  total: number;
  scheduled: number;
  completed: number;
}> {
  await requireUser();
  const rows = await prisma.meeting.findMany({
    where: await scopeWhere(),
    select: { status: true },
  });
  return {
    total: rows.length,
    scheduled: rows.filter((r) => r.status === "scheduled").length,
    completed: rows.filter((r) => r.status === "completed").length,
  };
}
