import "server-only";

import { getGmailAuth, GmailError } from "./gmail";

/*
 * Google Calendar (read) for the shared ad@italprotein.com account.
 *
 * Hand-rolled REST over fetch, matching lib/backend/gmail.ts — no googleapis
 * dependency, and it reuses that module's token refresh so there is one place
 * where the mailbox credential is managed.
 *
 * Read-only by design for now: the CRM shows what is booked. Writing events
 * back is a separate decision, because a bug there would touch a real calendar
 * that people actually run their week from.
 */

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: string;
  organizer?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  /** ISO. All-day events carry a date only; both are normalised to ISO here. */
  start: string;
  end: string;
  allDay: boolean;
  htmlLink?: string;
  hangoutLink?: string;
  attendees: CalendarAttendee[];
  organizerEmail?: string;
  status?: string;
}

interface RawEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string };
  attendees?: { email?: string; displayName?: string; responseStatus?: string; organizer?: boolean }[];
}

function toEvent(raw: RawEvent): CalendarEvent | null {
  const startRaw = raw.start?.dateTime ?? raw.start?.date;
  const endRaw = raw.end?.dateTime ?? raw.end?.date;
  if (!raw.id || !startRaw || !endRaw) return null;
  return {
    id: raw.id,
    summary: raw.summary?.trim() || "(no title)",
    description: raw.description,
    location: raw.location,
    start: new Date(startRaw).toISOString(),
    end: new Date(endRaw).toISOString(),
    allDay: Boolean(raw.start?.date && !raw.start?.dateTime),
    htmlLink: raw.htmlLink,
    hangoutLink: raw.hangoutLink,
    organizerEmail: raw.organizer?.email?.toLowerCase(),
    status: raw.status,
    attendees: (raw.attendees ?? [])
      .filter((a) => a.email)
      .map((a) => ({
        email: a.email!.toLowerCase(),
        displayName: a.displayName,
        responseStatus: a.responseStatus,
        organizer: a.organizer,
      })),
  };
}

/**
 * Events in a window, soonest first. `singleEvents` expands recurring series so
 * each occurrence is its own row — otherwise a weekly standup appears once,
 * with a recurrence rule the CRM would have to interpret itself.
 */
export async function listCalendarEvents(options?: {
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
}): Promise<CalendarEvent[]> {
  const auth = await getGmailAuth();
  if (!auth) return [];

  const timeMin = options?.timeMin ?? new Date(Date.now() - 30 * 24 * 3600_000);
  const timeMax = options?.timeMax ?? new Date(Date.now() + 90 * 24 * 3600_000);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(Math.min(options?.maxResults ?? 250, 2500)),
  });

  const res = await fetch(`${CALENDAR_BASE}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
    cache: "no-store",
  });

  if (res.status === 403) {
    // Almost always the token predates the calendar scope, or the Calendar API
    // is not enabled on the Cloud project. Say so rather than returning [].
    throw new GmailError(
      "Calendar access denied — reconnect the Google account to grant calendar scopes, and check the Calendar API is enabled.",
      403,
    );
  }
  if (!res.ok) throw new GmailError(`Google Calendar request failed (${res.status})`, res.status);

  const data = (await res.json()) as { items?: RawEvent[] };
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map(toEvent)
    .filter((e): e is CalendarEvent => e !== null);
}

/** True when the stored token actually carries a calendar scope. */
export async function hasCalendarAccess(): Promise<boolean> {
  const { prisma } = await import("./prisma");
  const row = await prisma.googleOAuthToken.findFirst({
    where: { status: "active", isServiceAccount: false },
    select: { scopes: true },
  });
  return Boolean(row?.scopes.some((s) => s === "calendar_readonly" || s === "calendar_events"));
}
