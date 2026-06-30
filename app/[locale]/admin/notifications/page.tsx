'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, BellRing, AlertTriangle, CheckCheck, Trash2, Circle, Settings2,
  FileSignature, FlaskConical, Truck, MessageSquareText, UserPlus, ListChecks, FileText, Receipt,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { notificationService, companyService } from '@/lib/mock-services';
import type { AppNotification, NotificationType, Company } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatRelative } from '@/lib/formatting';
import { useSession } from '@/components/providers/session-provider';
import { Link } from '@/lib/i18n/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { PriorityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/components/ui/use-toast';

const ALL = '__all__';
const TODAY = '2026-06-17';

const ICON: Partial<Record<NotificationType, LucideIcon>> = {
  nda_sent: FileSignature, nda_changes_requested: FileSignature, nda_signed: FileSignature, nda_expiring: FileSignature,
  new_sample_request: FlaskConical, sample_approved: FlaskConical, ready_to_ship: FlaskConical,
  shipment_dispatched: Truck, customs_hold: Truck, delivery_delay: Truck, delivery_confirmed: Truck,
  feedback_requested: MessageSquareText, feedback_submitted: MessageSquareText, technical_reply: MessageSquareText,
  new_registration: UserPlus, registration_decision: UserPlus,
  task_due: ListChecks, task_overdue: ListChecks, support_request: MessageSquareText, invoice_overdue: Receipt,
};
function iconFor(t: NotificationType) { return ICON[t] ?? Bell; }
const toneCls = (p: string) => p === 'urgent' ? 'bg-danger-subtle text-danger' : p === 'high' ? 'bg-warning-subtle text-warning-foreground' : p === 'medium' ? 'bg-info-subtle text-info' : 'bg-muted text-muted-foreground';

export default function NotificationsPage() {
  const t = useTranslations('AdminNotifications');
  const { session, ready } = useSession();
  const q = React.useMemo(() => ({ workspace: 'internal' as const, role: session?.role }), [session?.role]);

  const [rows, setRows] = React.useState<AppNotification[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [fType, setFType] = React.useState(ALL);
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  React.useEffect(() => {
    if (!ready) return;
    notificationService.forAudience(q).then((l) => setRows([...l].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
    companyService.list().then((l) => setCompanyMap(new Map(l.map((c) => [c.id, c]))));
  }, [ready, q]);

  const stats = React.useMemo(() => {
    const all = rows ?? [];
    const byType = new Map<NotificationType, number>();
    for (const n of all) byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
    return {
      total: all.length,
      unread: all.filter((n) => !n.read).length,
      high: all.filter((n) => n.priority === 'high' || n.priority === 'urgent').length,
      topType: [...byType.entries()].sort((a, b) => b[1] - a[1])[0],
    };
  }, [rows]);

  const types = React.useMemo(() => [...new Set((rows ?? []).map((n) => n.type))], [rows]);

  const filtered = React.useMemo(() => {
    let d = rows ?? [];
    if (fType !== ALL) d = d.filter((n) => n.type === fType);
    if (unreadOnly) d = d.filter((n) => !n.read);
    return d;
  }, [rows, fType, unreadOnly]);

  const today = filtered.filter((n) => n.createdAt.slice(0, 10) === TODAY);
  const earlier = filtered.filter((n) => n.createdAt.slice(0, 10) !== TODAY);

  function markRead(n: AppNotification) {
    if (n.read) return;
    setRows((prev) => prev ? prev.map((x) => x.id === n.id ? { ...x, read: true } : x) : prev);
    void notificationService.markRead(n.id);
  }
  function markAll() {
    setRows((prev) => prev ? prev.map((x) => ({ ...x, read: true })) : prev);
    void notificationService.markAllRead(q);
    toast({ variant: 'success', title: t('toastCaughtUpTitle'), description: t('toastCaughtUpDescription') });
  }
  function remove(n: AppNotification) {
    setRows((prev) => prev ? prev.filter((x) => x.id !== n.id) : prev);
    void notificationService.remove(n.id);
    toast({ title: t('toastRemovedTitle') });
  }

  function Row({ n }: { n: AppNotification }) {
    const Icon = iconFor(n.type);
    const c = n.companyId ? companyMap.get(n.companyId) : undefined;
    const body = (
      <div className={`flex gap-3 rounded-lg border p-3 transition-colors ${n.read ? 'bg-card' : 'border-l-2 border-l-brand-gold bg-brand-gold/[0.04]'}`}>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneCls(n.priority)}`}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{n.title}</p>
            <div className="flex shrink-0 items-center gap-1">
              {!n.read && <span className="h-2 w-2 rounded-full bg-brand-gold" aria-label={t('ariaUnread')} />}
              <span className="text-2xs text-muted-foreground">{formatRelative(n.createdAt)}</span>
            </div>
          </div>
          {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-2xs text-muted-foreground">{getLabel('notificationType', n.type)}</span>
            {c && <span className="text-2xs font-medium text-foreground">· {c.tradingName || c.legalName}</span>}
            {(n.priority === 'high' || n.priority === 'urgent') && <PriorityBadge value={n.priority} className="ml-1" />}
            <span className="ml-auto flex items-center gap-1">
              {!n.read && <Button variant="ghost" size="icon-sm" onClick={(e) => { e.preventDefault(); markRead(n); }} aria-label={t('ariaMarkRead')}><Circle className="h-3.5 w-3.5" /></Button>}
              <Button variant="ghost" size="icon-sm" onClick={(e) => { e.preventDefault(); remove(n); }} aria-label={t('ariaDelete')}><Trash2 className="h-3.5 w-3.5" /></Button>
            </span>
          </div>
        </div>
      </div>
    );
    return (
      <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
        {n.href ? <Link href={n.href} onClick={() => markRead(n)}>{body}</Link> : <button className="w-full text-left" onClick={() => markRead(n)}>{body}</button>}
      </motion.div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm"><Settings2 /> {t('settings')}</Button></PopoverTrigger>
              <PopoverContent align="end" className="w-64">
                <p className="mb-2 text-sm font-semibold">{t('emailNotifications')}</p>
                {(['emailNdaUpdates', 'emailSampleRequests', 'emailShipmentEvents', 'emailFeedback', 'emailTaskReminders'] as const).map((k) => (
                  <div key={k} className="flex items-center justify-between py-1.5"><Label className="text-sm font-normal">{t(k)}</Label><Switch defaultChecked /></div>
                ))}
              </PopoverContent>
            </Popover>
            <Button variant="gold" size="sm" onClick={markAll}><CheckCheck /> {t('markAllAsRead')}</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('statTotal')} value={stats.total} icon={Bell} tone="gold" />
        <StatCard label={t('statUnread')} value={stats.unread} icon={BellRing} tone="danger" delay={0.05} />
        <StatCard label={t('statHighPriority')} value={stats.high} icon={AlertTriangle} tone="warning" delay={0.1} />
        <StatCard label={stats.topType ? getLabel('notificationType', stats.topType[0]) : t('statMostCommon')} value={stats.topType?.[1] ?? 0} icon={MessageSquareText} tone="info" delay={0.15} />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Select value={fType} onValueChange={setFType}>
              <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder={t('categoryPlaceholder')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allCategories')}</SelectItem>
                {types.map((nt) => <SelectItem key={nt} value={nt}>{getLabel('notificationType', nt)}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2"><Switch id="uo" checked={unreadOnly} onCheckedChange={setUnreadOnly} /><Label htmlFor="uo" className="text-sm font-normal">{t('unreadOnly')}</Label></div>
          </div>

          {rows === null ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Bell} title={t('emptyTitle')} description={t('emptyDescription')} />
          ) : (
            <div className="space-y-5">
              {today.length > 0 && (
                <div><p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{t('sectionToday')}</p>
                  <div className="space-y-2"><AnimatePresence initial={false}>{today.map((n) => <Row key={n.id} n={n} />)}</AnimatePresence></div></div>
              )}
              {earlier.length > 0 && (
                <div><p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{t('sectionEarlier')}</p>
                  <div className="space-y-2"><AnimatePresence initial={false}>{earlier.map((n) => <Row key={n.id} n={n} />)}</AnimatePresence></div></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
