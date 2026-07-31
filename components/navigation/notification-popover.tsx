'use client';

import * as React from 'react';
import { Bell, CalendarClock, CheckCheck, FileSignature, PackageCheck, UserPlus } from 'lucide-react';

import type { AppNotification } from '@/lib/types';
import { notificationService } from '@/lib/mock-services';
import { useSession } from '@/components/providers/session-provider';
import { Link } from '@/lib/i18n/navigation';
import { formatRelative } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

function notificationIcon(type: AppNotification['type']) {
  if (type === 'meeting_scheduled') return CalendarClock;
  if (type.includes('nda')) return FileSignature;
  if (type.includes('sample') || type.includes('shipment') || type.includes('delivery')) return PackageCheck;
  if (type.includes('registration') || type === 'account_invitation') return UserPlus;
  return Bell;
}

export function NotificationPopover() {
  const { session } = useSession();
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const audience = React.useMemo(() => session ? ({
    workspace: session.workspace,
    role: session.role,
    companyId: session.companyId,
  }) : null, [session]);

  const load = React.useCallback(async () => {
    if (!audience) return;
    const rows = await notificationService.forAudience(audience);
    setNotifications(rows);
    setLoaded(true);
  }, [audience]);

  React.useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const refresh = () => void load();
    window.addEventListener('italprotein-notifications', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('italprotein-notifications', refresh);
    };
  }, [load]);

  const unread = notifications.filter((notification) => !notification.read).length;

  async function markRead(notification: AppNotification) {
    if (notification.read) return;
    setNotifications((rows) => rows.map((row) => row.id === notification.id ? { ...row, read: true } : row));
    await notificationService.markRead(notification.id);
  }

  async function markAllRead() {
    if (!audience) return;
    setNotifications((rows) => rows.map((row) => ({ ...row, read: true })));
    await notificationService.markAllRead(audience);
  }

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) void load(); }}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-background" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(92vw,390px)] overflow-hidden p-0 shadow-xl">
        <div className="flex items-center justify-between border-b bg-brand-navy px-4 py-3 text-white">
          <div>
            <h2 className="font-display text-base font-semibold">Notifications</h2>
            <p className="text-xs text-white/65">{unread ? `${unread} unread` : 'You are all caught up'}</p>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-white hover:bg-white/10 hover:text-white" onClick={() => void markAllRead()}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[min(68vh,560px)] overflow-y-auto">
          {!loaded ? (
            <div className="space-y-4 p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-3">
                  <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2"><div className="skeleton h-3 w-4/5" /><div className="skeleton h-3 w-3/5" /></div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Bell className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold">No notifications yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Updates and meeting invitations will appear here.</p>
            </div>
          ) : (
            notifications.slice(0, 30).map((notification) => {
              const Icon = notificationIcon(notification.type);
              const content = (
                <div className={cn(
                  'relative flex gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/60',
                  !notification.read && 'bg-brand-teal/[0.06]',
                )}>
                  <span className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                    !notification.read ? 'bg-brand-teal text-white' : 'bg-muted text-muted-foreground',
                  )}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span className="line-clamp-1 text-sm font-semibold">{notification.title}</span>
                      {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger" />}
                    </span>
                    {notification.body && <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{notification.body}</span>}
                    <span className="mt-1 block text-2xs font-medium text-brand-teal">{formatRelative(notification.createdAt)}</span>
                  </span>
                </div>
              );
              return notification.href ? (
                <Link key={notification.id} href={notification.href} onClick={() => { void markRead(notification); setOpen(false); }}>
                  {content}
                </Link>
              ) : (
                <button key={notification.id} className="block w-full text-left" onClick={() => void markRead(notification)}>
                  {content}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
