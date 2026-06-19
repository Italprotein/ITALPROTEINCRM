import type { AppNotification, NotificationType, Role, Workspace } from '@/lib/types';
import { NOTIFICATIONS } from '@/fixtures';
import { createRepository } from './repository';

const repo = createRepository<AppNotification>('notifications', NOTIFICATIONS);

export interface AudienceQuery {
  workspace: Workspace;
  role?: Role;
  companyId?: string;
}

function inAudience(n: AppNotification, q: AudienceQuery): boolean {
  if (n.workspace !== q.workspace) return false;
  if (q.workspace === 'external') return !n.audienceCompanyId || n.audienceCompanyId === q.companyId;
  // internal: admins see the whole inbox; other roles see unrestricted + role-targeted items
  if (q.role === 'super_admin' || q.role === 'crm_admin') return true;
  if (!n.audienceRoles || n.audienceRoles.length === 0) return true;
  return q.role ? n.audienceRoles.includes(q.role) : true;
}

const byDateDesc = (a: AppNotification, b: AppNotification) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export const notificationService = {
  list: () => repo.list(),
  get: (id: string) => repo.get(id),
  create: (n: AppNotification) => repo.create(n),
  update: (id: string, patch: Partial<AppNotification>) => repo.update(id, patch),
  remove: (id: string) => repo.remove(id),
  reset: () => repo.reset(),

  async forAudience(q: AudienceQuery): Promise<AppNotification[]> {
    return (await repo.list()).filter((n) => inAudience(n, q)).sort(byDateDesc);
  },
  async unreadCount(q: AudienceQuery): Promise<number> {
    return (await repo.list()).filter((n) => inAudience(n, q) && !n.read).length;
  },
  async markRead(id: string) {
    return repo.update(id, { read: true });
  },
  async markAllRead(q: AudienceQuery) {
    const all = await repo.list();
    await Promise.all(all.filter((n) => inAudience(n, q) && !n.read).map((n) => repo.update(n.id, { read: true })));
  },
  async getStatistics(q: AudienceQuery) {
    const items = (await repo.list()).filter((n) => inAudience(n, q));
    const byType = {} as Record<NotificationType, number>;
    for (const n of items) byType[n.type] = (byType[n.type] ?? 0) + 1;
    return { total: items.length, unread: items.filter((n) => !n.read).length, byType };
  },
};

export type NotificationService = typeof notificationService;
