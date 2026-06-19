'use client';

import * as React from 'react';
import {
  Building2,
  Target,
  FileSignature,
  FlaskConical,
  PackageCheck,
  Truck,
  AlertTriangle,
  UserPlus,
  Download,
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
  Clock,
  PackageX,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { Stagger, StaggerItem } from '@/components/shared/motion';
import {
  ChartCard,
  TrendChart,
  CategoryBar,
  DonutChart,
  FunnelChartCard,
  CHART_COLORS,
} from '@/components/charts/chart-kit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Link } from '@/lib/i18n/navigation';
import {
  companyService,
  opportunityService,
  ndaService,
  sampleService,
  shipmentService,
  taskService,
  registrationService,
  activityService,
  analyticsService,
  authService,
} from '@/lib/mock-services';
import { getLabel, humanize } from '@/lib/labels';
import { formatRelative, formatDate, daysUntil } from '@/lib/formatting';
import { cn, initials } from '@/lib/utils';
import type {
  Activity,
  ActivityType,
  Task,
  Company,
  Shipment,
  NDA,
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

function ownerName(id?: string): string {
  if (!id) return 'Unassigned';
  const acc = authService.getAccount(id);
  return acc ? `${acc.firstName} ${acc.lastName}` : humanize(id.replace(/^u_/, ''));
}

interface DashboardData {
  companyStats: Awaited<ReturnType<typeof companyService.getStatistics>>;
  oppStats: Awaited<ReturnType<typeof opportunityService.getStatistics>>;
  ndaStats: Awaited<ReturnType<typeof ndaService.getStatistics>>;
  sampleStats: Awaited<ReturnType<typeof sampleService.getStatistics>>;
  shipmentStats: Awaited<ReturnType<typeof shipmentService.getStatistics>>;
  taskStats: Awaited<ReturnType<typeof taskService.getStatistics>>;
  regStats: Awaited<ReturnType<typeof registrationService.getStatistics>>;
  companiesOverTime: Awaited<ReturnType<typeof analyticsService.companiesOverTime>>;
  companiesByCategory: Awaited<ReturnType<typeof analyticsService.companiesByCategory>>;
  pipelineDistribution: Awaited<ReturnType<typeof analyticsService.pipelineDistribution>>;
  sampleFunnel: Awaited<ReturnType<typeof analyticsService.sampleFunnel>>;
  ndaFunnel: Awaited<ReturnType<typeof analyticsService.ndaFunnel>>;
  shipmentBreakdown: Awaited<ReturnType<typeof analyticsService.shipmentStatusBreakdown>>;
  teamActivity: Awaited<ReturnType<typeof analyticsService.teamActivity>>;
  recentActivity: Activity[];
  upcomingTasks: Task[];
  overdueTasks: Task[];
  companies: Company[];
  shipments: Shipment[];
  ndas: NDA[];
}

const RANGE_DAYS: Record<string, number | null> = {
  '30': 30,
  '90': 90,
  '180': 180,
  all: null,
};

/* ───────────────────────────── page ───────────────────────────── */

export default function OverviewPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [range, setRange] = React.useState<string>('180');

  React.useEffect(() => {
    let active = true;
    Promise.all([
      companyService.getStatistics(),
      opportunityService.getStatistics(),
      ndaService.getStatistics(),
      sampleService.getStatistics(),
      shipmentService.getStatistics(),
      taskService.getStatistics(),
      registrationService.getStatistics(),
      analyticsService.companiesOverTime(),
      analyticsService.companiesByCategory(),
      analyticsService.pipelineDistribution(),
      analyticsService.sampleFunnel(),
      analyticsService.ndaFunnel(),
      analyticsService.shipmentStatusBreakdown(),
      analyticsService.teamActivity(),
      activityService.recent(8),
      taskService.upcoming(),
      taskService.overdue(),
      companyService.list(),
      shipmentService.list(),
      ndaService.list(),
    ]).then(
      ([
        companyStats,
        oppStats,
        ndaStats,
        sampleStats,
        shipmentStats,
        taskStats,
        regStats,
        companiesOverTime,
        companiesByCategory,
        pipelineDistribution,
        sampleFunnel,
        ndaFunnel,
        shipmentBreakdown,
        teamActivity,
        recentActivity,
        upcomingTasks,
        overdueTasks,
        companies,
        shipments,
        ndas,
      ]) => {
        if (!active) return;
        setData({
          companyStats,
          oppStats,
          ndaStats,
          sampleStats,
          shipmentStats,
          taskStats,
          regStats,
          companiesOverTime,
          companiesByCategory,
          pipelineDistribution,
          sampleFunnel,
          ndaFunnel,
          shipmentBreakdown,
          teamActivity,
          recentActivity,
          upcomingTasks,
          overdueTasks,
          companies,
          shipments,
          ndas,
        });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const loading = data === null;

  /* ── derived (memoised) ── */
  const trendData = React.useMemo(() => {
    if (!data) return [];
    const n = RANGE_DAYS[range];
    if (n == null) return data.companiesOverTime;
    const months = Math.max(1, Math.round(n / 30));
    return data.companiesOverTime.slice(-months);
  }, [data, range]);

  const categoryData = React.useMemo(
    () => (data ? data.companiesByCategory.slice(0, 7).map((d) => ({ name: getLabel('companyType', d.type), count: d.count })) : []),
    [data],
  );

  const pipelineDonut = React.useMemo(
    () =>
      data
        ? data.pipelineDistribution
            .slice(0, 6)
            .map((d, i) => ({ name: getLabel('relationshipStage', d.stage), value: d.count, color: CHART_COLORS[i % CHART_COLORS.length] }))
        : [],
    [data],
  );

  const shipmentDonut = React.useMemo(
    () => (data ? data.shipmentBreakdown.map((d, i) => ({ name: d.name, value: d.value, color: CHART_COLORS[i % CHART_COLORS.length] })) : []),
    [data],
  );

  const recentCompanies = React.useMemo(() => {
    if (!data) return [];
    return [...data.companies]
      .filter((c) => c.lastActivityAt)
      .sort((a, b) => new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime())
      .slice(0, 6);
  }, [data]);

  const alerts = React.useMemo(() => {
    if (!data) return [];
    const rows: { id: string; tone: 'danger' | 'warning' | 'info'; icon: LucideIcon; title: string; meta: string; href: string }[] = [];
    for (const t of data.overdueTasks.slice(0, 4)) {
      const d = daysUntil(t.dueDate);
      rows.push({
        id: `task-${t.id}`,
        tone: 'danger',
        icon: Clock,
        title: t.title,
        meta: d != null ? `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}` : 'Overdue',
        href: '/admin/tasks',
      });
    }
    for (const s of data.shipments.filter((x) => x.isDelayed && !x.actualDelivery).slice(0, 3)) {
      rows.push({
        id: `ship-${s.id}`,
        tone: 'warning',
        icon: PackageX,
        title: `${s.reference} delayed`,
        meta: `${s.courier ?? 'Courier'} · ${s.recipient}`,
        href: '/admin/shipments',
      });
    }
    const expiring = data.ndas
      .filter((n) => {
        if (!n.expiryDate || n.status !== 'fully_signed') return false;
        const d = daysUntil(n.expiryDate);
        return d != null && d >= 0 && d <= 60;
      })
      .slice(0, 3);
    for (const n of expiring) {
      const d = daysUntil(n.expiryDate);
      rows.push({
        id: `nda-${n.id}`,
        tone: 'info',
        icon: CalendarClock,
        title: `${n.reference} expiring soon`,
        meta: d != null ? `Expires in ${d} day${d === 1 ? '' : 's'}` : 'Expiring',
        href: '/admin/ndas',
      });
    }
    return rows.slice(0, 8);
  }, [data]);

  const maxTeamTasks = React.useMemo(
    () => (data ? Math.max(1, ...data.teamActivity.slice(0, 6).map((t) => t.tasks)) : 1),
    [data],
  );

  /* ── header actions ── */
  const headerActions = (
    <div className="flex items-center gap-2">
      <Select value={range} onValueChange={setRange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
          <SelectItem value="180">Last 180 days</SelectItem>
          <SelectItem value="all">All time</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="gold" onClick={() => toast({ title: 'Report exported', description: 'Your overview snapshot has been generated.', variant: 'success' })}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Overview"
        subtitle="Your operational snapshot across the Proamina® pipeline."
        actions={headerActions}
      />

      {/* ── KPI ROW ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-lg" />
          ))}
        </div>
      ) : (
        <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StaggerItem>
            <StatCard label="Total companies" value={data.companyStats.total} icon={Building2} tone="gold" trend={{ value: 8, label: 'vs last period' }} href="/admin/companies" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Active opportunities" value={data.oppStats.open} icon={Target} tone="info" trend={{ value: 12, label: 'vs last period' }} href="/admin/pipeline" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="NDAs awaiting signature" value={data.ndaStats.awaitingSignature} icon={FileSignature} tone="warning" trend={{ value: -4, label: 'vs last period' }} href="/admin/ndas" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Samples to prepare" value={data.sampleStats.preparing} icon={FlaskConical} tone="default" trend={{ value: 6, label: 'vs last period' }} href="/admin/samples" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Samples shipped" value={data.sampleStats.shipped} icon={PackageCheck} tone="info" trend={{ value: 9, label: 'vs last period' }} href="/admin/samples" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Deliveries in transit" value={data.shipmentStats.inTransit} icon={Truck} tone="info" trend={{ value: 3, label: 'vs last period' }} href="/admin/shipments" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Overdue tasks" value={data.taskStats.overdue} icon={AlertTriangle} tone="danger" trend={{ value: -7, label: 'vs last period' }} href="/admin/tasks" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="New registrations" value={data.regStats.pending} icon={UserPlus} tone="success" trend={{ value: 15, label: 'vs last period' }} href="/admin/registrations" />
          </StaggerItem>
        </Stagger>
      )}

      {/* ── CHARTS GRID ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Company acquisition"
          description="New vs cumulative companies over time"
          loading={loading}
          isEmpty={!loading && trendData.length === 0}
          action={<Badge variant="muted">{range === 'all' ? 'All time' : `${range}d`}</Badge>}
        >
          <TrendChart
            data={trendData}
            xKey="label"
            series={[
              { key: 'cumulative', name: 'Cumulative', type: 'area', color: CHART_COLORS[0] },
              { key: 'count', name: 'New', type: 'area', color: CHART_COLORS[1] },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Companies by type"
          description="Distribution across business categories"
          loading={loading}
          isEmpty={!loading && categoryData.length === 0}
        >
          <CategoryBar data={categoryData} xKey="name" barKey="count" horizontal color={CHART_COLORS[2]} name="Companies" />
        </ChartCard>

        <ChartCard
          title="Pipeline distribution"
          description="Companies by relationship stage"
          loading={loading}
          isEmpty={!loading && pipelineDonut.length === 0}
        >
          <DonutChart data={pipelineDonut} centerLabel="companies" />
        </ChartCard>

        <ChartCard
          title="Sample funnel"
          description="From request through to feedback"
          loading={loading}
          isEmpty={!loading && (data?.sampleFunnel.length ?? 0) === 0}
        >
          {data && <FunnelChartCard data={data.sampleFunnel} />}
        </ChartCard>
      </div>

      {/* ── CONVERSION + SHIPMENT BREAKDOWN ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="NDA conversion funnel"
          description="Prepared → sent → signed"
          loading={loading}
          isEmpty={!loading && (data?.ndaFunnel.length ?? 0) === 0}
        >
          {data && <FunnelChartCard data={data.ndaFunnel} />}
        </ChartCard>

        <ChartCard
          title="Shipment status breakdown"
          description="Current logistics pipeline"
          loading={loading}
          isEmpty={!loading && shipmentDonut.length === 0}
        >
          <DonutChart data={shipmentDonut} centerLabel="shipments" />
        </ChartCard>
      </div>

      {/* ── BOTTOM GRID: activity / tasks / alerts ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent activity</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/activities">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
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
              <p className="py-8 text-center text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              <ol className="relative space-y-4 before:absolute before:left-4 before:top-1 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
                {data.recentActivity.map((a) => {
                  const Icon = ACTIVITY_ICONS[a.type] ?? StickyNote;
                  return (
                    <li key={a.id} className="relative flex gap-3 pl-0">
                      <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{a.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <StatusBadge kind="activityType" value={a.type} />
                          <span className="text-xs text-muted-foreground">{formatRelative(a.at)}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Upcoming tasks */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming tasks</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/tasks">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : data.upcomingTasks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No upcoming tasks.</p>
            ) : (
              <ul className="space-y-2">
                {data.upcomingTasks.slice(0, 6).map((t) => {
                  const company = data.companies.find((c) => c.id === t.companyId);
                  return (
                    <li key={t.id}>
                      <Link
                        href="/admin/tasks"
                        className="flex items-start gap-3 rounded-md border bg-card p-2.5 transition-colors hover:bg-muted/60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {company ? company.tradingName ?? company.legalName : getLabel('taskType', t.type)}
                            {t.dueDate && <span> · due {formatDate(t.dueDate)}</span>}
                          </p>
                        </div>
                        <PriorityBadge value={t.priority} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Urgent alerts */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Urgent alerts</CardTitle>
            {!loading && alerts.length > 0 && <Badge variant="danger">{alerts.length}</Badge>}
          </CardHeader>
          <CardContent className="flex-1">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-md" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-8 text-center">
                <ShieldCheck className="h-8 w-8 text-success" />
                <p className="text-sm text-muted-foreground">All clear — nothing urgent.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {alerts.map((al) => {
                  const Icon = al.icon;
                  return (
                    <li key={al.id}>
                      <Link
                        href={al.href}
                        className={cn(
                          'flex items-start gap-3 rounded-md border p-2.5 transition-colors',
                          al.tone === 'danger' && 'border-danger/30 bg-danger-subtle hover:bg-danger-subtle/80',
                          al.tone === 'warning' && 'border-warning/30 bg-warning-subtle hover:bg-warning-subtle/80',
                          al.tone === 'info' && 'border-info/30 bg-info-subtle hover:bg-info-subtle/80',
                        )}
                      >
                        <Icon
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            al.tone === 'danger' && 'text-danger',
                            al.tone === 'warning' && 'text-warning-foreground',
                            al.tone === 'info' && 'text-info',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{al.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{al.meta}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── RECENTLY CONTACTED + TEAM WORKLOAD ── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recently contacted companies */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recently contacted companies</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/companies">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : recentCompanies.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="hidden sm:table-cell">Owner</TableHead>
                    <TableHead className="text-right">Last activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCompanies.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => {
                        window.location.assign(`./companies/${c.id}`);
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-2xs font-semibold text-white"
                            style={{ backgroundColor: c.accentColor ?? CHART_COLORS[0] }}
                          >
                            {c.initials}
                          </span>
                          <span className="truncate font-medium text-foreground">{c.tradingName ?? c.legalName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="relationshipStage" value={c.relationshipStage} />
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{ownerName(c.accountOwnerId)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">{formatRelative(c.lastActivityAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Team workload */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Team workload</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/analytics">
                Details <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-4">
                {data.teamActivity.slice(0, 6).map((m) => (
                  <li key={m.userId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 text-2xs font-semibold text-brand-navy">
                          {initials(m.name)}
                        </span>
                        <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                      </div>
                      <span className="shrink-0 text-xs tabular text-muted-foreground">
                        {m.tasks} task{m.tasks === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Progress value={(m.tasks / maxTeamTasks) * 100} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
