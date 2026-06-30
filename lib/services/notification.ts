import type { AppNotification } from "@/lib/types";
import type { AudienceQuery, NotificationService } from "@/lib/mock-services/notificationService";
import {
  listNotifications,
  getNotification,
  createNotification,
  updateNotification,
  removeNotification,
  notificationsForAudience,
  notificationUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  notificationStatistics,
} from "./notification.actions";

// Real (Prisma-backed) notificationService — contract-identical to the mock
// service. The barrel swaps this in when NEXT_PUBLIC_DATA_MODE=api.
export const notificationService: NotificationService = {
  list: () => listNotifications(),
  get: (id: string) => getNotification(id),
  create: (n: AppNotification) => createNotification(n),
  update: (id: string, patch: Partial<AppNotification>) => updateNotification(id, patch),
  remove: (id: string) => removeNotification(id),
  reset: () => {},
  forAudience: (q: AudienceQuery) => notificationsForAudience(q),
  unreadCount: (q: AudienceQuery) => notificationUnreadCount(q),
  markRead: (id: string) => markNotificationRead(id),
  markAllRead: (q: AudienceQuery) => markAllNotificationsRead(q),
  getStatistics: (q: AudienceQuery) => notificationStatistics(q),
};
