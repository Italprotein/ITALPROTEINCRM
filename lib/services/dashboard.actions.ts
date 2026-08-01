"use server";

import { getAiProviderName, isAiProviderConfigured } from "@/lib/ai/provider";
import { hasDriveAccess } from "@/lib/backend/google-drive";
import { prisma } from "@/lib/backend/prisma";
import { requireInternal } from "@/lib/backend/session";
import type { NDAStatus } from "@/lib/types";
import { recentActivities } from "./activity.actions";
import { companyStatistics } from "./company.actions";
import { gmailConnectionStatus, listEmailMessages } from "./email.actions";
import { getLinkedCalendarEvents } from "./google.actions";
import { upcomingMeetings } from "./meeting.actions";
import { ndaStatistics, listNdas } from "./nda.actions";
import { notificationUnreadCount } from "./notification.actions";
import { opportunityStatistics } from "./opportunity.actions";
import { sampleStatistics } from "./sample.actions";
import { listShipments, shipmentStatistics } from "./shipment.actions";
import { taskStatistics, tasksDueToday, tasksOverdue, tasksUpcoming } from "./task.actions";
import type {
  CommandCenterBrief,
  CommandCenterMeeting,
  CommandCenterTask,
} from "./dashboard.types";

const DAY_MS = 24 * 60 * 60 * 1000;
const AWAITING_NDA: NDAStatus[] = [
  "sent",
  "under_review",
  "changes_requested",
  "approved",
  "awaiting_italprotein_signature",
  "awaiting_counterparty_signature",
  "partially_signed",
];

/** One authenticated request for the whole command center instead of a waterfall of client calls. */
export async function getCommandCenterBrief(): Promise<CommandCenterBrief> {
  const user = await requireInternal();
  const now = new Date();

  const calendarPromise = getLinkedCalendarEvents({ daysBack: 0, daysAhead: 14 }).catch((error) => ({
    events: [],
    connected: false,
    error: error instanceof Error ? error.message : "Calendar request failed",
  }));
  const gmailPromise = gmailConnectionStatus().catch((error) => ({
    connected: false as const,
    error: error instanceof Error ? error.message : "Gmail request failed",
  }));

  const [
    company,
    opportunity,
    nda,
    sample,
    shipment,
    task,
    overdue,
    dueToday,
    upcoming,
    crmMeetings,
    calendar,
    gmail,
    emails,
    shipments,
    ndas,
    activity,
    unreadNotifications,
    driveConnected,
  ] = await Promise.all([
    companyStatistics(),
    opportunityStatistics(),
    ndaStatistics(),
    sampleStatistics(),
    shipmentStatistics(),
    taskStatistics(now),
    tasksOverdue(now),
    tasksDueToday(now),
    tasksUpcoming(now),
    upcomingMeetings(now),
    calendarPromise,
    gmailPromise,
    listEmailMessages("inbound", 8),
    listShipments(),
    listNdas(),
    recentActivities(8),
    notificationUnreadCount({ workspace: "internal", role: user.role }),
    hasDriveAccess().catch(() => false),
  ]);

  const companyIds = new Set<string>();
  for (const row of [...overdue, ...dueToday, ...upcoming, ...crmMeetings, ...emails, ...shipments, ...ndas, ...activity]) {
    if (row.companyId) companyIds.add(row.companyId);
  }
  const companyRows = companyIds.size
    ? await prisma.company.findMany({
        where: { id: { in: [...companyIds] } },
        select: { id: true, legalName: true, tradingName: true },
      })
    : [];
  const companyName = new Map(
    companyRows.map((row) => [row.id, row.tradingName?.trim() || row.legalName]),
  );

  const toTask = (row: (typeof overdue)[number]): CommandCenterTask => ({
    id: row.id,
    title: row.title,
    dueDate: row.dueDate,
    priority: row.priority,
    status: row.status,
    companyName: row.companyId ? companyName.get(row.companyId) : undefined,
  });

  const googleMeetings: CommandCenterMeeting[] = calendar.events
    .filter((event) => new Date(event.start) >= now)
    .map((event) => ({
      id: `google-${event.id}`,
      title: event.summary,
      start: event.start,
      end: event.end,
      companyName: event.companyName,
      location: event.location,
      source: "google",
      externalUrl: event.hangoutLink ?? event.htmlLink,
    }));
  const storedMeetings: CommandCenterMeeting[] = crmMeetings.map((meeting) => ({
    id: `crm-${meeting.id}`,
    title: meeting.title,
    start: meeting.start,
    end: meeting.end,
    companyName: meeting.companyId ? companyName.get(meeting.companyId) : undefined,
    location: meeting.location,
    source: "crm",
  }));
  const meetings = [...googleMeetings, ...storedMeetings]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 8);
  const meetingsNextSevenDays = meetings.filter(
    (meeting) => new Date(meeting.start).getTime() <= now.getTime() + 7 * DAY_MS,
  ).length;

  const delayed = shipments.filter((row) => row.isDelayed && !row.actualDelivery).slice(0, 4);
  const awaiting = ndas.filter((row) => AWAITING_NDA.includes(row.status)).slice(0, 4);

  return {
    generatedAt: now.toISOString(),
    metrics: {
      companies: company.total,
      activeOpportunities: opportunity.open,
      weightedPipelineValue: opportunity.weightedValue,
      ndaAwaitingSignature: nda.awaitingSignature,
      samplesAwaitingFeedback: sample.awaitingFeedback,
      delayedShipments: shipment.delayed,
      overdueTasks: task.overdue,
      meetingsNextSevenDays,
      unreadNotifications,
    },
    tasks: {
      overdue: overdue.slice(0, 5).map(toTask),
      dueToday: dueToday.slice(0, 5).map(toTask),
      upcoming: upcoming.slice(0, 5).map(toTask),
    },
    meetings,
    emails: emails.map((email) => ({
      id: email.id,
      fromAddress: email.fromAddress,
      fromName: email.fromName,
      subject: email.subject,
      snippet: email.snippet,
      receivedAt: email.internalDate,
      companyName: email.companyId ? companyName.get(email.companyId) : undefined,
      hasAttachments: email.hasAttachments,
    })),
    risks: [
      ...delayed.map((row) => ({
        id: `shipment-${row.id}`,
        kind: "shipment" as const,
        title: row.reference,
        detail: `${row.courier ?? "Courier"} · ${row.recipient}`,
        href: "/admin/shipments" as const,
        severity: "danger" as const,
      })),
      ...awaiting.map((row) => ({
        id: `nda-${row.id}`,
        kind: "nda" as const,
        title: row.reference,
        detail: companyName.get(row.companyId) ?? "NDA awaiting signature",
        href: "/admin/ndas" as const,
        severity: "warning" as const,
      })),
    ].slice(0, 6),
    recentActivity: activity.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      at: row.at,
      companyName: row.companyId ? companyName.get(row.companyId) : undefined,
    })),
    integrations: {
      gmail: gmail,
      calendar: { connected: calendar.connected, error: calendar.error },
      drive: { connected: driveConnected },
      ai: { connected: isAiProviderConfigured(), provider: getAiProviderName() },
    },
  };
}
