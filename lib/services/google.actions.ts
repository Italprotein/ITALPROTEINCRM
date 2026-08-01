"use server";

import { prisma } from "@/lib/backend/prisma";
import { requireInternal, requireAction, requireUser } from "@/lib/backend/session";
import { listCalendarEvents, hasCalendarAccess, type CalendarEvent } from "@/lib/backend/google-calendar";
import { searchDriveFiles, getDriveFile, hasDriveAccess, type DriveFile } from "@/lib/backend/google-drive";
import { captureError } from "@/lib/backend/observability";

/*
 * Google Calendar + Drive, exposed to the CRM.
 *
 * The value is not "show a calendar" — it is tying what is on the calendar and
 * in Drive back to the company it concerns, so a meeting stops being a line of
 * free text in a Note field.
 */

export interface LinkedCalendarEvent extends CalendarEvent {
  companyId?: string;
  companyName?: string;
  /** How the company was identified, so a wrong guess is explainable. */
  matchedBy?: "contact-email" | "email-domain";
}

/** Mail domains that identify a person, not their employer. */
const GENERIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "yahoo.co.uk", "icloud.com", "me.com", "proton.me", "protonmail.com",
  "aol.com", "gmx.de", "web.de", "libero.it", "tiscali.it", "virgilio.it",
]);

function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).toLowerCase();
  return GENERIC_DOMAINS.has(domain) ? null : domain;
}

/**
 * Calendar events with the company each one concerns.
 *
 * Matching is by attendee: an exact contact email first, then the email domain.
 * Generic providers are ignored — half your contacts use gmail.com, so matching
 * on that domain would attach a meeting to an arbitrary company.
 */
export async function getLinkedCalendarEvents(options?: {
  daysBack?: number;
  daysAhead?: number;
}): Promise<{ events: LinkedCalendarEvent[]; connected: boolean; error?: string }> {
  await requireInternal();
  return collectLinkedCalendarEvents(options);
}

async function collectLinkedCalendarEvents(options?: {
  daysBack?: number;
  daysAhead?: number;
}): Promise<{ events: LinkedCalendarEvent[]; connected: boolean; error?: string }> {
  if (!(await hasCalendarAccess())) {
    return { events: [], connected: false };
  }

  let events: CalendarEvent[];
  try {
    events = await listCalendarEvents({
      timeMin: new Date(Date.now() - (options?.daysBack ?? 30) * 24 * 3600_000),
      timeMax: new Date(Date.now() + (options?.daysAhead ?? 90) * 24 * 3600_000),
    });
  } catch (error) {
    captureError(error, { source: "getLinkedCalendarEvents" });
    return {
      events: [],
      connected: true,
      error: error instanceof Error ? error.message : "Calendar request failed",
    };
  }

  // Resolve every attendee in two queries rather than one per event.
  const emails = [...new Set(events.flatMap((e) => e.attendees.map((a) => a.email)))];
  const domains = [...new Set(emails.map(domainOf).filter((d): d is string => Boolean(d)))];

  const [contacts, companies] = await Promise.all([
    emails.length
      ? prisma.contact.findMany({
          where: { email: { in: emails, mode: "insensitive" } },
          select: { email: true, companyId: true, company: { select: { legalName: true } } },
        })
      : Promise.resolve([]),
    domains.length
      ? prisma.contact.findMany({
          where: { OR: domains.map((d) => ({ email: { endsWith: `@${d}`, mode: "insensitive" as const } })) },
          select: { email: true, companyId: true, company: { select: { legalName: true } } },
        })
      : Promise.resolve([]),
  ]);

  const byEmail = new Map(contacts.map((c) => [c.email.toLowerCase(), c]));
  const byDomain = new Map<string, (typeof companies)[number]>();
  for (const c of companies) {
    const d = domainOf(c.email.toLowerCase());
    if (d && !byDomain.has(d)) byDomain.set(d, c);
  }

  const linked: LinkedCalendarEvent[] = events.map((event) => {
    for (const attendee of event.attendees) {
      const exact = byEmail.get(attendee.email);
      if (exact?.companyId) {
        return {
          ...event,
          companyId: exact.companyId,
          companyName: exact.company?.legalName,
          matchedBy: "contact-email",
        };
      }
    }
    for (const attendee of event.attendees) {
      const d = domainOf(attendee.email);
      const hit = d ? byDomain.get(d) : undefined;
      if (hit?.companyId) {
        return {
          ...event,
          companyId: hit.companyId,
          companyName: hit.company?.legalName,
          matchedBy: "email-domain",
        };
      }
    }
    return event;
  });

  return { events: linked, connected: true };
}

/** The fields a portal user may see about a calendar event — nothing else.
    Attendees, meet links and locations would leak internal participants. */
export interface CompanyCalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay?: boolean;
}

/**
 * Upcoming calendar events for the SIGNED-IN company only. The company scope
 * comes from the session — never from an argument — and events are projected
 * down to the safe fields above before leaving the server.
 */
export async function getCompanyCalendarEvents(): Promise<{
  events: CompanyCalendarEvent[];
  connected: boolean;
}> {
  const user = await requireUser();
  if (!user.companyId) return { events: [], connected: false };
  const { events, connected } = await collectLinkedCalendarEvents({ daysBack: 0, daysAhead: 60 });
  return {
    connected,
    events: events
      .filter((event) => event.companyId === user.companyId)
      .map((event) => ({
        id: event.id,
        summary: event.summary,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
      })),
  };
}

/** Drive search, for attaching a file to a company. */
export async function searchDrive(
  term: string,
): Promise<{ files: DriveFile[]; connected: boolean; error?: string }> {
  await requireInternal();
  if (!(await hasDriveAccess())) return { files: [], connected: false };
  try {
    return { files: await searchDriveFiles(term), connected: true };
  } catch (error) {
    captureError(error, { source: "searchDrive" });
    return {
      files: [],
      connected: true,
      error: error instanceof Error ? error.message : "Drive request failed",
    };
  }
}

/** Files already linked to a company, newest first. */
export async function listCompanyDriveLinks(companyId: string) {
  await requireInternal();
  const rows = await prisma.googleDriveFileLink.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    fileId: r.googleFileId,
    name: r.name ?? r.googleFileId,
    mimeType: r.mimeType ?? "",
    webViewLink: r.webViewLink ?? undefined,
    linkedAt: r.createdAt.toISOString(),
  }));
}

/**
 * Attach a Drive file to a company. Metadata is copied at link time so the list
 * still renders when Drive is unreachable, or when the file is later moved.
 */
export async function linkDriveFileToCompany(companyId: string, fileId: string) {
  const actor = await requireAction("company.edit");

  const existing = await prisma.googleDriveFileLink.findFirst({
    where: { companyId, googleFileId: fileId },
  });
  if (existing) return { ok: true as const, alreadyLinked: true as const };

  const file = await getDriveFile(fileId);
  if (!file) return { ok: false as const, error: "file_not_found" as const };

  await prisma.googleDriveFileLink.create({
    data: {
      companyId,
      googleFileId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
      createdById: actor.id,
    },
  });
  await prisma.auditEvent
    .create({
      data: {
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "integration.drive_file_linked",
        entityType: "company",
        entityId: companyId,
        summary: `Linked Drive file "${file.name}"`,
        companyId,
      },
    })
    .catch(() => undefined);

  return { ok: true as const, alreadyLinked: false as const };
}

export async function unlinkDriveFile(linkId: string) {
  const actor = await requireAction("company.edit");
  // Removes the CRM's reference only — the file itself stays in Drive.
  await prisma.googleDriveFileLink.delete({ where: { id: linkId } }).catch(() => undefined);
  return { ok: true as const, actorId: actor.id };
}
