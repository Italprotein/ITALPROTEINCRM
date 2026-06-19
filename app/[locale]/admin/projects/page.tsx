'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import {
  FlaskConical,
  Rocket,
  Activity as ActivityIcon,
  PauseCircle,
  MoreHorizontal,
  Eye,
  ChevronRight,
  Target,
  Globe2,
  Repeat,
  FlaskRound,
  ArrowRight,
  CalendarClock,
  X,
} from 'lucide-react';

import { projectService, companyService, sampleService } from '@/lib/mock-services';
import { authService } from '@/lib/mock-services/authService';
import type {
  ApplicationProject,
  Company,
  SampleRequest,
  ApplicationCategory,
  DevelopmentStage,
  Locale,
} from '@/lib/types';
import { APPLICATION_CATEGORIES } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, formatQuantity, flagEmoji } from '@/lib/formatting';
import { initials } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard, CategoryBar, DonutChart, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Constants ────────────────────────────── */

const ALL = '__all__';
const TODAY = '2026-06-18';

/** Ordered development lifecycle — drives both progress mapping and the bar chart. */
const STAGE_ORDER: DevelopmentStage[] = [
  'concept',
  'feasibility',
  'prototype',
  'pilot',
  'pre_industrial',
  'industrial',
  'launched',
];

/** Map a development stage to a percentage for the progress bar. */
const STAGE_PROGRESS: Record<DevelopmentStage, number> = {
  concept: 10,
  feasibility: 25,
  prototype: 45,
  pilot: 60,
  pre_industrial: 80,
  industrial: 92,
  launched: 100,
  on_hold: 50,
};

/** Next forward stage (skips terminal on_hold). */
function nextStage(stage: DevelopmentStage): DevelopmentStage | null {
  if (stage === 'on_hold') return 'pilot';
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function ownerName(id?: string): string {
  if (!id) return 'Unassigned';
  const a = authService.getAccount(id);
  return a ? `${a.firstName} ${a.lastName}` : 'Unassigned';
}

type Stats = Awaited<ReturnType<typeof projectService.getStatistics>>;

/* ────────────────────────────── Page ────────────────────────────── */

export default function ProjectsPage() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [rows, setRows] = React.useState<ApplicationProject[] | null>(null);
  const [companies, setCompanies] = React.useState<Map<string, Company>>(new Map());
  const [stats, setStats] = React.useState<Stats | null>(null);

  const [detail, setDetail] = React.useState<ApplicationProject | null>(null);
  const [sample, setSample] = React.useState<SampleRequest | null>(null);

  const [fStage, setFStage] = React.useState<string>(ALL);
  const [fCategory, setFCategory] = React.useState<string>(ALL);

  React.useEffect(() => {
    projectService.list().then(setRows);
    projectService.getStatistics().then(setStats);
    companyService.list().then((cs) => setCompanies(new Map(cs.map((c) => [c.id, c]))));
  }, []);

  // Resolve the linked sample whenever the detail sheet opens.
  React.useEffect(() => {
    setSample(null);
    if (detail?.sampleRequestId) {
      sampleService.getById(detail.sampleRequestId).then((s) => setSample(s ?? null));
    }
  }, [detail]);

  const companyName = React.useCallback(
    (id: string) => {
      const c = companies.get(id);
      return c ? c.tradingName || c.legalName : '—';
    },
    [companies],
  );

  /* ── filtered data ── */
  const filtered = React.useMemo(() => {
    let data = rows ?? [];
    if (fStage !== ALL) data = data.filter((p) => p.developmentStage === fStage);
    if (fCategory !== ALL) data = data.filter((p) => p.category === fCategory);
    return data;
  }, [rows, fStage, fCategory]);

  const activeFilters = (fStage !== ALL ? 1 : 0) + (fCategory !== ALL ? 1 : 0);

  const resetFilters = () => {
    setFStage(ALL);
    setFCategory(ALL);
  };

  /* ── derived filter options ── */
  const stageOptions = React.useMemo(() => {
    const present = new Set((rows ?? []).map((p) => p.developmentStage));
    return [...STAGE_ORDER, 'on_hold' as DevelopmentStage].filter((s) => present.has(s));
  }, [rows]);

  const categoryOptions = React.useMemo(() => {
    const present = new Set((rows ?? []).map((p) => p.category));
    return APPLICATION_CATEGORIES.filter((c) => present.has(c));
  }, [rows]);

  /* ── chart data ── */
  const stageChart = React.useMemo(() => {
    const byStage = stats?.byStage ?? ({} as Record<DevelopmentStage, number>);
    return [...STAGE_ORDER, 'on_hold' as DevelopmentStage]
      .map((stage) => ({ stage: getLabel('developmentStage', stage), count: byStage[stage] ?? 0 }))
      .filter((d) => d.count > 0);
  }, [stats]);

  const categoryChart = React.useMemo(() => {
    const map = new Map<ApplicationCategory, number>();
    for (const p of rows ?? []) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, value], i) => ({
        name: getLabel('applicationCategory', cat),
        value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [rows]);

  const onHold = React.useMemo(
    () => (stats?.byStage?.on_hold ?? 0),
    [stats],
  );

  /* ── mutations (mock) ── */
  function advance(p: ApplicationProject) {
    const next = nextStage(p.developmentStage);
    if (!next) {
      toast({
        variant: 'info',
        title: 'No further stage',
        description: `${p.name} is already at ${getLabel('developmentStage', p.developmentStage)}.`,
      });
      return;
    }
    setRows((prev) =>
      prev ? prev.map((r) => (r.id === p.id ? { ...r, developmentStage: next, updatedAt: TODAY } : r)) : prev,
    );
    if (detail?.id === p.id) setDetail({ ...detail, developmentStage: next, updatedAt: TODAY });
    void projectService.update(p.id, { developmentStage: next, updatedAt: TODAY });
    void projectService.getStatistics().then(setStats);
    toast({
      variant: 'success',
      title: 'Stage advanced',
      description: `${p.name} → ${getLabel('developmentStage', next)}.`,
    });
  }

  /* ── table columns ── */
  const columns: Column<ApplicationProject>[] = [
    {
      key: 'name',
      header: 'Project',
      sortValue: (p) => p.name,
      cell: (p) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
          {p.brandName ? <p className="truncate text-xs text-muted-foreground">{p.brandName}</p> : null}
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      sortValue: (p) => companyName(p.companyId),
      cell: (p) => {
        const c = companies.get(p.companyId);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (c) router.push('/admin/companies/' + c.id);
            }}
            className="flex items-center gap-2 text-left hover:underline"
          >
            {c ? <span className="text-base leading-none">{flagEmoji(c.countryCode)}</span> : null}
            <span className="truncate text-sm font-medium text-foreground">{companyName(p.companyId)}</span>
          </button>
        );
      },
    },
    {
      key: 'category',
      header: 'Category',
      sortValue: (p) => getLabel('applicationCategory', p.category),
      cell: (p) => <StatusBadge kind="applicationCategory" value={p.category} />,
      hideable: true,
    },
    {
      key: 'devStage',
      header: 'Dev stage',
      sortValue: (p) => STAGE_PROGRESS[p.developmentStage] ?? 0,
      cell: (p) => <StatusBadge kind="developmentStage" value={p.developmentStage} />,
    },
    {
      key: 'testStage',
      header: 'Test stage',
      sortValue: (p) => getLabel('testStage', p.testStage ?? 'not_started'),
      cell: (p) => <StatusBadge kind="testStage" value={p.testStage ?? 'not_started'} />,
      hideable: true,
    },
    {
      key: 'progress',
      header: 'Progress',
      sortValue: (p) => STAGE_PROGRESS[p.developmentStage] ?? 0,
      cell: (p) => {
        const v = STAGE_PROGRESS[p.developmentStage] ?? 0;
        return (
          <div className="flex items-center gap-2">
            <Progress
              value={v}
              className="w-20"
              indicatorClassName={p.developmentStage === 'on_hold' ? 'bg-warning' : undefined}
            />
            <span className="w-9 text-right text-xs tabular text-muted-foreground">{v}%</span>
          </div>
        );
      },
      hideable: true,
    },
    {
      key: 'launch',
      header: 'Est. launch',
      align: 'right',
      sortable: true,
      sortValue: (p) => (p.estimatedLaunch ? new Date(p.estimatedLaunch).getTime() : 0),
      cell: (p) =>
        p.estimatedLaunch ? (
          <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(p.estimatedLaunch, locale)}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      hideable: true,
    },
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (p) => ownerName(p.internalOwnerId),
      cell: (p) => {
        const name = ownerName(p.internalOwnerId);
        return (
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 text-2xs font-semibold text-brand-navy">
              {initials(name)}
            </span>
            <span className="text-sm">{name}</span>
          </span>
        );
      },
      hideable: true,
    },
  ];

  /* ── toolbar (filters) ── */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fStage} onValueChange={setFStage}>
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Dev stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All stages</SelectItem>
          {stageOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {getLabel('developmentStage', s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fCategory} onValueChange={setFCategory}>
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {categoryOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {getLabel('applicationCategory', c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeFilters > 0 ? (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X />
          Clear ({activeFilters})
        </Button>
      ) : null}
    </div>
  );

  /* ── row actions ── */
  function rowActions(p: ApplicationProject) {
    const next = nextStage(p.developmentStage);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDetail(p)}>
            <Eye />
            Open
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => advance(p)} disabled={!next}>
            <ChevronRight />
            {next ? `Advance to ${getLabel('developmentStage', next)}` : 'No further stage'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(p: ApplicationProject) {
    const v = STAGE_PROGRESS[p.developmentStage] ?? 0;
    return (
      <Card className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{companyName(p.companyId)}</p>
          </div>
          {p.currentResult ? <StatusBadge kind="feedbackResult" value={p.currentResult} /> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge kind="applicationCategory" value={p.category} />
          <StatusBadge kind="developmentStage" value={p.developmentStage} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={v} className="flex-1" />
          <span className="text-2xs tabular text-muted-foreground">{v}%</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Application projects"
        subtitle="Co-development projects taking Proamina® from concept to launch across applications."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              toast({
                variant: 'info',
                title: 'Export started',
                description: `Preparing CSV for ${filtered.length} ${filtered.length === 1 ? 'project' : 'projects'}…`,
              })
            }
          >
            <FlaskRound className="h-4 w-4" />
            Export
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total projects" value={stats?.total ?? 0} icon={FlaskConical} tone="gold" delay={0} />
        <StatCard
          label="Active"
          value={stats?.active ?? 0}
          icon={ActivityIcon}
          tone="info"
          hint="In development pipeline"
          delay={0.05}
        />
        <StatCard label="Launched" value={stats?.launched ?? 0} icon={Rocket} tone="success" delay={0.1} />
        <StatCard label="On hold" value={onHold} icon={PauseCircle} tone="warning" delay={0.15} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Projects by development stage"
          description="Where co-development work sits in the lifecycle"
          loading={rows === null}
          isEmpty={stageChart.length === 0}
        >
          <CategoryBar data={stageChart} xKey="stage" barKey="count" name="Projects" />
        </ChartCard>

        <ChartCard
          title="Projects by application"
          description="Distribution across product categories"
          loading={rows === null}
          isEmpty={categoryChart.length === 0}
        >
          <DonutChart data={categoryChart} centerLabel="projects" />
        </ChartCard>
      </div>

      {/* Table */}
      <DataTable<ApplicationProject>
        data={filtered}
        columns={columns}
        getRowId={(p) => p.id}
        loading={rows === null}
        searchable
        searchPlaceholder="Search project, brand, company…"
        searchValue={(p) =>
          [p.name, p.brandName, p.productName, companyName(p.companyId), p.market, p.clientProjectCode]
            .filter(Boolean)
            .join(' ')
        }
        pageSize={12}
        rowActions={rowActions}
        onRowClick={(p) => setDetail(p)}
        toolbar={toolbar}
        enableColumnVisibility
        enableDensityToggle
        mobileCard={mobileCard}
        emptyTitle="No projects match"
        emptyDescription="Adjust the filters to see more application projects."
        exportFilename="application-projects"
        storageKey="projects-table"
      />

      {/* Detail sheet */}
      <Sheet open={detail !== null} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>
                  {companyName(detail.companyId)}
                  {detail.clientProjectCode ? ` · ${detail.clientProjectCode}` : ''}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <StatusBadge kind="applicationCategory" value={detail.category} />
                <StatusBadge kind="developmentStage" value={detail.developmentStage} />
                <StatusBadge kind="testStage" value={detail.testStage ?? 'not_started'} />
                {detail.currentResult ? <StatusBadge kind="feedbackResult" value={detail.currentResult} /> : null}
              </div>

              {/* Progress */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Development progress</span>
                  <span className="text-xs font-semibold tabular text-foreground">
                    {STAGE_PROGRESS[detail.developmentStage] ?? 0}%
                  </span>
                </div>
                <Progress
                  value={STAGE_PROGRESS[detail.developmentStage] ?? 0}
                  indicatorClassName={detail.developmentStage === 'on_hold' ? 'bg-warning' : undefined}
                />
              </div>

              {/* Objective */}
              {detail.objective ? (
                <div className="flex items-start gap-2">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Objective</p>
                    <p className="text-sm font-medium text-foreground">{detail.objective}</p>
                  </div>
                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Market</dt>
                    <dd className="font-medium">{detail.market ?? '—'}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Test rounds</dt>
                    <dd className="font-medium tabular">{detail.testRounds ?? 0}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Est. launch</dt>
                    <dd className="font-medium">
                      {detail.estimatedLaunch ? formatDate(detail.estimatedLaunch, locale) : '—'}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Technical owner</dt>
                    <dd className="font-medium">{ownerName(detail.technicalOwnerId)}</dd>
                  </div>
                </div>
              </dl>

              {/* Current result */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Current result</p>
                <div className="mt-1">
                  {detail.currentResult ? (
                    <StatusBadge kind="feedbackResult" value={detail.currentResult} />
                  ) : (
                    <Badge variant="muted">Awaiting results</Badge>
                  )}
                </div>
              </div>

              {/* Linked sample */}
              <div className="rounded-lg border p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Linked sample</p>
                  {sample ? <StatusBadge kind="sampleStatus" value={sample.status} /> : null}
                </div>
                {detail.sampleRequestId ? (
                  sample ? (
                    <button
                      type="button"
                      onClick={() => {
                        const id = sample.id;
                        setDetail(null);
                        router.push('/admin/samples/' + id);
                      }}
                      className="group flex w-full items-center justify-between gap-2 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold text-foreground group-hover:underline">
                          {sample.reference}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {sample.requestedProduct} · {formatQuantity(sample.requestedQuantity, sample.unit, locale)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading sample…</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">No sample linked.</p>
                )}
              </div>

              {/* Next action */}
              {detail.nextAction ? (
                <div className="rounded-lg border border-dashed bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Next action</p>
                  <p className="mt-0.5 text-sm font-medium text-foreground">{detail.nextAction.label}</p>
                  {detail.nextAction.dueDate ? (
                    <p className="text-xs text-muted-foreground">Due {formatDate(detail.nextAction.dueDate, locale)}</p>
                  ) : null}
                </div>
              ) : null}

              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Close</Button>
                </SheetClose>
                <Button variant="gold" onClick={() => advance(detail)} disabled={!nextStage(detail.developmentStage)}>
                  <ChevronRight className="h-4 w-4" />
                  Advance stage
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
