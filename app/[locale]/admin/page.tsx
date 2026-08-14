'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Building2,
  Target,
  FileSignature,
  FlaskConical,
  Truck,
  AlertTriangle,
  UserPlus,
  Mail,
  Phone,
  Calendar as CalendarIcon,
  StickyNote,
  CheckSquare,
  GitBranch,
  ShieldCheck,
  FileText,
  Receipt,
  MessageSquareText,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { CompanyLogo } from '@/components/shared/company-logo';
import { Stagger, StaggerItem } from '@/components/shared/motion';
import { FollowUpPanel } from '@/components/crm/follow-up-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/lib/i18n/navigation';
import {
  companyService,
  opportunityService,
  ndaService,
  sampleService,
  taskService,
  meetingService,
  registrationService,
  activityService,
} from '@/lib/mock-services';
import { getLabel, getTone, type BadgeTone } from '@/lib/labels';
import { formatRelative, formatDate, daysUntil } from '@/lib/formatting';
import { NDA_PENDING } from '@/lib/company-views';
import { tallyPipelinePhases } from '@/lib/pipeline-phases';
import { currentNdasOf } from '@/lib/nda-stats';
import { cn } from '@/lib/utils';
import { canView } from '@/lib/permissions';
import { useSession } from '@/components/providers/session-provider';
import { OperationalOverviewDashboard } from '@/components/dashboard/operational-overview';
import type {
  Activity,
  ActivityType,
  Company,
  Locale,
  Meeting,
  NDA,
  Registration,
  RegistrationStatus,
  SampleRequest,
  SampleStatus,
  Task,
} from '@/lib/types';

/* ───────────────────────────── helpers ───────────────────────────── */

const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  email: Mail,
  call: Phone,
  meeting: CalendarIcon,
  note: StickyNote,
  task: CheckSquare,
  company_status_change: GitBranch,
  opportunity_change: Target,
  nda_event: ShieldCheck,
  sample_event: FlaskConical,
  shipment_event: Truck,
  feedback: MessageSquareText,
  technical_reply: MessageSquareText,
  document: FileText,
  quote: Receipt,
  order: Receipt,
  invoice: Receipt,
  payment: Receipt,
  registration: UserPlus,
};

/**
 * A sample has physically arrived and the ball is in the customer's court: the
 * only two states where *we* are waiting on a verdict. Deliberately narrower
 * than `sampleService.getStatistics().awaitingFeedback`, which also counts
 * `delivered` / `receipt_confirmed` — parcels that landed but whose trial has
 * not started, and which nobody can chase yet.
 */
const SAMPLE_AWAITING_FEEDBACK: SampleStatus[] = ['testing', 'feedback_requested'];

/** Mirrors `registrationService.getStatistics().pending` — a sign-up nobody has ruled on. */
const REGISTRATION_PENDING: RegistrationStatus[] = [
  'submitted',
  'email_verification',
  'pending_approval',
];

/** How many rows a "needs attention" list shows before deferring to its module. */
const ATTENTION_ROWS = 5;

/** How many rows My Day shows before deferring to /admin/tasks. */
const MY_DAY_ROWS = 6;

/**
 * Band fill per pipeline phase, as Tailwind class pairs rather than inline hex.
 *
 * Deliberately not `CHART_COLORS`: its first entry is brand navy (#0a1628),
 * which against the dark card (`--card: 216 48% 9.5%`) and the bar's own
 * `bg-muted` track (`--muted: 215 31% 13%`) measures 1.00:1 and 1.09:1 — the
 * largest band read as a hole in the graphic for every dark-mode user. One flat
 * hex cannot serve both themes, and a class pair is the only way to carry two;
 * scoping the pair here leaves `lib/chart-colors.ts` — shared with the analytics
 * charts — untouched.
 *
 * 700 in light, 400 in dark. Every one of the 24 fill/surface pairs was measured
 * against both `--muted` and `--card` in both themes; the worst is 4.59:1,
 * comfortably over the 3:1 WCAG 1.4.11 asks of a non-text graphic. Hues are
 * spread so no two *adjacent* bands share a family, and they echo the KPI tints
 * where the modules line up: violet = NDAs, amber = samples, emerald = won.
 */
const PIPELINE_PHASE_COLOR: Record<string, string> = {
  prospecting: 'bg-slate-700 dark:bg-slate-400',
  nda: 'bg-violet-700 dark:bg-violet-400',
  calls: 'bg-cyan-700 dark:bg-cyan-400',
  sampling: 'bg-amber-700 dark:bg-amber-400',
  commercial: 'bg-fuchsia-700 dark:bg-fuchsia-400',
  customer: 'bg-emerald-700 dark:bg-emerald-400',
};

/** Semantic tone → dot fill. Statuses keep the tones `lib/labels.ts` assigns them. */
const TONE_DOT: Record<BadgeTone, string> = {
  default: 'bg-primary',
  secondary: 'bg-secondary-foreground/40',
  outline: 'bg-border',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  gold: 'bg-brand-gold',
  muted: 'bg-muted-foreground/50',
};

/**
 * Module tints for the four KPI icons — the one place on this page where colour
 * means "which part of the CRM", not "how urgent". They tint a 8×8 icon chip
 * only; every piece of text on the card stays on `foreground`/`muted-foreground`.
 */
const KPI_TINT = {
  companies: 'bg-brand-molecular/10 text-brand-molecular dark:bg-brand-blueBright/10 dark:text-brand-blueBright',
  pipeline: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-400/10 dark:text-emerald-400',
  ndas: 'bg-violet-500/10 text-violet-500 dark:bg-violet-400/10 dark:text-violet-400',
  samples: 'bg-amber-500/10 text-amber-500 dark:bg-amber-400/10 dark:text-amber-400',
} as const;

type KpiTint = keyof typeof KPI_TINT;

/** One of the four numbers at the top. The whole card is the link to its module. */
function KpiCard({
  label,
  value,
  icon: Icon,
  tint,
  href,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tint: KpiTint;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="h-full rounded-lg border bg-card p-4 shadow-sm transition-shadow duration-150 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', KPI_TINT[tint])}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-2 text-2xl font-bold tabular tracking-tight">{value}</p>
      </div>
    </Link>
  );
}

/** Card with a title, an optional count badge and a "go to the module" link. */
function Panel({
  title,
  count,
  href,
  linkLabel,
  children,
  className,
}: {
  title: string;
  count?: number;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <CardTitle className="truncate text-base">{title}</CardTitle>
          {count != null && count > 0 && (
            <Badge variant="muted" className="tabular">
              {count}
            </Badge>
          )}
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link href={href}>
            {linkLabel}
            <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}

/** Uniform placeholder rows so a panel does not resize when its data lands. */
function RowSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-md" />
      ))}
    </div>
  );
}

interface DashboardData {
  companyStats: Awaited<ReturnType<typeof companyService.getStatistics>>;
  oppStats: Awaited<ReturnType<typeof opportunityService.getStatistics>>;
  companies: Company[];
  ndas: NDA[];
  samples: SampleRequest[];
  dueToday: Task[];
  overdueTasks: Task[];
  meetings: Meeting[];
  registrations: Registration[];
  recentActivity: Activity[];
}

/* ───────────────────────────── page ───────────────────────────── */

function StandardOverview({ showRegistrations }: { showRegistrations: boolean }) {
  const t = useTranslations('Overview');
  const locale = useLocale() as Locale;
  const { account } = useSession();
  const [data, setData] = React.useState<DashboardData | null>(null);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      companyService.getStatistics(),
      opportunityService.getStatistics(),
      companyService.list(),
      ndaService.list(),
      sampleService.list(),
      taskService.dueToday(),
      taskService.overdue(),
      meetingService.upcoming(),
      showRegistrations ? registrationService.list() : Promise.resolve<Registration[]>([]),
      activityService.recent(8),
    ]).then(
      ([
        companyStats,
        oppStats,
        companies,
        ndas,
        samples,
        dueToday,
        overdueTasks,
        meetings,
        registrations,
        recentActivity,
      ]) => {
        if (!active) return;
        setData({
          companyStats,
          oppStats,
          companies,
          ndas,
          samples,
          dueToday,
          overdueTasks,
          meetings,
          registrations,
          recentActivity,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [showRegistrations]);

  const loading = data === null;

  /* ── derived (memoised) ── */

  /** Company lookup so every row can show a logo and a name without a second query. */
  const companyById = React.useMemo(
    () => new Map((data?.companies ?? []).map((c) => [c.id, c])),
    [data],
  );

  const companyName = React.useCallback(
    (id: string | undefined) => {
      if (!id) return null;
      const c = companyById.get(id);
      return c ? c.tradingName ?? c.legalName : null;
    },
    [companyById],
  );

  /**
   * NDAs still in flight. Counted off the *register* — one current row per
   * company via `currentNdasOf` — never off the `Company.ndaStatus` cache, which
   * is what let the companies strip and the NDA register disagree (lib/nda-stats.ts).
   * The status set is the same one `COMPANY_VIEWS.ndaPending` filters on, imported
   * rather than restated. Oldest first: the stalest paper is the one to chase.
   */
  const pendingNdas = React.useMemo(() => {
    if (!data) return [];
    return currentNdasOf(data.ndas)
      .filter((n) => NDA_PENDING.includes(n.status))
      .sort(
        (a, b) =>
          new Date(a.dateSent ?? a.createdAt).getTime() - new Date(b.dateSent ?? b.createdAt).getTime(),
      );
  }, [data]);

  const samplesAwaitingFeedback = React.useMemo(() => {
    if (!data) return [];
    return data.samples
      .filter((s) => SAMPLE_AWAITING_FEEDBACK.includes(s.status))
      .sort((a, b) => new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime());
  }, [data]);

  const pendingRegistrations = React.useMemo(() => {
    if (!data) return [];
    return data.registrations.filter((r) => REGISTRATION_PENDING.includes(r.status));
  }, [data]);

  /**
   * Overdue first, then today's — the order you would work them in — and capped
   * like every other list on this page. A team carrying sixty overdue tasks
   * would otherwise push Needs Attention, Pipeline and Recent activity off the
   * screen behind exactly the wall of equal-weight rows this page removes;
   * `myTaskCount` keeps the badge honest about how many there really are.
   */
  const myTaskCount = React.useMemo(
    () => (data ? data.overdueTasks.length + data.dueToday.length : 0),
    [data],
  );

  const myTasks = React.useMemo(() => {
    if (!data) return [];
    return [...data.overdueTasks, ...data.dueToday].slice(0, MY_DAY_ROWS);
  }, [data]);

  const nextMeetings = React.useMemo(() => (data ? data.meetings.slice(0, 3) : []), [data]);

  /**
   * The pipeline as one bar, folded into the six fixed phases of
   * `lib/pipeline-phases.ts` — see that module for why fixed buckets beat
   * top-N-by-volume here. Colours are Tailwind classes rather than inline hex so
   * each band can carry its own dark-mode value: the palette's first entry is
   * brand navy (#0a1628), which on the dark card sits at roughly 1.2:1 and would
   * render the largest band as a hole in the graphic.
   */
  const pipelineSegments = React.useMemo(() => {
    if (!data) return [];
    return tallyPipelinePhases(data.oppStats.byStage).map((phase) => ({
      key: phase.key,
      label: t(phase.labelKey),
      count: phase.count,
      color: PIPELINE_PHASE_COLOR[phase.key] ?? 'bg-muted-foreground',
      stages: phase.stages.map((s) => getLabel('pipelineStage', s)).join(' · '),
    }));
  }, [data, t]);

  const greeting = account?.firstName ? t('welcomeNamed', { name: account.firstName }) : t('title');

  const timeOf = React.useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso)),
    [locale],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* One stagger container for the whole page: sections enter in order, 60ms
          apart, and framer-motion's app-level `reducedMotion="user"` (see
          app/[locale]/layout.tsx) turns it into a plain render for anyone who
          asked their OS for less motion. */}
      <Stagger className="space-y-6">
        {/* ── 1. HEADER ── */}
        <StaggerItem>
          <PageHeader title={greeting} subtitle={formatDate(new Date().toISOString(), locale)} />
        </StaggerItem>

        {/* ── 2. KPI ROW — four numbers, each a door into its module ── */}
        <StaggerItem>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-lg" />)
            ) : (
              <>
                <KpiCard
                  label={t('kpiTotalCompanies')}
                  value={data.companyStats.total}
                  icon={Building2}
                  tint="companies"
                  href="/admin/companies"
                />
                <KpiCard
                  label={t('kpiActiveOpportunities')}
                  value={data.oppStats.open}
                  icon={Target}
                  tint="pipeline"
                  href="/admin/pipeline"
                />
                <KpiCard
                  label={t('kpiNdasAwaitingAction')}
                  value={pendingNdas.length}
                  icon={FileSignature}
                  tint="ndas"
                  href="/admin/ndas"
                />
                <KpiCard
                  label={t('kpiSamplesAwaitingFeedback')}
                  value={samplesAwaitingFeedback.length}
                  icon={FlaskConical}
                  tint="samples"
                  href="/admin/samples"
                />
              </>
            )}
          </div>
        </StaggerItem>

        {/* ── 3. MY DAY ── */}
        <StaggerItem>
          <section aria-labelledby="overview-my-day" className="space-y-3">
            <h2 id="overview-my-day" className="font-display text-lg font-semibold tracking-tight">
              {t('myDay')}
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Panel title={t('tasksToday')} count={myTaskCount} href="/admin/tasks" linkLabel={t('viewAll')}>
                {loading ? (
                  <RowSkeleton />
                ) : myTasks.length === 0 ? (
                  <EmptyState title={t('noTasksToday')} className="py-8" />
                ) : (
                  <ul className="space-y-2">
                    {myTasks.map((task) => {
                      const overdue = data.overdueTasks.includes(task);
                      const name = companyName(task.companyId);
                      return (
                        <li key={task.id}>
                          <Link
                            href="/admin/tasks"
                            className="flex items-center gap-2.5 rounded-md border bg-card p-2.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span
                              className={cn('h-2 w-2 shrink-0 rounded-full', TONE_DOT[getTone('taskStatus', task.status)])}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground" title={task.title}>
                                {task.title}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {name ?? getLabel('taskType', task.type)}
                              </span>
                            </span>
                            <span
                              className={cn(
                                'shrink-0 text-xs tabular',
                                overdue ? 'font-medium text-danger-text' : 'text-muted-foreground',
                              )}
                            >
                              {overdue
                                ? t('overdueOn', { date: formatDate(task.dueDate, locale) })
                                : t('today')}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              <Panel title={t('nextMeetings')} href="/admin/calendar" linkLabel={t('viewCalendar')}>
                {loading ? (
                  <RowSkeleton rows={3} />
                ) : nextMeetings.length === 0 ? (
                  <EmptyState title={t('noMeetings')} className="py-8" />
                ) : (
                  <ul className="space-y-2">
                    {nextMeetings.map((m) => {
                      const name = companyName(m.companyId);
                      return (
                        <li key={m.id}>
                          <Link
                            href="/admin/calendar"
                            className="flex items-center gap-3 rounded-md border bg-card p-2.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="flex w-16 shrink-0 flex-col items-center rounded-md bg-muted px-1.5 py-1">
                              <span className="text-2xs text-muted-foreground">{formatDate(m.start, locale)}</span>
                              <span className="text-sm font-semibold tabular leading-tight text-foreground">
                                {timeOf(m.start)}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground" title={m.title}>
                                {m.title}
                              </span>
                              {name && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{name}</span>}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>
          </section>
        </StaggerItem>

        {/* ── 4. NEEDS ATTENTION ── */}
        <StaggerItem>
          <section aria-labelledby="overview-needs-attention" className="space-y-3">
            <h2 id="overview-needs-attention" className="font-display text-lg font-semibold tracking-tight">
              {t('needsAttention')}
            </h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title={t('ndasPending')} count={pendingNdas.length} href="/admin/ndas" linkLabel={t('viewAll')}>
                {loading ? (
                  <RowSkeleton />
                ) : pendingNdas.length === 0 ? (
                  <EmptyState title={t('noNdasPending')} className="py-8" />
                ) : (
                  <ul className="space-y-2">
                    {pendingNdas.slice(0, ATTENTION_ROWS).map((n) => {
                      const company = n.companyId ? companyById.get(n.companyId) : undefined;
                      return (
                        <li key={n.id}>
                          <Link
                            href={`/admin/ndas?detail=${encodeURIComponent(n.id)}`}
                            className="flex items-center gap-2.5 rounded-md border bg-card p-2.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {company && <CompanyLogo company={company} size="sm" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {company ? company.tradingName ?? company.legalName : n.reference}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.reference}</span>
                            </span>
                            <StatusBadge kind="ndaStatus" value={n.status} className="shrink-0" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              <Panel
                title={t('samplesAwaitingFeedback')}
                count={samplesAwaitingFeedback.length}
                href="/admin/samples"
                linkLabel={t('viewAll')}
              >
                {loading ? (
                  <RowSkeleton />
                ) : samplesAwaitingFeedback.length === 0 ? (
                  <EmptyState title={t('noSamplesAwaitingFeedback')} className="py-8" />
                ) : (
                  <ul className="space-y-2">
                    {samplesAwaitingFeedback.slice(0, ATTENTION_ROWS).map((s) => {
                      const company = companyById.get(s.companyId);
                      return (
                        <li key={s.id}>
                          <Link
                            href="/admin/samples"
                            className="flex items-center gap-2.5 rounded-md border bg-card p-2.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {company && <CompanyLogo company={company} size="sm" />}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {company ? company.tradingName ?? company.legalName : s.reference}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground" title={s.requestedProduct}>
                                {s.requestedProduct}
                              </span>
                            </span>
                            <StatusBadge kind="sampleStatus" value={s.status} className="shrink-0" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              <Panel
                title={t('overdueTasks')}
                count={data?.overdueTasks.length ?? 0}
                href="/admin/tasks"
                linkLabel={t('viewAll')}
              >
                {loading ? (
                  <RowSkeleton />
                ) : data.overdueTasks.length === 0 ? (
                  <EmptyState title={t('noOverdueTasks')} className="py-8" />
                ) : (
                  <ul className="space-y-2">
                    {data.overdueTasks.slice(0, ATTENTION_ROWS).map((task) => {
                      const name = companyName(task.companyId);
                      const overdueDays = daysUntil(task.dueDate);
                      return (
                        <li key={task.id}>
                          <Link
                            href="/admin/tasks"
                            className="flex items-center gap-2.5 rounded-md border border-danger/30 bg-danger-subtle p-2.5 transition-colors duration-150 hover:bg-danger-subtle/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <AlertTriangle className="h-4 w-4 shrink-0 text-danger-text" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground" title={task.title}>
                                {task.title}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {name ?? getLabel('taskType', task.type)}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-medium tabular text-danger-text">
                              {overdueDays != null && overdueDays < 0
                                ? t('overdueByDays', { count: Math.abs(overdueDays) })
                                : t('overdue')}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              {showRegistrations && (
                <Panel
                  title={t('registrationsToReview')}
                  count={pendingRegistrations.length}
                  href="/admin/registrations"
                  linkLabel={t('viewAll')}
                >
                  {loading ? (
                    <RowSkeleton />
                  ) : pendingRegistrations.length === 0 ? (
                    <EmptyState title={t('noRegistrationsToReview')} className="py-8" />
                  ) : (
                    <ul className="space-y-2">
                      {pendingRegistrations.slice(0, ATTENTION_ROWS).map((r) => (
                        <li key={r.id}>
                          <Link
                            href="/admin/registrations"
                            className="flex items-center gap-2.5 rounded-md border bg-card p-2.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {r.tradingName ?? r.legalName}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{r.reference}</span>
                            </span>
                            <StatusBadge kind="registrationStatus" value={r.status} className="shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )}

              {/* Self-handles mock mode (it reads real inbound mail), exactly as the
                  tasks page mounts it. */}
              <FollowUpPanel />
            </div>
          </section>
        </StaggerItem>

        {/* ── 5. PIPELINE MINI ── */}
        <StaggerItem>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="min-w-0">
                <CardTitle className="text-base">{t('pipeline')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t('pipelineDescription')}</p>
              </div>
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link href="/admin/pipeline">
                  {t('viewPipeline')}
                  <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-3 w-full rounded-full" />
                  <Skeleton className="h-6 w-2/3 rounded-md" />
                </div>
              ) : pipelineSegments.length === 0 ? (
                <EmptyState title={t('noOpportunities')} className="py-8" />
              ) : (
                <Link
                  href="/admin/pipeline"
                  className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {/* Segment widths are flex-grow weights, so a phase with one
                      opportunity still gets its 8px band instead of vanishing. */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                    {pipelineSegments.map((s) => (
                      <span
                        key={s.key}
                        className={cn('h-full', s.color)}
                        style={{ flex: `${s.count} 1 0%`, minWidth: '8px' }}
                      />
                    ))}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                    {pipelineSegments.map((s) => (
                      <li
                        key={s.key}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground"
                        title={s.stages}
                      >
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', s.color)} aria-hidden />
                        <span className="text-foreground">{s.label}</span>
                        <span className="tabular">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                </Link>
              )}
            </CardContent>
          </Card>
        </StaggerItem>

        {/* ── 6. RECENT ACTIVITY ── */}
        <StaggerItem>
          <Panel title={t('recentActivity')} href="/admin/activities" linkLabel={t('viewAll')}>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : data.recentActivity.length === 0 ? (
              <EmptyState title={t('noRecentActivity')} className="py-8" />
            ) : (
              <ol className="relative space-y-4 before:absolute before:left-4 before:top-1 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
                {data.recentActivity.slice(0, 8).map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] ?? StickyNote;
                  return (
                    <li key={a.id} className="relative flex gap-3 pl-0">
                      <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground" title={a.title}>
                          {a.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge kind="activityType" value={a.type} />
                          <span className="text-xs text-muted-foreground">{formatRelative(a.at, locale)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </StaggerItem>
      </Stagger>
    </div>
  );
}

/* Amine Abidi gets a bespoke animated command center; everyone else the standard overview. */
const AMINE_EMAIL = 'labidimedamine53@gmail.com';

export default function OverviewPage() {
  const { account, ready } = useSession();
  if (!ready) return null;
  if (account?.email?.toLowerCase() === AMINE_EMAIL) {
    return <OperationalOverviewDashboard />;
  }
  return <StandardOverview showRegistrations={Boolean(account && canView(account.role, 'registrations'))} />;
}
