"use server";

import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/backend/prisma";
import { getCurrentUser } from "@/lib/backend/session";
import type { Task } from "@/lib/types";
import { taskToDTO, taskWriteData } from "./task.mapper";

// External users see only their own company's tasks; internal users see all.
// Tasks may have a null companyId (general tasks): external users do not see those.
async function scopeWhere(): Promise<Prisma.TaskWhereInput> {
  const user = await getCurrentUser();
  if (!user) return { id: "__no_session__" };
  if (user.kind === "external") return { companyId: user.companyId ?? "__no_company__" };
  return {};
}

// Always pull the relation tables the DTO flattens (collaborators + comments).
const INCLUDE = {
  collaborators: true,
  comments: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.TaskInclude;

const NOW = new Date("2026-06-17T12:00:00Z");
const isActiveStatus = (s: Task["status"]) => s !== "done" && s !== "cancelled";
const sameDay = (a: Date, b: Date) =>
  a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);

export async function listTasks(): Promise<Task[]> {
  const rows = await prisma.task.findMany({
    where: await scopeWhere(),
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(taskToDTO);
}

export async function getTask(id: string): Promise<Task | undefined> {
  const rows = await prisma.task.findMany({
    where: { AND: [await scopeWhere(), { id }] },
    include: INCLUDE,
    take: 1,
  });
  return rows[0] ? taskToDTO(rows[0]) : undefined;
}

export async function createTask(input: Task): Promise<Task> {
  const user = await getCurrentUser();
  const row = await prisma.task.create({
    data: {
      ...taskWriteData(input, user?.id ?? null),
      id: input.id,
      createdById: user?.id ?? null,
      collaborators: input.collaboratorIds?.length
        ? { create: input.collaboratorIds.map((userId) => ({ userId })) }
        : undefined,
      comments: input.comments?.length
        ? {
            create: input.comments.map((c) => ({
              authorUserId: c.byUserId,
              body: c.body,
              createdAt: new Date(c.at),
              createdById: user?.id ?? null,
            })),
          }
        : undefined,
    },
    include: INCLUDE,
  });
  return taskToDTO(row);
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task | undefined> {
  const user = await getCurrentUser();
  const existing = await prisma.task.findUnique({ where: { id }, include: INCLUDE });
  if (!existing) return undefined;
  const merged: Task = { ...taskToDTO(existing), ...patch };

  // Reconcile collaborators only when the patch touches them: delete all + recreate.
  const collaborators =
    patch.collaboratorIds !== undefined
      ? {
          deleteMany: {},
          create: (merged.collaboratorIds ?? []).map((userId) => ({ userId })),
        }
      : undefined;

  // Reconcile comments only when the patch touches them: delete all + recreate.
  const comments =
    patch.comments !== undefined
      ? {
          deleteMany: {},
          create: (merged.comments ?? []).map((c) => ({
            authorUserId: c.byUserId,
            body: c.body,
            createdAt: new Date(c.at),
            createdById: user?.id ?? null,
          })),
        }
      : undefined;

  const row = await prisma.task.update({
    where: { id },
    data: { ...taskWriteData(merged, user?.id ?? null), collaborators, comments },
    include: INCLUDE,
  });
  return taskToDTO(row);
}

export async function removeTask(id: string): Promise<void> {
  await prisma.task.delete({ where: { id } }).catch(() => undefined);
}

export async function tasksByOwner(ownerId: string): Promise<Task[]> {
  const rows = await prisma.task.findMany({
    where: { AND: [await scopeWhere(), { ownerUserId: ownerId }] },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(taskToDTO);
}

export async function tasksByCompany(companyId: string): Promise<Task[]> {
  const rows = await prisma.task.findMany({
    where: { AND: [await scopeWhere(), { companyId }] },
    include: INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(taskToDTO);
}

export async function tasksOverdue(now: Date = NOW): Promise<Task[]> {
  const startOfDay = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const rows = await prisma.task.findMany({
    where: {
      AND: [
        await scopeWhere(),
        { status: { notIn: ["done", "cancelled"] } },
        { dueDate: { lt: startOfDay } },
      ],
    },
    include: INCLUDE,
    orderBy: { dueDate: "asc" },
  });
  return rows.map(taskToDTO);
}

export async function tasksDueToday(now: Date = NOW): Promise<Task[]> {
  const start = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const rows = await prisma.task.findMany({
    where: {
      AND: [
        await scopeWhere(),
        { status: { notIn: ["done", "cancelled"] } },
        { dueDate: { gte: start, lt: end } },
      ],
    },
    include: INCLUDE,
    orderBy: { dueDate: "asc" },
  });
  return rows.map(taskToDTO);
}

export async function tasksUpcoming(now: Date = NOW): Promise<Task[]> {
  const endOfDay = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  const rows = await prisma.task.findMany({
    where: {
      AND: [
        await scopeWhere(),
        { status: { notIn: ["done", "cancelled"] } },
        { dueDate: { gte: endOfDay } },
      ],
    },
    include: INCLUDE,
    orderBy: { dueDate: "asc" },
  });
  return rows.map(taskToDTO);
}

export async function taskStatistics(now: Date = NOW) {
  const rows = await prisma.task.findMany({
    where: await scopeWhere(),
    select: { status: true, dueDate: true, ownerUserId: true },
  });
  const all = rows;
  const open = all.filter((t) => isActiveStatus(t.status));
  const completed = all.filter((t) => t.status === "done");
  const overdue = open.filter(
    (t) => !!t.dueDate && t.dueDate < now && !sameDay(t.dueDate, now),
  );
  const dueToday = open.filter((t) => !!t.dueDate && sameDay(t.dueDate, now));
  const byAssignee = Object.entries(
    all.reduce<Record<string, number>>((acc, t) => {
      acc[t.ownerUserId] = (acc[t.ownerUserId] ?? 0) + (isActiveStatus(t.status) ? 1 : 0);
      return acc;
    }, {}),
  ).map(([ownerId, count]) => ({ ownerId, count }));
  return {
    total: all.length,
    open: open.length,
    completed: completed.length,
    overdue: overdue.length,
    dueToday: dueToday.length,
    completionRate: all.length ? Math.round((completed.length / all.length) * 100) : 0,
    byAssignee,
  };
}
