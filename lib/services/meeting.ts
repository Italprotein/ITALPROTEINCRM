import type { Meeting } from "@/lib/types";
import type { MeetingService } from "@/lib/mock-services/meetingService";
import {
  listMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  removeMeeting,
  meetingsByCompany,
  upcomingMeetings,
  meetingStatistics,
} from "./meeting.actions";

// Mirrors the mock service's fixed "now" default for upcoming() so the contract
// (and demo data window) is identical when DATA_MODE switches to api.
const NOW = new Date("2026-06-17T12:00:00Z");

// Real (Prisma-backed) meetingService — contract-identical to the mock service.
export const meetingService: MeetingService = {
  list: () => listMeetings(),
  get: (id: string) => getMeeting(id),
  getById: (id: string) => getMeeting(id),
  create: (m: Meeting) => createMeeting(m),
  update: (id: string, patch: Partial<Meeting>) => updateMeeting(id, patch),
  remove: (id: string) => removeMeeting(id),
  reset: () => {},
  byCompany: (companyId: string) => meetingsByCompany(companyId),
  upcoming: (now: Date = NOW) => upcomingMeetings(now),
  getStatistics: () => meetingStatistics(),
};
