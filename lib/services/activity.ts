import type { Activity, ActivityType } from "@/lib/types";
import type { ActivityService } from "@/lib/mock-services/activityService";
import {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  removeActivity,
  activitiesByCompany,
  recentActivities,
  activitiesByType,
  activitiesForPortal,
  activityStatistics,
} from "./activity.actions";

// Real (Prisma-backed) activityService — contract-identical to the mock service.
export const activityService: ActivityService = {
  list: () => listActivities(),
  get: (id: string) => getActivity(id),
  getById: (id: string) => getActivity(id),
  create: (a: Activity) => createActivity(a),
  update: (id: string, patch: Partial<Activity>) => updateActivity(id, patch),
  remove: (id: string) => removeActivity(id),
  reset: () => {},
  byCompany: (companyId: string) => activitiesByCompany(companyId),
  recent: (limit = 12) => recentActivities(limit),
  byType: (type: ActivityType) => activitiesByType(type),
  forPortal: (companyId: string) => activitiesForPortal(companyId),
  getStatistics: () => activityStatistics(),
};
