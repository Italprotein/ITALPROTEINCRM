'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  FlaskConical,
  Clock,
  PackageOpen,
  Truck,
  MessageSquareQuote,
  Plus,
  Download,
  MoreHorizontal,
  ExternalLink,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Send,
  Table2,
  LayoutGrid,
  X,
} from 'lucide-react';

import { sampleService, companyService, analyticsService } from '@/lib/mock-services';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { useSession } from '@/components/providers/session-provider';
import type {
  SampleRequest,
  SampleStatus,
  Company,
  ApplicationCategory,
  Priority,
  QuantityUnit,
  Locale,
} from '@/lib/types';
import { APPLICATION_CATEGORIES } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, formatQuantity, flagEmoji } from '@/lib/formatting';
import { cn, initials, uid } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { ChartCard, TrendChart, DonutChart, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Option lists ────────────────────────────── */

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const UNITS: QuantityUnit[] = ['g', 'kg', 'units', 'sachets', 'boxes', 'l', 'ml'];

/** Ordered board lanes — the meaningful sample lifecycle stages. */
const BOARD_STAGES: SampleStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'preparing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'testing',
  'feedback_received',
];

const ALL = '__all__';

/* ────────────────────────────── Helpers ────────────────────────────── */

/** Next forward status for a given sample status (used by quick "advance" action). */
function nextStatus(status: SampleStatus): SampleStatus | null {
  const map: Partial<Record<SampleStatus, SampleStatus>> = {
    submitted: 'under_review',
    under_review: 'approved',
    approved: 'preparing',
    preparing: 'ready_to_ship',
    ready_to_ship: 'shipped',
    shipped: 'delivered',
    delivered: 'testing',
    testing: 'feedback_received',
  };
  return map[status] ?? null;
}

type Stats = Awaited<ReturnType<typeof sampleService.getStatistics>>;

/* ────────────────────────────── Page ────────────────────────────── */

export default function SamplesPage() {
  const t = useTranslations('AdminSamples');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { nameOf } = useStaffDirectory();
  const { account } = useSession();

  const [rows, setRows] = React.useState<SampleRequest[] | null>(null);
  const [companies, setCompanies] = React.useState<Map<string, Company>>(new Map());
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [trend, setTrend] = React.useState<{ month: string; label: string; count: number }[]>([]);

  const [view, setView] = React.useState<'table' | 'board'>('table');
  const [createOpen, setCreateOpen] = React.useState(false);

  // toolbar filters
  const [fStatus, setFStatus] = React.useState<string>(ALL);
  const [fApp, setFApp] = React.useState<string>(ALL);
  const [fPriority, setFPriority] = React.useState<string>(ALL);

  React.useEffect(() => {
    sampleService.list().then(setRows);
    sampleService.getStatistics().then(setStats);
    analyticsService.samplesOverTime().then(setTrend);
    companyService.list().then((cs) => setCompanies(new Map(cs.map((c) => [c.id, c]))));
  }, []);

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
    if (fStatus !== ALL) data = data.filter((s) => s.status === fStatus);
    if (fApp !== ALL) data = data.filter((s) => s.applicationCategory === fApp);
    if (fPriority !== ALL) data = data.filter((s) => s.priority === fPriority);
    return data;
  }, [rows, fStatus, fApp, fPriority]);

  const activeFilterCount =
    (fStatus !== ALL ? 1 : 0) + (fApp !== ALL ? 1 : 0) + (fPriority !== ALL ? 1 : 0);

  const resetFilters = () => {
    setFStatus(ALL);
    setFApp(ALL);
    setFPriority(ALL);
  };

  /* ── derived options ── */
  const statusOptions = React.useMemo(() => {
    const present = new Set((rows ?? []).map((s) => s.status));
    return [...present];
  }, [rows]);

  const appOptions = React.useMemo(() => {
    const present = new Set((rows ?? []).map((s) => s.applicationCategory));
    return APPLICATION_CATEGORIES.filter((a) => present.has(a));
  }, [rows]);

  /* ── chart data ── */
  const trendData = React.useMemo(
    () => trend.map((t) => ({ label: t.label, count: t.count })),
    [trend],
  );

  const donutData = React.useMemo(() => {
    const bs = stats?.byStatus ?? ({} as Record<SampleStatus, number>);
    const sum = (...st: SampleStatus[]) => st.reduce((acc, s) => acc + (bs[s] ?? 0), 0);
    const buckets = [
      { name: t('bucketRequested'), value: sum('draft', 'submitted', 'under_review', 'more_info_required'), color: CHART_COLORS[3] },
      { name: t('bucketApproved'), value: sum('approved', 'preparing', 'ready_to_ship'), color: CHART_COLORS[1] },
      { name: t('bucketShipped'), value: sum('shipped', 'in_transit', 'customs_hold', 'delivery_attempted'), color: CHART_COLORS[2] },
      { name: t('bucketDelivered'), value: sum('delivered', 'receipt_confirmed'), color: CHART_COLORS[7] },
      { name: t('bucketFeedback'), value: sum('testing', 'feedback_requested', 'feedback_received', 'closed'), color: CHART_COLORS[6] },
    ];
    return buckets.filter((b) => b.value > 0);
  }, [stats, t]);

  /* ── mutations (mock) ── */
  function applyStatus(id: string, status: SampleStatus, extra?: Partial<SampleRequest>) {
    const today = new Date().toISOString().slice(0, 10);
    setRows((prev) =>
      prev
        ? prev.map((s) =>
            s.id === id
              ? {
                  ...s,
                  status,
                  ...extra,
                  statusHistory: [
                    ...s.statusHistory,
                    { status, at: today, byUserId: account?.id },
                  ],
                }
              : s,
          )
        : prev,
    );
    const target = (rows ?? []).find((s) => s.id === id);
    if (target) {
      void sampleService.update(id, {
        status,
        ...extra,
        statusHistory: [...target.statusHistory, { status, at: today, byUserId: account?.id }],
      });
    }
    // keep KPI counters roughly fresh
    void sampleService.getStatistics().then(setStats);
  }

  function handleCreate(s: SampleRequest) {
    setRows((prev) => (prev ? [s, ...prev] : [s]));
    void sampleService.getStatistics().then(setStats);
    void analyticsService.samplesOverTime().then(setTrend);
  }

  function advance(s: SampleRequest) {
    const next = nextStatus(s.status);
    if (!next) {
      toast({ variant: 'info', title: t('toastNoFurtherStageTitle'), description: t('toastNoFurtherStageDescription', { reference: s.reference, status: getLabel('sampleStatus', s.status) }) });
      return;
    }
    applyStatus(s.id, next);
    toast({ variant: 'success', title: t('toastStatusAdvancedTitle'), description: t('toastStatusChangedDescription', { reference: s.reference, status: getLabel('sampleStatus', next) }) });
  }

  function approve(s: SampleRequest) {
    applyStatus(s.id, 'approved', { approvedQuantity: s.requestedQuantity, approvalDate: new Date().toISOString().slice(0, 10) });
    toast({ variant: 'success', title: t('toastSampleApprovedTitle'), description: t('toastSampleApprovedDescription', { reference: s.reference, quantity: formatQuantity(s.requestedQuantity, s.unit, locale) }) });
  }

  function reject(s: SampleRequest) {
    applyStatus(s.id, 'rejected');
    toast({ variant: 'warning', title: t('toastSampleRejectedTitle'), description: t('toastSampleRejectedDescription', { reference: s.reference }) });
  }

  function mark(s: SampleRequest, status: SampleStatus) {
    applyStatus(s.id, status);
    toast({ variant: 'success', title: t('toastStatusUpdatedTitle'), description: t('toastStatusChangedDescription', { reference: s.reference, status: getLabel('sampleStatus', status) }) });
  }

  /* ── table columns ── */
  const columns: Column<SampleRequest>[] = [
    {
      key: 'reference',
      header: t('columnReference'),
      sortValue: (s) => s.reference,
      cell: (s) => <span className="font-mono text-sm font-medium text-foreground">{s.reference}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      sortValue: (s) => companyName(s.companyId),
      cell: (s) => {
        const c = companies.get(s.companyId);
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
            <span className="truncate text-sm font-medium text-foreground">{companyName(s.companyId)}</span>
          </button>
        );
      },
    },
    {
      key: 'product',
      header: 'Product',
      sortValue: (s) => s.requestedProduct,
      cell: (s) => <span className="truncate text-sm text-muted-foreground">{s.requestedProduct}</span>,
      hideable: true,
    },
    {
      key: 'application',
      header: 'Application',
      sortValue: (s) => getLabel('applicationCategory', s.applicationCategory),
      cell: (s) => <StatusBadge kind="applicationCategory" value={s.applicationCategory} />,
      hideable: true,
    },
    {
      key: 'requested',
      header: 'Requested',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.requestedQuantity,
      cell: (s) => <span className="tabular text-sm">{formatQuantity(s.requestedQuantity, s.unit, locale)}</span>,
      hideable: true,
    },
    {
      key: 'approved',
      header: 'Approved',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.approvedQuantity ?? -1,
      cell: (s) =>
        s.approvedQuantity != null ? (
          <span className="tabular text-sm">{formatQuantity(s.approvedQuantity, s.unit, locale)}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (s) => getLabel('sampleStatus', s.status),
      cell: (s) => <StatusBadge kind="sampleStatus" value={s.status} />,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortValue: (s) => PRIORITIES.indexOf(s.priority),
      cell: (s) => <PriorityBadge value={s.priority} />,
      hideable: true,
    },
    {
      key: 'requestDate',
      header: 'Request date',
      align: 'right',
      sortable: true,
      sortValue: (s) => new Date(s.requestDate).getTime(),
      cell: (s) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(s.requestDate, locale)}</span>,
      hideable: true,
    },
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (s) => nameOf(s.accountOwnerId, 'Unassigned'),
      cell: (s) => {
        const name = nameOf(s.accountOwnerId, 'Unassigned');
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
      <Select value={fStatus} onValueChange={setFStatus}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {statusOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {getLabel('sampleStatus', s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fApp} onValueChange={setFApp}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Application" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All applications</SelectItem>
          {appOptions.map((a) => (
            <SelectItem key={a} value={a}>
              {getLabel('applicationCategory', a)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fPriority} onValueChange={setFPriority}>
        <SelectTrigger className="h-9 w-[140px]">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All priorities</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {getLabel('priority', p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeFilterCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X />
          Clear ({activeFilterCount})
        </Button>
      ) : null}
    </div>
  );

  /* ── row actions ── */
  function rowActions(s: SampleRequest) {
    const canApprove = s.status === 'submitted' || s.status === 'under_review' || s.status === 'more_info_required';
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push('/admin/samples/' + s.id)}>
            <ExternalLink />
            Open
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canApprove ? (
            <>
              <DropdownMenuItem onSelect={() => approve(s)}>
                <CheckCircle2 />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => reject(s)}>
                <XCircle />
                Reject
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuLabel>Mark as</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => mark(s, 'preparing')}>
            <PackageOpen />
            Preparing
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => mark(s, 'ready_to_ship')}>
            <PackageCheck />
            Ready to ship
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => mark(s, 'shipped')}>
            <Truck />
            Shipped
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(s: SampleRequest) {
    return (
      <Card className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-foreground">{s.reference}</p>
            <p className="truncate text-xs text-muted-foreground">{companyName(s.companyId)}</p>
          </div>
          <PriorityBadge value={s.priority} />
        </div>
        <p className="mt-2 truncate text-sm text-muted-foreground">{s.requestedProduct}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge kind="sampleStatus" value={s.status} />
          <StatusBadge kind="applicationCategory" value={s.applicationCategory} />
          <Badge variant="muted" className="text-2xs tabular">
            {formatQuantity(s.requestedQuantity, s.unit, locale)}
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Sample requests"
        subtitle="Track every Proamina® sample from request to feedback."
        actions={
          <>
            <div className="inline-flex items-center rounded-lg border bg-card p-0.5">
              <Button
                variant={view === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('table')}
                className="gap-1.5"
              >
                <Table2 className="h-4 w-4" />
                Table
              </Button>
              <Button
                variant={view === 'board' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('board')}
                className="gap-1.5"
              >
                <LayoutGrid className="h-4 w-4" />
                Board
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  variant: 'info',
                  title: 'Export started',
                  description: `Preparing CSV for ${filtered.length} sample ${filtered.length === 1 ? 'request' : 'requests'}…`,
                })
              }
            >
              <Download />
              Export
            </Button>
            <Button variant="gold" onClick={() => setCreateOpen(true)}>
              <Plus />
              New sample request
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total requests" value={stats?.total ?? 0} icon={FlaskConical} tone="gold" />
        <StatCard label="Pending approval" value={stats?.pendingApproval ?? 0} icon={Clock} tone="warning" delay={0.05} />
        <StatCard label="Preparing" value={stats?.preparing ?? 0} icon={PackageOpen} tone="info" delay={0.1} />
        <StatCard label="Shipped" value={stats?.shipped ?? 0} icon={Truck} tone="info" delay={0.15} />
        <StatCard label="Awaiting feedback" value={stats?.awaitingFeedback ?? 0} icon={MessageSquareQuote} tone="success" delay={0.2} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Sample requests over time"
          description="New requests per month"
          loading={rows === null}
          isEmpty={trendData.length === 0}
        >
          <TrendChart
            data={trendData}
            xKey="label"
            series={[{ key: 'count', name: 'Requests', color: CHART_COLORS[2], type: 'area' }]}
          />
        </ChartCard>

        <ChartCard
          title="Pipeline by stage group"
          description="Where samples sit in the lifecycle"
          loading={rows === null}
          isEmpty={donutData.length === 0}
        >
          <DonutChart data={donutData} centerLabel="samples" />
        </ChartCard>
      </div>

      {/* Table / Board */}
      {view === 'table' ? (
        <DataTable<SampleRequest>
          data={filtered}
          columns={columns}
          getRowId={(s) => s.id}
          loading={rows === null}
          searchable
          searchPlaceholder="Search reference, company, product…"
          searchValue={(s) => [s.reference, companyName(s.companyId), s.requestedProduct, s.recipient].filter(Boolean).join(' ')}
          pageSize={12}
          rowActions={rowActions}
          onRowClick={(s) => router.push('/admin/samples/' + s.id)}
          toolbar={toolbar}
          enableColumnVisibility
          enableDensityToggle
          mobileCard={mobileCard}
          emptyTitle="No sample requests match"
          emptyDescription="Adjust the filters or create a new sample request."
          exportFilename="sample-requests"
          storageKey="samples-table"
        />
      ) : (
        <SampleBoard
          rows={filtered}
          loading={rows === null}
          companyName={companyName}
          onOpen={(id) => router.push('/admin/samples/' + id)}
          locale={locale}
        />
      )}

      <CreateSampleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={[...companies.values()]}
        onCreated={handleCreate}
      />
    </div>
  );
}

/* ────────────────────────────── Board view ────────────────────────────── */

function SampleBoard({
  rows,
  loading,
  companyName,
  onOpen,
  locale,
}: {
  rows: SampleRequest[];
  loading: boolean;
  companyName: (id: string) => string;
  onOpen: (id: string) => void;
  locale: Locale;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-64 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const lanes = BOARD_STAGES.map((stage) => ({
    stage,
    items: rows.filter((s) => s.status === stage),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {lanes.map(({ stage, items }) => (
        <div key={stage} className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/40">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
            <StatusBadge kind="sampleStatus" value={stage} />
            <span className="text-xs font-semibold tabular text-muted-foreground">{items.length}</span>
          </div>
          <div className="flex flex-col gap-2 p-2">
            {items.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">No samples</p>
            ) : (
              items.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpen(s.id)}
                  className={cn(
                    'w-full rounded-md border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-2xs font-semibold text-muted-foreground">{s.reference}</span>
                    <PriorityBadge value={s.priority} />
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">{companyName(s.companyId)}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.requestedProduct}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <StatusBadge kind="applicationCategory" value={s.applicationCategory} />
                    <span className="text-2xs tabular text-muted-foreground">
                      {formatQuantity(s.requestedQuantity, s.unit, locale)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────────────── Create dialog ────────────────────────────── */

function CreateSampleDialog({
  open,
  onOpenChange,
  companies,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onCreated: (s: SampleRequest) => void;
}) {
  const { account } = useSession();
  const [companyId, setCompanyId] = React.useState('');
  const [product, setProduct] = React.useState('Proamina® 100% Protein Sweetener');
  const [application, setApplication] = React.useState<ApplicationCategory>('protein_bars');
  const [quantity, setQuantity] = React.useState('100');
  const [unit, setUnit] = React.useState<QuantityUnit>('g');
  const [priority, setPriority] = React.useState<Priority>('medium');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const sortedCompanies = React.useMemo(
    () => [...companies].sort((a, b) => (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName)),
    [companies],
  );

  function reset() {
    setCompanyId('');
    setProduct('Proamina® 100% Protein Sweetener');
    setApplication('protein_bars');
    setQuantity('100');
    setUnit('g');
    setPriority('medium');
    setNotes('');
  }

  const qtyNum = Number(quantity);
  const valid = companyId !== '' && product.trim().length > 0 && Number.isFinite(qtyNum) && qtyNum > 0;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    const company = companies.find((c) => c.id === companyId);
    const today = new Date().toISOString().slice(0, 10);
    const sample: SampleRequest = {
      id: uid('sr'),
      reference: 'SR-2026-' + String(Math.floor(1000 + Math.random() * 9000)),
      companyId,
      applicationCategory: application,
      requestedProduct: product.trim(),
      requestedQuantity: qtyNum,
      unit,
      requestDate: today,
      priority,
      accountOwnerId: company?.accountOwnerId ?? account?.id ?? '',
      assignedLogisticsId: account?.id ?? '',
      clientVisibleNotes: notes.trim() || undefined,
      internalInstructions: notes.trim() || undefined,
      requiredDocuments: ['COA', 'TDS'],
      status: 'submitted',
      statusHistory: [{ status: 'submitted', at: today, byUserId: account?.id }],
      createdAt: today,
    };

    await sampleService.create(sample);
    onCreated(sample);
    toast({
      variant: 'success',
      title: 'Sample request created',
      description: `${sample.reference} for ${company?.tradingName || company?.legalName || 'company'} submitted.`,
    });
    setSubmitting(false);
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New sample request</DialogTitle>
          <DialogDescription>Create a sample request. It will be submitted for approval.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Company *</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {sortedCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {flagEmoji(c.countryCode)} {c.tradingName || c.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="product">Product *</Label>
            <Input id="product" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Proamina® …" />
          </div>

          <div className="space-y-1.5">
            <Label>Application</Label>
            <Select value={application} onValueChange={(v) => setApplication(v as ApplicationCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_CATEGORIES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {getLabel('applicationCategory', a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {getLabel('priority', p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity">Requested quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Unit</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as QuantityUnit)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {getLabel('quantityUnit', u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Destination notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery address, recipient, customs notes…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>
            {submitting ? (
              'Creating…'
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
