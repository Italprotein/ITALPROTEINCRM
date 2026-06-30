import type { Notification as PrismaNotification, RoleKey } from "@/lib/generated/prisma/client";
import type { AppNotification, NotificationType, Role, Workspace } from "@/lib/types";

// Prisma row <-> AppNotification DTO. Notifications carry audience metadata
// (workspace/roles/company) plus an optional subject companyId. RoleKey[] in the
// schema is value-compatible with the DTO's Role[]. readAt/recipientUserId are
// server-only persistence columns and are not surfaced on the DTO.

const undef = <T,>(v: T | null): T | undefined => (v == null ? undefined : v);

/** Prisma row -> AppNotification DTO (the shape the UI consumes). */
export function notificationToDTO(n: PrismaNotification): AppNotification {
  return {
    id: n.id,
    type: n.type as NotificationType,
    workspace: n.workspace as Workspace,
    audienceRoles: n.audienceRoles.length ? (n.audienceRoles as unknown as Role[]) : undefined,
    audienceCompanyId: undef(n.audienceCompanyId),
    title: n.title,
    body: undef(n.body),
    companyId: undef(n.companyId),
    relatedId: undef(n.relatedId),
    relatedType: undef(n.relatedType),
    href: undef(n.href),
    priority: n.priority,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

/** AppNotification DTO -> Prisma write payload (shared by create and update). */
export function notificationWriteData(input: AppNotification) {
  return {
    type: input.type,
    workspace: input.workspace,
    audienceRoles: (input.audienceRoles ?? []) as unknown as RoleKey[],
    audienceCompanyId: input.audienceCompanyId ?? null,
    title: input.title,
    body: input.body ?? null,
    companyId: input.companyId ?? null,
    relatedId: input.relatedId ?? null,
    relatedType: input.relatedType ?? null,
    href: input.href ?? null,
    priority: input.priority,
    read: input.read,
    readAt: input.read ? new Date() : null,
  };
}
