import type { ActivityType, Priority, TaskStatus } from "@/lib/types";

export interface CommandCenterTask {
  id: string;
  title: string;
  dueDate?: string;
  priority: Priority;
  status: TaskStatus;
  companyName?: string;
}

export interface CommandCenterMeeting {
  id: string;
  title: string;
  start: string;
  end?: string;
  companyName?: string;
  location?: string;
  source: "crm" | "google";
  externalUrl?: string;
}

export interface CommandCenterEmail {
  id: string;
  fromAddress: string;
  fromName?: string;
  subject?: string;
  snippet?: string;
  receivedAt: string;
  companyName?: string;
  hasAttachments: boolean;
}

export interface CommandCenterRisk {
  id: string;
  kind: "shipment" | "nda";
  title: string;
  detail: string;
  href: "/admin/shipments" | `/admin/ndas?detail=${string}`;
  severity: "danger" | "warning";
}

export interface CommandCenterActivity {
  id: string;
  type: ActivityType;
  title: string;
  at: string;
  companyName?: string;
}

export interface CommandCenterBrief {
  generatedAt: string;
  metrics: {
    companies: number;
    activeOpportunities: number;
    weightedPipelineValue: number;
    ndaAwaitingSignature: number;
    samplesAwaitingFeedback: number;
    delayedShipments: number;
    overdueTasks: number;
    meetingsNextSevenDays: number;
    unreadNotifications: number;
  };
  tasks: {
    overdue: CommandCenterTask[];
    dueToday: CommandCenterTask[];
    upcoming: CommandCenterTask[];
  };
  meetings: CommandCenterMeeting[];
  emails: CommandCenterEmail[];
  risks: CommandCenterRisk[];
  recentActivity: CommandCenterActivity[];
  integrations: {
    gmail: {
      connected: boolean;
      email?: string;
      lastSyncedAt?: string;
      inboxCount?: number;
      error?: string;
    };
    calendar: { connected: boolean; error?: string };
    drive: { connected: boolean };
    ai: { connected: boolean; provider: "groq" | "openai" };
  };
}
