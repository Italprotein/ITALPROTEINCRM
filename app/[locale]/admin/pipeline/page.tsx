'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Target,
  TrendingUp,
  Wallet,
  Trophy,
  XCircle,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  ChevronRight,
  ChevronLeft,
  MoveRight,
  CalendarClock,
} from 'lucide-react';
import {
  opportunityService,
  companyService,
  authService,
} from '@/lib/mock-services';
import type { Company, Opportunity, PipelineStage, Currency } from '@/lib/types';
import { PIPELINE_STAGES } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatCurrency, formatDate } from '@/lib/formatting';
import { uid, initials, cn } from '@/lib/utils';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard, CategoryBar } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useRouter } from '@/lib/i18n/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────────────────────────────────────────────────
 * Board configuration — curated subset of the full pipeline taxonomy.
 * ──────────────────────────────────────────────────────────────────────── */
const BOARD_STAGES: PipelineStage[] = [
  'lead',
  'qualified',
  'nda_sent',
  'nda_signed',
  'sample_requested',
  'sample_shipped',
  'application_testing',
  'feedback_received',
  'commercial_discussion',
  'quotation',
  'customer',
];

const STAGE_ACCENT: Partial<Record<PipelineStage, string>> = {
  lead: 'bg-muted-foreground/40',
  qualified: 'bg-info',
  nda_sent: 'bg-info',
  nda_signed: 'bg-brand-teal',
  sample_requested: 'bg-brand-gold',
  sample_shipped: 'bg-brand-gold',
  application_testing: 'bg-warning',
  feedback_received: 'bg-warning',
  commercial_discussion: 'bg-brand-navy',
  quotation: 'bg-brand-navy',
  customer: 'bg-success',
};

type ViewMode = 'board' | 'table';

function ownerName(ownerId: string): string {
  const a = authService.getAccount(ownerId);
  return a ? `${a.firstName} ${a.lastName}` : 'Unassigned';
}

function ownerColor(ownerId: string): string | undefined {
  return authService.getAccount(ownerId)?.avatarColor;
}

/* ────────────────────────────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────────────────────────────── */
export default function PipelinePage() {
  const t = useTranslations('AdminPipeline');
  const router = useRouter();
  const [opps, setOpps] = React.useState<Opportunity[] | null>(null);
  const [companies, setCompanies] = React.useState<Map<string, Company>>(new Map());
  const [view, setView] = React.useState<ViewMode>('board');
  const [createOpen, setCreateOpen] = React.useState(false);

  const load = React.useCallback(() => {
    Promise.all([opportunityService.list(), companyService.list()]).then(
      ([o, c]) => {
        setOpps(o);
        setCompanies(new Map(c.map((x) => [x.id, x])));
      },
    );
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const loading = opps === null;
  const list = opps ?? [];

  /* Derived statistics (recomputed locally so KPIs react to stage moves). */
  const stats = React.useMemo(() => {
    const won: PipelineStage[] = ['customer', 'repeat_customer'];
    const lost: PipelineStage[] = ['lost', 'disqualified'];
    const totalValue = list.reduce((s, o) => s + (o.expectedValue ?? 0), 0);
    const weightedValue = list.reduce(
      (s, o) => s + (o.expectedValue ?? 0) * ((o.probability ?? 0) / 100),
      0,
    );
    const wonCount = list.filter((o) => won.includes(o.stage)).length;
    const lostCount = list.filter((o) => lost.includes(o.stage)).length;
    const open = list.filter(
      (o) => !won.includes(o.stage) && !lost.includes(o.stage),
    ).length;
    return { totalValue, weightedValue, wonCount, lostCount, open };
  }, [list]);

  /* Grouping for the board. */
  const byStage = React.useMemo(() => {
    const map = new Map<PipelineStage, Opportunity[]>();
    for (const stage of BOARD_STAGES) map.set(stage, []);
    for (const o of list) {
      if (map.has(o.stage)) map.get(o.stage)!.push(o);
    }
    return map;
  }, [list]);

  /* Chart: value by stage (only stages that have value). */
  const stageValueData = React.useMemo(
    () =>
      BOARD_STAGES.map((stage) => {
        const items = byStage.get(stage) ?? [];
        return {
          stage: getLabel('pipelineStage', stage),
          value: items.reduce((s, o) => s + (o.expectedValue ?? 0), 0),
        };
      }).filter((d) => d.value > 0),
    [byStage],
  );

  /* Move an opportunity to a new stage (mock async). */
  const moveStage = React.useCallback(
    async (opp: Opportunity, next: PipelineStage) => {
      // optimistic update
      setOpps((prev) =>
        (prev ?? []).map((o) =>
          o.id === opp.id
            ? { ...o, stage: next, updatedAt: new Date().toISOString() }
            : o,
        ),
      );
      await new Promise((r) => setTimeout(r, 450));
      await opportunityService.update(opp.id, {
        stage: next,
        updatedAt: new Date().toISOString(),
      });
      toast({
        variant: 'success',
        title: t('toastStageUpdatedTitle'),
        description: `${opp.title} → ${getLabel('pipelineStage', next)}`,
      });
    },
    [t],
  );

  const handleCreated = React.useCallback(
    (created: Opportunity) => {
      setOpps((prev) => [created, ...(prev ?? [])]);
      setCreateOpen(false);
      toast({
        variant: 'success',
        title: 'Opportunity added',
        description: `${created.title} created in ${getLabel('pipelineStage', created.stage)}.`,
      });
    },
    [],
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Pipeline"
        subtitle="Track every opportunity from first contact to repeat customer."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border bg-card p-0.5">
              <Button
                variant={view === 'board' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
                onClick={() => setView('board')}
              >
                <LayoutGrid className="h-4 w-4" />
                Board
              </Button>
              <Button
                variant={view === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-1.5"
                onClick={() => setView('table')}
              >
                <TableIcon className="h-4 w-4" />
                Table
              </Button>
            </div>
            <Button variant="gold" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Add opportunity
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Open opportunities" value={stats.open} icon={Target} tone="info" />
        <StatCard
          label="Total pipeline value"
          value={stats.totalValue}
          icon={Wallet}
          tone="gold"
          format={(n) => formatCurrency(n, 'EUR', 'en', { compact: true })}
        />
        <StatCard
          label="Weighted value"
          value={stats.weightedValue}
          icon={TrendingUp}
          tone="success"
          format={(n) => formatCurrency(n, 'EUR', 'en', { compact: true })}
          hint="Value × probability"
        />
        <StatCard label="Won" value={stats.wonCount} icon={Trophy} tone="success" />
        <StatCard label="Lost" value={stats.lostCount} icon={XCircle} tone="danger" />
      </div>

      {/* Chart */}
      <ChartCard
        title="Pipeline value by stage"
        description="Total expected value of open opportunities at each stage."
        loading={loading}
        isEmpty={!loading && stageValueData.length === 0}
        emptyMessage="No opportunity value to chart yet."
        height={260}
      >
        <CategoryBar
          data={stageValueData}
          xKey="stage"
          barKey="value"
          name="Value"
          horizontal
          height={260}
        />
      </ChartCard>

      {/* Main view */}
      {loading ? (
        <BoardSkeleton />
      ) : view === 'board' ? (
        <PipelineBoard
          byStage={byStage}
          companies={companies}
          onMove={moveStage}
          onOpen={(id) => router.push('/admin/pipeline/' + id)}
        />
      ) : (
        <PipelineTable
          data={list}
          companies={companies}
          onMove={moveStage}
        />
      )}

      <CreateOpportunityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={companies}
        onCreated={handleCreated}
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Board view
 * ──────────────────────────────────────────────────────────────────────── */
function PipelineBoard({
  byStage,
  companies,
  onMove,
  onOpen,
}: {
  byStage: Map<PipelineStage, Opportunity[]>;
  companies: Map<string, Company>;
  onMove: (opp: Opportunity, next: PipelineStage) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
      {BOARD_STAGES.map((stage) => {
        const items = byStage.get(stage) ?? [];
        const sum = items.reduce((s, o) => s + (o.expectedValue ?? 0), 0);
        return (
          <div key={stage} className="flex w-72 shrink-0 flex-col">
            <div className="mb-2 flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', STAGE_ACCENT[stage] ?? 'bg-muted-foreground/40')} />
              <span className="truncate text-sm font-semibold text-foreground">
                {getLabel('pipelineStage', stage)}
              </span>
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold tabular text-muted-foreground">
                {items.length}
              </span>
            </div>
            <p className="mb-2 px-1 text-xs font-medium tabular text-muted-foreground">
              {formatCurrency(sum, 'EUR', 'en', { compact: true })}
            </p>
            <div className="flex flex-1 flex-col gap-2 rounded-lg bg-muted/40 p-2">
              <AnimatePresence mode="popLayout">
                {items.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground/70">
                    No opportunities
                  </p>
                ) : (
                  items.map((o) => (
                    <OpportunityCard
                      key={o.id}
                      opp={o}
                      company={companies.get(o.companyId)}
                      stage={stage}
                      onMove={onMove}
                      onOpen={onOpen}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OpportunityCard({
  opp,
  company,
  stage,
  onMove,
  onOpen,
}: {
  opp: Opportunity;
  company: Company | undefined;
  stage: PipelineStage;
  onMove: (opp: Opportunity, next: PipelineStage) => void;
  onOpen: (id: string) => void;
}) {
  const idx = BOARD_STAGES.indexOf(stage);
  const prev = idx > 0 ? BOARD_STAGES[idx - 1] : null;
  const next = idx < BOARD_STAGES.length - 1 ? BOARD_STAGES[idx + 1] : null;
  const owner = ownerName(opp.ownerId);
  const color = ownerColor(opp.ownerId);

  return (
    <motion.div
      layout
      layoutId={opp.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className="group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onOpen(opp.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">
          {company?.tradingName ?? company?.legalName ?? 'Unknown company'}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 -mt-1 h-6 w-6 opacity-60 group-hover:opacity-100"
                aria-label="Move stage"
              >
                <MoveRight className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {next && (
                <DropdownMenuItem onClick={() => onMove(opp, next)}>
                  <ChevronRight className="mr-2 h-4 w-4 text-success" />
                  {getLabel('pipelineStage', next)}
                </DropdownMenuItem>
              )}
              {prev && (
                <DropdownMenuItem onClick={() => onMove(opp, prev)}>
                  <ChevronLeft className="mr-2 h-4 w-4 text-muted-foreground" />
                  {getLabel('pipelineStage', prev)}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {BOARD_STAGES.filter((s) => s !== stage).map((s) => (
                <DropdownMenuItem key={s} onClick={() => onMove(opp, s)}>
                  {getLabel('pipelineStage', s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug text-foreground">
        {opp.title}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold tabular text-brand-goldDark">
          {formatCurrency(opp.expectedValue ?? 0, opp.currency, 'en', { compact: true })}
        </span>
        <span className="text-xs tabular text-muted-foreground">
          {opp.probability ?? 0}%
        </span>
      </div>
      <Progress value={opp.probability ?? 0} className="mt-1 h-1.5" />

      {opp.nextAction?.label && (
        <p className="mt-2 flex items-center gap-1 truncate text-xs text-muted-foreground">
          <CalendarClock className="h-3 w-3 shrink-0" />
          <span className="truncate">{opp.nextAction.label}</span>
        </p>
      )}

      <div className="mt-2 flex items-center gap-1.5 border-t pt-2">
        <Avatar className="h-5 w-5">
          <AvatarFallback
            className="text-[9px] text-white"
            style={color ? { backgroundColor: color } : undefined}
          >
            {initials(owner)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate text-xs text-muted-foreground">{owner}</span>
      </div>
    </motion.div>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 3 }).map((__, j) => (
            <Skeleton key={j} className="h-28 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Table view
 * ──────────────────────────────────────────────────────────────────────── */
function PipelineTable({
  data,
  companies,
  onMove,
}: {
  data: Opportunity[];
  companies: Map<string, Company>;
  onMove: (opp: Opportunity, next: PipelineStage) => void;
}) {
  const columns: Column<Opportunity>[] = [
    {
      key: 'company',
      header: 'Company',
      cell: (o) => {
        const c = companies.get(o.companyId);
        const name = c?.tradingName ?? c?.legalName ?? 'Unknown';
        return (
          <Link
            href={'/admin/companies/' + o.companyId}
            className="font-medium text-foreground hover:text-brand-navy hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {name}
          </Link>
        );
      },
      sortValue: (o) =>
        companies.get(o.companyId)?.tradingName ??
        companies.get(o.companyId)?.legalName ??
        '',
    },
    {
      key: 'title',
      header: 'Title',
      cell: (o) => <span className="text-sm text-foreground">{o.title}</span>,
      sortValue: (o) => o.title,
    },
    {
      key: 'stage',
      header: 'Stage',
      cell: (o) => <StatusBadge kind="pipelineStage" value={o.stage} />,
      sortValue: (o) => PIPELINE_STAGES.indexOf(o.stage),
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      sortable: true,
      sortValue: (o) => o.expectedValue ?? 0,
      cell: (o) => (
        <span className="tabular font-medium">
          {formatCurrency(o.expectedValue ?? 0, o.currency, 'en')}
        </span>
      ),
    },
    {
      key: 'probability',
      header: 'Probability',
      sortValue: (o) => o.probability ?? 0,
      cell: (o) => (
        <div className="flex w-28 items-center gap-2">
          <Progress value={o.probability ?? 0} className="h-1.5 flex-1" />
          <span className="w-9 text-right text-xs tabular text-muted-foreground">
            {o.probability ?? 0}%
          </span>
        </div>
      ),
    },
    {
      key: 'close',
      header: 'Expected close',
      sortValue: (o) => o.expectedCloseDate ?? '',
      cell: (o) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(o.expectedCloseDate, 'en')}
        </span>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (o) => ownerName(o.ownerId),
      cell: (o) => {
        const owner = ownerName(o.ownerId);
        const color = ownerColor(o.ownerId);
        return (
          <div className="flex items-center gap-1.5">
            <Avatar className="h-6 w-6">
              <AvatarFallback
                className="text-[10px] text-white"
                style={color ? { backgroundColor: color } : undefined}
              >
                {initials(owner)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm text-muted-foreground">{owner}</span>
          </div>
        );
      },
    },
    {
      key: 'next',
      header: 'Next action',
      cell: (o) =>
        o.nextAction?.label ? (
          <span className="text-sm text-muted-foreground">{o.nextAction.label}</span>
        ) : (
          <span className="text-sm text-muted-foreground/60">—</span>
        ),
    },
  ];

  return (
    <DataTable<Opportunity>
      data={data}
      columns={columns}
      getRowId={(o) => o.id}
      searchable
      searchPlaceholder="Search opportunities…"
      searchValue={(o) =>
        [
          o.title,
          companies.get(o.companyId)?.tradingName,
          companies.get(o.companyId)?.legalName,
          getLabel('pipelineStage', o.stage),
        ]
          .filter(Boolean)
          .join(' ')
      }
      pageSize={12}
      enableDensityToggle
      enableColumnVisibility
      storageKey="pipeline-table"
      exportFilename="pipeline"
      emptyTitle="No opportunities"
      emptyDescription="Add an opportunity to start building your pipeline."
      rowActions={(o) => <StageMoveMenu opp={o} onMove={onMove} />}
    />
  );
}

function StageMoveMenu({
  opp,
  onMove,
}: {
  opp: Opportunity;
  onMove: (opp: Opportunity, next: PipelineStage) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <MoveRight className="h-3.5 w-3.5" />
          Move
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {BOARD_STAGES.filter((s) => s !== opp.stage).map((s) => (
          <DropdownMenuItem key={s} onClick={() => onMove(opp, s)}>
            {getLabel('pipelineStage', s)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Create opportunity dialog
 * ──────────────────────────────────────────────────────────────────────── */
function CreateOpportunityDialog({
  open,
  onOpenChange,
  companies,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companies: Map<string, Company>;
  onCreated: (o: Opportunity) => void;
}) {
  const companyOptions = React.useMemo(
    () =>
      Array.from(companies.values()).sort((a, b) =>
        (a.tradingName ?? a.legalName).localeCompare(b.tradingName ?? b.legalName),
      ),
    [companies],
  );

  const [companyId, setCompanyId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [stage, setStage] = React.useState<PipelineStage>('lead');
  const [value, setValue] = React.useState('');
  const [probability, setProbability] = React.useState('20');
  const [closeDate, setCloseDate] = React.useState('');
  const [nextAction, setNextAction] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setCompanyId('');
      setTitle('');
      setStage('lead');
      setValue('');
      setProbability('20');
      setCloseDate('');
      setNextAction('');
    }
  }, [open]);

  const valid = companyId !== '' && title.trim() !== '';

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);
    const company = companies.get(companyId);
    const now = new Date().toISOString();
    const opp: Opportunity = {
      id: uid('opp'),
      companyId,
      title: title.trim(),
      stage,
      expectedValue: value ? Number(value) : undefined,
      currency: (company?.preferredCurrency ?? 'EUR') as Currency,
      probability: probability ? Number(probability) : undefined,
      expectedCloseDate: closeDate || undefined,
      nextAction: nextAction.trim() ? { label: nextAction.trim() } : undefined,
      ownerId: company?.accountOwnerId ?? 'u_admin',
      stageHistory: [{ stage, enteredAt: now }],
      createdAt: now,
      updatedAt: now,
    };
    await new Promise((r) => setTimeout(r, 500));
    const created = await opportunityService.create(opp);
    setSubmitting(false);
    onCreated(created);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add opportunity</DialogTitle>
          <DialogDescription>
            Create a new opportunity and place it on the pipeline board.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="opp-company">Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger id="opp-company">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {companyOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradingName ?? c.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="opp-title">Title</Label>
            <Input
              id="opp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Protein bar reformulation — 2026"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="opp-stage">Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as PipelineStage)}>
                <SelectTrigger id="opp-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {BOARD_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {getLabel('pipelineStage', s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="opp-prob">Probability (%)</Label>
              <Input
                id="opp-prob"
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="opp-value">Expected value (EUR)</Label>
              <Input
                id="opp-value"
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="50000"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="opp-close">Expected close</Label>
              <Input
                id="opp-close"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="opp-next">Next action</Label>
            <Textarea
              id="opp-next"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="e.g. Send technical data sheet and price indication"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleSubmit} disabled={!valid || submitting}>
            {submitting ? 'Creating…' : 'Create opportunity'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
