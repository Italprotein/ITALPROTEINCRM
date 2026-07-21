'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BellRing,
  AlertTriangle,
  CheckCheck,
  Truck,
  PackageCheck,
  Package,
  ShieldCheck,
  ShieldAlert,
  FileSignature,
  MessageSquareReply,
  ClipboardCheck,
  MessageCircle,
  Receipt,
  Clock,
  CalendarClock,
  UserPlus,
  CircleCheck,
  KeyRound,
  Mail,
  Check,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';

import { useSession } from '@/components/providers/session-provider';
import { notificationService } from '@/lib/mock-services';
import type { AppNotification, NotificationType } from '@/lib/types';
import { getLabel, getTone, type BadgeTone } from '@/lib/labels';
import { formatRelative } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

/** Current time for relative times and Today/Earlier grouping. */
const NOW = new Date();

/** Type → icon, so each row gets a recognisable chip. */
const TYPE_ICONS: Record<NotificationType, LucideIcon> = {
  new_registration: UserPlus,
  registration_decision: CircleCheck,
  new_sample_request: Package,
  sample_approved: CircleCheck,
  ready_to_ship: PackageCheck,
  shipment_dispatched: Truck,
  customs_hold: AlertTriangle,
  delivery_delay: Clock,
  delivery_confirmed: PackageCheck,
  feedback_requested: ClipboardCheck,
  feedback_submitted: ClipboardCheck,
  technical_reply: MessageSquareReply,
  nda_sent: FileSignature,
  nda_changes_requested: ShieldAlert,
  nda_signed: ShieldCheck,
  nda_expiring: ShieldAlert,
  task_due: CalendarClock,
  task_overdue: AlertTriangle,
  support_request: MessageCircle,
  invoice_overdue: Receipt,
  password_reset: KeyRound,
  manual_email: Mail,
};

/** Tone → background / text / left-border classes for the icon chip + unread accent. */
const TONE_STYLES: Record<BadgeTone, { chip: string; border: string; dot: string }> = {
  success: { chip: 'bg-success-subtle text-success', border: 'border-l-success', dot: 'bg-success' },
  info: { chip: 'bg-info-subtle text-info', border: 'border-l-info', dot: 'bg-info' },
  warning: { chip: 'bg-warning-subtle text-warning-foreground', border: 'border-l-warning', dot: 'bg-warning' },
  danger: { chip: 'bg-danger-subtle text-danger', border: 'border-l-danger', dot: 'bg-danger' },
  gold: { chip: 'bg-brand-gold/15 text-brand-goldDark', border: 'border-l-brand-gold', dot: 'bg-brand-gold' },
  secondary: { chip: 'bg-secondary text-secondary-foreground', border: 'border-l-secondary', dot: 'bg-secondary-foreground' },
  default: { chip: 'bg-brand-navy/5 text-brand-navy', border: 'border-l-brand-navy', dot: 'bg-brand-navy' },
  outline: { chip: 'bg-muted text-muted-foreground', border: 'border-l-border', dot: 'bg-muted-foreground' },
  muted: { chip: 'bg-muted text-muted-foreground', border: 'border-l-border', dot: 'bg-muted-foreground' },
};

function isToday(iso: string): boolean {
  const d = new Date(iso);
  return (
    d.getUTCFullYear() === NOW.getUTCFullYear() &&
    d.getUTCMonth() === NOW.getUTCMonth() &&
    d.getUTCDate() === NOW.getUTCDate()
  );
}

type CategoryFilter = 'all' | NotificationType;

export default function PortalNotificationsPage() {
  const { session, ready } = useSession();
  const companyId = session?.companyId;
  const router = useRouter();

  const [items, setItems] = React.useState<AppNotification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [category, setCategory] = React.useState<CategoryFilter>('all');
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  const query = React.useMemo(
    () => ({ workspace: 'external' as const, companyId }),
    [companyId],
  );

  React.useEffect(() => {
    if (!ready) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const list = await notificationService.forAudience(query);
      if (!alive) return;
      setItems(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [ready, companyId, query]);

  /* ── Derived stats over the full (unfiltered) list ── */
  const stats = React.useMemo(() => {
    const unread = items.filter((n) => !n.read).length;
    const highPriority = items.filter(
      (n) => (n.priority === 'high' || n.priority === 'urgent') && !n.read,
    ).length;
    return { total: items.length, unread, highPriority };
  }, [items]);

  /* ── Category options present in this company's notifications ── */
  const categoryOptions = React.useMemo(() => {
    const seen = new Set<NotificationType>();
    for (const n of items) seen.add(n.type);
    return Array.from(seen);
  }, [items]);

  /* ── Apply filters ── */
  const filtered = React.useMemo(() => {
    return items.filter((n) => {
      if (category !== 'all' && n.type !== category) return false;
      if (unreadOnly && n.read) return false;
      return true;
    });
  }, [items, category, unreadOnly]);

  const today = React.useMemo(() => filtered.filter((n) => isToday(n.createdAt)), [filtered]);
  const earlier = React.useMemo(() => filtered.filter((n) => !isToday(n.createdAt)), [filtered]);

  /* ── Actions ── */
  async function handleMarkRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await notificationService.markRead(id);
    toast({ title: 'Marked as read' });
  }

  async function handleMarkAll() {
    if (stats.unread === 0) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await notificationService.markAllRead(query);
    toast({
      title: 'All caught up',
      description: 'Every notification is now marked as read.',
    });
  }

  function handleOpen(n: AppNotification) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      void notificationService.markRead(n.id);
    }
    if (n.href) router.push(n.href);
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  /* ── No company linked ── */
  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notifications" subtitle="Updates about your samples, shipments and more" />
        <EmptyState
          icon={Bell}
          title="No company linked to your account"
          description="We couldn't find a company for your sign-in. Please contact your Italprotein account manager."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Updates about your samples, shipments, documents and messages"
        actions={
          <Button variant="outline" onClick={handleMarkAll} disabled={stats.unread === 0}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total"
          value={stats.total}
          icon={Bell}
          tone="default"
          hint="All your notifications"
        />
        <StatCard
          label="Unread"
          value={stats.unread}
          icon={BellRing}
          tone={stats.unread > 0 ? 'info' : 'success'}
          hint={stats.unread > 0 ? 'Waiting for your attention' : "You're all caught up"}
          delay={0.05}
        />
        <StatCard
          label="High priority"
          value={stats.highPriority}
          icon={AlertTriangle}
          tone={stats.highPriority > 0 ? 'warning' : 'success'}
          hint={stats.highPriority > 0 ? 'Unread items that need a look' : 'Nothing urgent'}
          delay={0.1}
        />
      </div>

      {/* Filters */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="ntf-category" className="text-sm text-muted-foreground">
            Show
          </Label>
          <Select value={category} onValueChange={(v) => setCategory(v as CategoryFilter)}>
            <SelectTrigger id="ntf-category" className="w-[15rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All notifications</SelectItem>
              {categoryOptions.map((t) => (
                <SelectItem key={t} value={t}>
                  {getLabel('notificationType', t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="ntf-unread" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
          <Label htmlFor="ntf-unread" className="cursor-pointer text-sm">
            Unread only
          </Label>
        </div>
      </Card>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={items.length === 0 ? Bell : CheckCheck}
          title={items.length === 0 ? 'No notifications yet' : 'Nothing to show here'}
          description={
            items.length === 0
              ? "When there's an update on your samples, shipments or documents, you'll see it here."
              : unreadOnly
                ? "You've read everything that matches this filter."
                : 'No notifications match the selected category.'
          }
          action={
            items.length > 0 && (category !== 'all' || unreadOnly) ? (
              <Button
                variant="outline"
                onClick={() => {
                  setCategory('all');
                  setUnreadOnly(false);
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {today.length > 0 && (
            <NotificationGroup
              title="Today"
              count={today.length}
              items={today}
              onMarkRead={handleMarkRead}
              onOpen={handleOpen}
            />
          )}
          {earlier.length > 0 && (
            <NotificationGroup
              title="Earlier"
              count={earlier.length}
              items={earlier}
              onMarkRead={handleMarkRead}
              onOpen={handleOpen}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────── Group ────────────────────────────── */

function NotificationGroup({
  title,
  count,
  items,
  onMarkRead,
  onOpen,
}: {
  title: string;
  count: number;
  items: AppNotification[];
  onMarkRead: (id: string) => void;
  onOpen: (n: AppNotification) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        <Badge variant="muted">{count}</Badge>
      </div>
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((n) => (
            <motion.li
              key={n.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 12, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <NotificationRow n={n} onMarkRead={onMarkRead} onOpen={onOpen} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}

/* ────────────────────────────── Row ────────────────────────────── */

function NotificationRow({
  n,
  onMarkRead,
  onOpen,
}: {
  n: AppNotification;
  onMarkRead: (id: string) => void;
  onOpen: (n: AppNotification) => void;
}) {
  const tone = getTone('notificationType', n.type);
  const styles = TONE_STYLES[tone] ?? TONE_STYLES.muted;
  const Icon = TYPE_ICONS[n.type] ?? Bell;
  const clickable = !!n.href;

  return (
    <Card
      onClick={clickable ? () => onOpen(n) : undefined}
      className={cn(
        'flex items-start gap-3 border-l-4 p-4 transition-colors',
        n.read ? 'border-l-transparent' : cn(styles.border, 'bg-muted/30'),
        clickable && 'cursor-pointer hover:bg-muted/50',
      )}
    >
      {/* Icon chip */}
      <span
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          styles.chip,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {!n.read && (
            <span
              className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', styles.dot)}
              aria-label="Unread"
            />
          )}
          <p className={cn('text-sm leading-snug', n.read ? 'font-medium' : 'font-semibold')}>
            {n.title}
          </p>
        </div>
        {n.body && (
          <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={tone} className="text-[11px]">
            {getLabel('notificationType', n.type)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelative(n.createdAt, 'en', NOW)}
          </span>
          {clickable && (
            <span className="inline-flex items-center text-xs font-medium text-primary">
              View
              <ChevronRight className="ml-0.5 h-3 w-3" />
            </span>
          )}
        </div>
      </div>

      {/* Mark read */}
      {!n.read && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead(n.id);
          }}
        >
          <Check className="mr-1.5 h-3.5 w-3.5" />
          Mark read
        </Button>
      )}
    </Card>
  );
}
