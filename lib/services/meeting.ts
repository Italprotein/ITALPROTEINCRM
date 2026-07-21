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


// Real (Prisma-backed) meetingService, contract-identical to the mock service.
export const meetingService: MeetingService = {
  list: () => listMeetings(),
  get: (id: string) => getMeeting(id),
  getById: (id: string) => getMeeting(id),
  create: (m: Meeting) => createMeeting(m),
  update: (id: string, patch: Partial<Meeting>) => updateMeeting(id, patch),
  remove: (id: string) => removeMeeting(id),
  reset: () => {},
  byCompany: (companyId: string) => meetingsByCompany(companyId),
  upcoming: (now?: Date) => upcomingMeetings(now),
  getStatistics: () => meetingStatistics(),
};
