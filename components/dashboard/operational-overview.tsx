'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileSignature,
  Flame,
  FlaskConical,
  HardDrive,
  ListTodo,
  Mail,
  Paperclip,
  RefreshCw,
  Sparkles,
  Target,
  Truck,
  type LucideIcon,
} from 'lucide-react';

import { useSession } from '@/components/providers/session-provider';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { isApiMode } from '@/lib/data-mode';
import { formatRelative } from '@/lib/formatting';
import { Link } from '@/lib/i18n/navigation';
import {
  activityService,
  companyService,
  emailService,
  meetingService,
  ndaService,
  notificationService,
  opportunityService,
  sampleService,
  shipmentService,
  taskService,
} from '@/lib/mock-services';
import { generateAiTasksFromInbox } from '@/lib/services/ai-task.actions';
import { getCommandCenterBrief } from '@/lib/services/dashboard.actions';
import type { CommandCenterBrief, CommandCenterTask } from '@/lib/services/dashboard.types';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const DARK_PANEL = 'rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur-xl';

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={DARK_PANEL}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-sky-300" />
          <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function EmptyPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-4 py-6 text-center text-xs text-slate-500">
      <CheckCircle2 className="h-6 w-6 text-teal-400" />
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  urgent,
  currency,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  icon: LucideIcon;
  urgent?: boolean;
  currency?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        urgent ? 'border-rose-400/30 bg-rose-400/[0.055]' : 'border-white/10 bg-white/[0.045]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', urgent ? 'bg-rose-400/10 text-rose-300' : 'bg-sky-400/10 text-sky-300')}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <ChevronRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-white">
        {currency ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 }).format(value) : value.toLocaleString()}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">{label}</p>
      <p className="mt-1 truncate text-[10px] text-slate-500">{detail}</p>
    </Link>
  );
}

function IntegrationStatus({
  label,
  icon: Icon,
  connected,
  detail,
}: {
  label: string;
  icon: LucideIcon;
  connected: boolean;
  detail: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', connected ? 'bg-teal-400/10 text-teal-300' : 'bg-rose-400/10 text-rose-300')}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-white">{label}</span>
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', connected ? 'bg-teal-400' : 'bg-rose-400')} />
        </div>
        <p className="truncate text-[10px] text-slate-500" title={detail}>{detail}</p>
      </div>
    </div>
  );
}

async function buildDemoBrief(role: Role): Promise<CommandCenterBrief> {
  const [company, opportunity, nda, sample, shipment, task, overdue, dueToday, upcoming, meetings, emails, gmail, shipments, ndas, activity, companies, unread] = await Promise.all([
    companyService.getStatistics(),
    opportunityService.getStatistics(),
    ndaService.getStatistics(),
    sampleService.getStatistics(),
    shipmentService.getStatistics(),
    taskService.getStatistics(),
    taskService.overdue(),
    taskService.dueToday(),
    taskService.upcoming(),
    meetingService.upcoming(),
    emailService.listInbox(8),
    emailService.status(),
    shipmentService.list(),
    ndaService.list(),
    activityService.recent(8),
    companyService.list(),
    notificationService.unreadCount({ workspace: 'internal', role }),
  ]);
  const names = new Map(companies.map((row) => [row.id, row.tradingName || row.legalName]));
  const toTask = (row: (typeof overdue)[number]): CommandCenterTask => ({
    id: row.id,
    title: row.title,
    dueDate: row.dueDate,
    priority: row.priority,
    status: row.status,
    companyName: row.companyId ? names.get(row.companyId) : undefined,
  });
  const delayed = shipments.filter((row) => row.isDelayed && !row.actualDelivery).slice(0, 4);
  const awaiting = ndas.filter((row) => !['fully_signed', 'expired', 'terminated', 'not_required'].includes(row.status)).slice(0, 4);
  const meetingRows = meetings.slice(0, 8).map((row) => ({
    id: `crm-${row.id}`,
    title: row.title,
    start: row.start,
    end: row.end,
    companyName: row.companyId ? names.get(row.companyId) : undefined,
    location: row.location,
    source: 'crm' as const,
  }));
  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      companies: company.total,
      activeOpportunities: opportunity.open,
      weightedPipelineValue: opportunity.weightedValue,
      ndaAwaitingSignature: nda.awaitingSignature,
      samplesAwaitingFeedback: sample.awaitingFeedback,
      delayedShipments: shipment.delayed,
      overdueTasks: task.overdue,
      meetingsNextSevenDays: meetingRows.length,
      unreadNotifications: unread,
    },
    tasks: {
      overdue: overdue.slice(0, 5).map(toTask),
      dueToday: dueToday.slice(0, 5).map(toTask),
      upcoming: upcoming.slice(0, 5).map(toTask),
    },
    meetings: meetingRows,
    emails: emails.map((row) => ({
      id: row.id,
      fromAddress: row.fromAddress,
      fromName: row.fromName,
      subject: row.subject,
      snippet: row.snippet,
      receivedAt: row.internalDate,
      companyName: row.companyId ? names.get(row.companyId) : undefined,
      hasAttachments: row.hasAttachments,
    })),
    risks: [
      ...delayed.map((row) => ({ id: `shipment-${row.id}`, kind: 'shipment' as const, title: row.reference, detail: `${row.courier ?? 'Courier'} · ${row.recipient}`, href: '/admin/shipments' as const, severity: 'danger' as const })),
      ...awaiting.map((row) => ({ id: `nda-${row.id}`, kind: 'nda' as const, title: row.reference, detail: names.get(row.companyId) ?? 'NDA', href: '/admin/ndas' as const, severity: 'warning' as const })),
    ].slice(0, 6),
    recentActivity: activity.map((row) => ({ id: row.id, type: row.type, title: row.title, at: row.at, companyName: row.companyId ? names.get(row.companyId) : undefined })),
    integrations: {
      gmail,
      calendar: { connected: false },
      drive: { connected: false },
      ai: { connected: false, provider: 'groq' },
    },
  };
}

export function OperationalOverviewDashboard() {
  const t = useTranslations('AmineDashboard');
  const locale = useLocale() as 'en' | 'it';
  const { session } = useSession();
  const role = session?.role ?? 'crm_admin';
  const [brief, setBrief] = React.useState<CommandCenterBrief | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const next = isApiMode
        ? await getCommandCenterBrief()
        : await buildDemoBrief(role);
      setBrief(next);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [role]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const formatDateTime = React.useCallback(
    (value: string) =>
      new Intl.DateTimeFormat(locale === 'it' ? 'it-IT' : 'en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value)),
    [locale],
  );

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function syncGmail() {
    setSyncing(true);
    try {
      const result = await emailService.sync();
      if (!result.ok) {
        const description = result.error === 'rate_limited'
          ? t('gmailErrorRateLimited')
          : result.error === 'gmail_not_connected'
            ? t('gmailErrorNotConnected')
            : t('gmailErrorUnknown');
        toast({ variant: 'danger', title: t('gmailSyncFailed'), description });
      } else {
        toast({ variant: 'success', title: t('gmailSynced'), description: t('gmailSyncedDetail', { count: result.created }) });
        await load();
      }
    } catch {
      toast({ variant: 'danger', title: t('gmailSyncFailed'), description: t('gmailErrorUnknown') });
    } finally {
      setSyncing(false);
    }
  }

  async function generateTasks() {
    setGenerating(true);
    try {
      const result = await generateAiTasksFromInbox(locale);
      if (!result.ok) {
        const description = result.error === 'rate_limited'
          ? t('aiErrorRateLimited')
          : result.error === 'openai_not_configured'
            ? t('aiErrorNotConfigured')
            : t('aiErrorUnknown');
        toast({ variant: 'danger', title: t('aiFailed'), description });
      } else {
        toast({ variant: 'success', title: t('aiTasksReady'), description: t('aiTasksReadyDetail', { count: result.tasks.length }) });
        await load();
      }
    } catch {
      toast({ variant: 'danger', title: t('aiFailed'), description: t('aiErrorUnknown') });
    } finally {
      setGenerating(false);
    }
  }

  const metrics = brief?.metrics;
  const focusTasks = brief
    ? [
        ...brief.tasks.overdue.map((task) => ({ task, label: t('overdue'), tone: 'danger' as const })),
        ...brief.tasks.dueToday.map((task) => ({ task, label: t('dueToday'), tone: 'warning' as const })),
      ].slice(0, 6)
    : [];
  const displayedTasks = focusTasks.length
    ? focusTasks
    : (brief?.tasks.upcoming ?? []).slice(0, 6).map((task) => ({ task, label: t('upcoming'), tone: 'info' as const }));

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[radial-gradient(120%_90%_at_10%_0%,#10294d_0%,#070b16_45%,#04060c_100%)] text-white">
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-300">
              <span className={cn('h-1.5 w-1.5 rounded-full', loadError ? 'bg-rose-400' : 'bg-teal-400')} />
              {loadError ? t('statusDegraded') : t('statusBadge')}
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">{t('welcomeBack')} <span className="text-sky-300">Amine</span></h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">{t('operationalSubtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              <Link href="/admin/tasks"><ListTodo />{t('openTasks')}</Link>
            </Button>
            <Button variant="outline" size="sm" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => void generateTasks()} disabled={generating || !brief?.integrations.ai.connected}>
              <Sparkles className={cn(generating && 'animate-pulse')} />{generating ? t('generating') : t('generateTasks')}
            </Button>
            <Button variant="outline" size="icon-sm" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => void refresh()} disabled={refreshing} aria-label={t('refresh')}>
              <RefreshCw className={cn(refreshing && 'animate-spin')} />
            </Button>
          </div>
        </header>

        {loadError ? (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            <span>{t('loadFailed')}</span>
            <Button variant="outline" size="sm" className="border-rose-300/30 bg-transparent text-rose-100 hover:bg-rose-300/10" onClick={() => void refresh()}>{t('retry')}</Button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label={t('kpiCompanies')} value={metrics?.companies ?? 0} detail={t('kpiCompaniesDetail')} href="/admin/companies" icon={Building2} />
          <MetricCard label={t('kpiActivePipeline')} value={metrics?.activeOpportunities ?? 0} detail={t('kpiActivePipelineDetail')} href="/admin/pipeline" icon={Target} />
          <MetricCard label={t('kpiPipelineValue')} value={metrics?.weightedPipelineValue ?? 0} detail={t('kpiPipelineValueDetail')} href="/admin/pipeline" icon={Flame} currency />
          <MetricCard label={t('kpiNdaWaiting')} value={metrics?.ndaAwaitingSignature ?? 0} detail={t('kpiNdaWaitingDetail')} href="/admin/ndas" icon={FileSignature} urgent={Boolean(metrics?.ndaAwaitingSignature)} />
          <MetricCard label={t('kpiFeedbackWaiting')} value={metrics?.samplesAwaitingFeedback ?? 0} detail={t('kpiFeedbackWaitingDetail')} href="/admin/samples" icon={FlaskConical} />
          <MetricCard label={t('kpiDelayedShipments')} value={metrics?.delayedShipments ?? 0} detail={t('kpiDelayedShipmentsDetail')} href="/admin/shipments" icon={Truck} urgent={Boolean(metrics?.delayedShipments)} />
          <MetricCard label={t('kpiMeetings')} value={metrics?.meetingsNextSevenDays ?? 0} detail={t('kpiMeetingsDetail')} href="/admin/calendar" icon={CalendarDays} />
          <MetricCard label={t('kpiOverdueTasks')} value={metrics?.overdueTasks ?? 0} detail={t('kpiOverdueTasksDetail')} href="/admin/tasks" icon={AlertTriangle} urgent={Boolean(metrics?.overdueTasks)} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title={t('todayFocus')} icon={ListTodo} action={<Link href="/admin/tasks" className="text-xs text-sky-300 hover:text-sky-200">{t('viewAll')}</Link>}>
            {!brief ? <div className="h-48 animate-pulse rounded-xl bg-white/5" /> : displayedTasks.length === 0 ? <EmptyPanel>{t('noPriorityTasks')}</EmptyPanel> : (
              <ul className="space-y-1">
                {displayedTasks.map(({ task, label, tone }) => (
                  <li key={`${tone}-${task.id}`}>
                    <Link href="/admin/tasks" className="flex items-center gap-3 rounded-xl px-2.5 py-2 hover:bg-white/5">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', tone === 'danger' ? 'bg-rose-400' : tone === 'warning' ? 'bg-amber-400' : 'bg-sky-400')} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">{task.title}</p>
                        <p className="truncate text-[10px] text-slate-500">{task.companyName ?? label}{task.dueDate ? ` · ${formatDateTime(task.dueDate)}` : ''}</p>
                      </div>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase', tone === 'danger' ? 'bg-rose-400/10 text-rose-300' : tone === 'warning' ? 'bg-amber-400/10 text-amber-300' : 'bg-sky-400/10 text-sky-300')}>{label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t('nextMeetings')} icon={CalendarDays} action={<Link href="/admin/calendar" className="text-xs text-sky-300 hover:text-sky-200">{t('calendar')}</Link>}>
            {!brief ? <div className="h-48 animate-pulse rounded-xl bg-white/5" /> : brief.meetings.length === 0 ? <EmptyPanel>{brief.integrations.calendar.connected ? t('noMeetings') : t('calendarNotConnected')}</EmptyPanel> : (
              <ul className="space-y-1">
                {brief.meetings.slice(0, 6).map((meeting) => {
                  const body = (
                    <>
                      <div className="flex h-9 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-sky-400/10 text-sky-200">
                        <span className="text-[9px] uppercase">{new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(meeting.start))}</span>
                        <span className="text-sm font-bold leading-none">{new Date(meeting.start).getDate()}</span>
                      </div>
                      <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-100">{meeting.title}</p><p className="truncate text-[10px] text-slate-500">{formatDateTime(meeting.start)}{meeting.companyName ? ` · ${meeting.companyName}` : ''}</p></div>
                      <span className="text-[9px] uppercase text-slate-600">{meeting.source}</span>
                    </>
                  );
                  return meeting.externalUrl
                    ? <li key={meeting.id}><a href={meeting.externalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">{body}<ExternalLink className="h-3 w-3 text-slate-500" /></a></li>
                    : <li key={meeting.id}><Link href="/admin/calendar" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">{body}</Link></li>;
                })}
              </ul>
            )}
          </Panel>

          <Panel title={t('recentInbox')} icon={Mail} action={<button type="button" className="flex items-center gap-1 text-xs text-sky-300 hover:text-sky-200 disabled:opacity-50" onClick={() => void syncGmail()} disabled={syncing || !brief?.integrations.gmail.connected}><RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />{t('sync')}</button>}>
            {!brief ? <div className="h-48 animate-pulse rounded-xl bg-white/5" /> : brief.emails.length === 0 ? <EmptyPanel>{brief.integrations.gmail.connected ? t('noRecentEmail') : t('gmailNotConnected')}</EmptyPanel> : (
              <ul className="space-y-1">
                {brief.emails.slice(0, 6).map((email) => (
                  <li key={email.id}><Link href="/admin/communications" className="flex items-start gap-3 rounded-xl px-2.5 py-2 hover:bg-white/5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-400/10 text-xs font-bold text-teal-300">{(email.fromName || email.fromAddress).slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5"><p className="truncate text-xs font-semibold text-slate-200">{email.fromName || email.fromAddress}</p>{email.hasAttachments ? <Paperclip className="h-3 w-3 shrink-0 text-slate-500" /> : null}</div>
                      <p className="truncate text-xs text-slate-400">{email.subject || t('noSubject')}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{formatRelative(email.receivedAt, locale)}</p>
                    </div>
                  </Link></li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title={t('risksRequiringAction')} icon={AlertTriangle} action={<span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[10px] font-semibold text-rose-300">{brief?.risks.length ?? 0}</span>}>
            {!brief ? <div className="h-32 animate-pulse rounded-xl bg-white/5" /> : brief.risks.length === 0 ? <EmptyPanel>{t('noOperationalRisks')}</EmptyPanel> : (
              <div className="grid gap-2 sm:grid-cols-2">{brief.risks.map((risk) => (
                <Link key={risk.id} href={risk.href} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', risk.severity === 'danger' ? 'border-rose-400/20 bg-rose-400/5 hover:bg-rose-400/10' : 'border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10')}>
                  {risk.kind === 'shipment' ? <Truck className="h-4 w-4 shrink-0 text-rose-300" /> : <FileSignature className="h-4 w-4 shrink-0 text-amber-300" />}
                  <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-100">{risk.title}</p><p className="truncate text-[10px] text-slate-500">{risk.detail}</p></div><ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                </Link>
              ))}</div>
            )}
          </Panel>

          <Panel title={t('recentActivity')} icon={Activity} action={<Link href="/admin/activities" className="text-xs text-sky-300 hover:text-sky-200">{t('viewAll')}</Link>}>
            {!brief ? <div className="h-32 animate-pulse rounded-xl bg-white/5" /> : brief.recentActivity.length === 0 ? <EmptyPanel>{t('noRecentActivity')}</EmptyPanel> : (
              <div className="grid gap-2 sm:grid-cols-2">{brief.recentActivity.slice(0, 6).map((row) => (
                <Link key={row.id} href="/admin/activities" className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 hover:bg-white/5">
                  <Activity className="h-4 w-4 shrink-0 text-sky-300" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-100">{row.title}</p><p className="truncate text-[10px] text-slate-500">{row.companyName ?? row.type} · {formatRelative(row.at, locale)}</p></div>
                </Link>
              ))}</div>
            )}
          </Panel>
        </div>

        <section className={cn(DARK_PANEL, 'p-4')}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-teal-300" /><h2 className="text-sm font-semibold">{t('liveIntegrations')}</h2></div>
            <div className="flex items-center gap-2 text-[10px] text-slate-500"><Bell className="h-3.5 w-3.5" />{t('unreadNotifications', { count: metrics?.unreadNotifications ?? 0 })}<span>·</span>{brief ? t('updated', { time: formatRelative(brief.generatedAt, locale) }) : t('loading')}</div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <IntegrationStatus label="Gmail API" icon={Mail} connected={Boolean(brief?.integrations.gmail.connected)} detail={brief?.integrations.gmail.connected ? t('gmailConnectedAs', { email: brief.integrations.gmail.email ?? 'Google' }) : (brief?.integrations.gmail.error ?? t('notConnected'))} />
            <IntegrationStatus label="Google Calendar API" icon={CalendarDays} connected={Boolean(brief?.integrations.calendar.connected)} detail={brief?.integrations.calendar.error ?? (brief?.integrations.calendar.connected ? t('calendarLive') : t('notConnected'))} />
            <IntegrationStatus label="Google Drive API" icon={HardDrive} connected={Boolean(brief?.integrations.drive.connected)} detail={brief?.integrations.drive.connected ? t('driveLive') : t('notConnected')} />
            <IntegrationStatus label={brief?.integrations.ai.provider === 'openai' ? 'OpenAI' : 'Groq AI'} icon={Bot} connected={Boolean(brief?.integrations.ai.connected)} detail={brief?.integrations.ai.connected ? t('aiLive') : t('notConfigured')} />
          </div>
        </section>
      </div>
    </div>
  );
}
