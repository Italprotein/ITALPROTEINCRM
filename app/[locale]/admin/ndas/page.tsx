'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import {
  FileSignature,
  Clock,
  CheckCircle2,
  FileClock,
  AlertTriangle,
  Plus,
  Upload,
  MoreHorizontal,
  Eye,
  Download,
  Send,
  PenLine,
  RotateCcw,
  FileUp,
  StickyNote,
  ListChecks,
  X,
  Building2,
  CalendarClock,
  History,
  FileText,
  ShieldCheck,
} from 'lucide-react';

import { ndaService, companyService, analyticsService } from '@/lib/mock-services';
import type {
  NDA,
  NDAStatus,
  NDAType,
  NDAVersion,
  Company,
  Locale,
} from '@/lib/types';
import { NDA_STATUS_FLOW } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, daysUntil, flagEmoji } from '@/lib/formatting';
import { cn, uid } from '@/lib/utils';
import { useRouter, Link } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard, TrendChart, DonutChart, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Constants ────────────────────────────── */

const ALL = '__all__';
const TODAY = '2026-06-17';

const NDA_TYPES: NDAType[] = ['mutual', 'one_way_inbound', 'one_way_outbound'];

/** Statuses offered when creating a new NDA record. */
const CREATABLE_STATUSES: NDAStatus[] = ['to_prepare', 'draft', 'sent'];

/** Donut colour assignment by status code (dark-mode-safe palette). */
const STATUS_COLOR: Partial<Record<NDAStatus, string>> = {
  to_prepare: CHART_COLORS[3],
  draft: CHART_COLORS[6],
  sent: CHART_COLORS[2],
  under_review: CHART_COLORS[8 % CHART_COLORS.length],
  changes_requested: CHART_COLORS[1],
  approved: CHART_COLORS[0],
  awaiting_italprotein_signature: CHART_COLORS[4 % CHART_COLORS.length],
  awaiting_counterparty_signature: CHART_COLORS[7 % CHART_COLORS.length],
  partially_signed: CHART_COLORS[1],
  fully_signed: CHART_COLORS[5 % CHART_COLORS.length],
  expired: CHART_COLORS[6],
  terminated: CHART_COLORS[6],
};

type Stats = Awaited<ReturnType<typeof ndaService.getStatistics>>;

/** Expiry inside 60 days of the demo "today" (and not already past). */
function expiringWindow(expiry?: string): { soon: boolean; days: number | null } {
  if (!expiry) return { soon: false, days: null };
  const days = daysUntil(expiry, new Date(TODAY + 'T12:00:00Z'));
  return { soon: days != null && days >= 0 && days <= 60, days };
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function NdasPage() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [rows, setRows] = React.useState<NDA[] | null>(null);
  const [companies, setCompanies] = React.useState<Map<string, Company>>(new Map());
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [trend, setTrend] = React.useState<{ month: string; label: string; signed: number; sent: number }[]>([]);

  // toolbar filters
  const [fStatus, setFStatus] = React.useState<string>(ALL);
  const [fType, setFType] = React.useState<string>(ALL);

  // dialogs / sheet
  const [createOpen, setCreateOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [noteFor, setNoteFor] = React.useState<NDA | null>(null);
  const [revisionFor, setRevisionFor] = React.useState<NDA | null>(null);

  React.useEffect(() => {
    ndaService.list().then(setRows);
    ndaService.getStatistics().then(setStats);
    analyticsService.ndaCompletionTrend().then(setTrend);
    companyService.list().then((cs) => setCompanies(new Map(cs.map((c) => [c.id, c]))));
  }, []);

  const companyName = React.useCallback(
    (id: string) => {
      const c = companies.get(id);
      return c ? c.tradingName || c.legalName : '—';
    },
    [companies],
  );

  const refreshStats = React.useCallback(() => {
    void ndaService.getStatistics().then(setStats);
  }, []);

  /* ── filtered data ── */
  const filtered = React.useMemo(() => {
    let data = rows ?? [];
    if (fStatus !== ALL) data = data.filter((n) => n.status === fStatus);
    if (fType !== ALL) data = data.filter((n) => n.type === fType);
    return data;
  }, [rows, fStatus, fType]);

  const activeFilterCount = (fStatus !== ALL ? 1 : 0) + (fType !== ALL ? 1 : 0);
  const resetFilters = () => {
    setFStatus(ALL);
    setFType(ALL);
  };

  /* ── derived filter options (present in data) ── */
  const statusOptions = React.useMemo(() => {
    const present = new Set((rows ?? []).map((n) => n.status));
    return NDA_STATUS_FLOW.filter((s) => present.has(s));
  }, [rows]);

  /* ── chart data ── */
  const donutData = React.useMemo(() => {
    const bs = stats?.byStatus ?? ({} as Record<NDAStatus, number>);
    return NDA_STATUS_FLOW.filter((s) => (bs[s] ?? 0) > 0).map((s) => ({
      name: getLabel('ndaStatus', s),
      value: bs[s] ?? 0,
      color: STATUS_COLOR[s] ?? CHART_COLORS[0],
    }));
  }, [stats]);

  const trendData = React.useMemo(
    () => trend.map((t) => ({ label: t.label, sent: t.sent, signed: t.signed })),
    [trend],
  );

  /* ── mutations (mock) ── */
  const applyPatch = React.useCallback(
    (id: string, patch: Partial<NDA>, addVersion?: NDAVersion) => {
      setRows((prev) =>
        prev
          ? prev.map((n) =>
              n.id === id
                ? {
                    ...n,
                    ...patch,
                    versions: addVersion ? [...n.versions, addVersion] : n.versions,
                  }
                : n,
            )
          : prev,
      );
      const target = rows?.find((n) => n.id === id);
      const fullPatch: Partial<NDA> = addVersion
        ? { ...patch, versions: [...(target?.versions ?? []), addVersion] }
        : patch;
      void ndaService.update(id, fullPatch);
      refreshStats();
    },
    [rows, refreshStats],
  );

  async function markSent(n: NDA) {
    await new Promise((r) => setTimeout(r, 500));
    applyPatch(n.id, { status: 'sent', dateSent: n.dateSent ?? TODAY });
    toast({ variant: 'success', title: 'NDA marked as sent', description: `${n.reference} sent to ${companyName(n.companyId)}.` });
  }

  async function markSigned(n: NDA) {
    await new Promise((r) => setTimeout(r, 500));
    const effective = n.effectiveDate ?? TODAY;
    applyPatch(
      n.id,
      { status: 'fully_signed', effectiveDate: effective },
      { version: nextVersion(n), date: TODAY, note: 'Counter-signed copy filed' },
    );
    toast({ variant: 'success', title: 'NDA fully signed', description: `${n.reference} is now in force.` });
  }

  async function requestRevision(n: NDA, note: string) {
    await new Promise((r) => setTimeout(r, 500));
    applyPatch(
      n.id,
      { status: 'changes_requested', requestedModifications: note || n.requestedModifications },
      { version: nextVersion(n), date: TODAY, note: note ? `Revision requested: ${note}` : 'Revision requested' },
    );
    toast({ variant: 'warning', title: 'Revision requested', description: `Changes flagged on ${n.reference}.` });
  }

  async function replaceDocument(n: NDA) {
    await new Promise((r) => setTimeout(r, 500));
    applyPatch(n.id, {}, { version: nextVersion(n), date: TODAY, note: 'Document replaced with updated draft' });
    toast({ variant: 'success', title: 'Document replaced', description: `New version filed on ${n.reference}.` });
  }

  async function addNote(n: NDA, note: string) {
    await new Promise((r) => setTimeout(r, 500));
    applyPatch(n.id, {}, { version: nextVersion(n), date: TODAY, note });
    toast({ variant: 'success', title: 'Note added', description: `Note saved to ${n.reference}.` });
  }

  function download(n: NDA) {
    toast({ variant: 'info', title: 'Download started', description: `Preparing ${n.reference}.pdf…` });
  }

  function createFollowUpTask(n: NDA) {
    toast({
      variant: 'success',
      title: 'Follow-up task created',
      description: `Reminder to chase ${n.reference} added to your tasks.`,
    });
  }

  function handleCreate(n: NDA) {
    setRows((prev) => (prev ? [n, ...prev] : [n]));
    refreshStats();
    void analyticsService.ndaCompletionTrend().then(setTrend);
  }

  const detailItem = React.useMemo(
    () => (detailId ? (rows ?? []).find((n) => n.id === detailId) ?? null : null),
    [detailId, rows],
  );

  /* ── table columns ── */
  const columns: Column<NDA>[] = [
    {
      key: 'reference',
      header: 'Reference',
      sortValue: (n) => n.reference,
      cell: (n) => <span className="font-mono text-sm font-medium text-foreground">{n.reference}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      sortValue: (n) => companyName(n.companyId),
      cell: (n) => {
        const c = companies.get(n.companyId);
        if (!c) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Link
            href={'/admin/companies/' + c.id}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-brand-teal hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-base leading-none">{flagEmoji(c.countryCode)}</span>
            <span className="truncate">{c.tradingName || c.legalName}</span>
          </Link>
        );
      },
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (n) => getLabel('ndaType', n.type),
      cell: (n) => <StatusBadge kind="ndaType" value={n.type} />,
      hideable: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (n) => NDA_STATUS_FLOW.indexOf(n.status),
      cell: (n) => <StatusBadge kind="ndaStatus" value={n.status} />,
    },
    {
      key: 'sent',
      header: 'Sent',
      align: 'right',
      sortable: true,
      sortValue: (n) => (n.dateSent ? new Date(n.dateSent).getTime() : 0),
      cell: (n) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(n.dateSent, locale)}</span>,
      hideable: true,
    },
    {
      key: 'effective',
      header: 'Effective',
      align: 'right',
      sortable: true,
      sortValue: (n) => (n.effectiveDate ? new Date(n.effectiveDate).getTime() : 0),
      cell: (n) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(n.effectiveDate, locale)}</span>,
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'expiry',
      header: 'Expiry',
      align: 'right',
      sortable: true,
      sortValue: (n) => (n.expiryDate ? new Date(n.expiryDate).getTime() : 0),
      cell: (n) => {
        if (!n.expiryDate) return <span className="text-sm text-muted-foreground">—</span>;
        const { soon, days } = expiringWindow(n.expiryDate);
        return (
          <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
            <span className={cn('text-sm', soon ? 'font-medium text-warning' : 'text-muted-foreground')}>
              {formatDate(n.expiryDate, locale)}
            </span>
            {soon ? (
              <Badge variant="warning" className="text-2xs">
                {days}d
              </Badge>
            ) : null}
          </span>
        );
      },
      hideable: true,
    },
    {
      key: 'versions',
      header: 'Versions',
      align: 'right',
      sortable: true,
      sortValue: (n) => n.versions.length,
      cell: (n) => (
        <Badge variant="muted" className="tabular text-2xs">
          {n.versions.length}
        </Badge>
      ),
      hideable: true,
    },
  ];

  /* ── toolbar (filters) ── */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fStatus} onValueChange={setFStatus}>
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {statusOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {getLabel('ndaStatus', s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fType} onValueChange={setFType}>
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {NDA_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {getLabel('ndaType', t)}
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
  function rowActions(n: NDA) {
    const isSigned = n.status === 'fully_signed';
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setDetailId(n.id)}>
            <Eye />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => download(n)}>
            <Download />
            Download
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Lifecycle</DropdownMenuLabel>
          <DropdownMenuItem disabled={n.status === 'sent' || isSigned} onSelect={() => void markSent(n)}>
            <Send />
            Mark sent
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isSigned} onSelect={() => void markSigned(n)}>
            <PenLine />
            Mark signed
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setRevisionFor(n)}>
            <RotateCcw />
            Request revision
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void replaceDocument(n)}>
            <FileUp />
            Replace document
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setNoteFor(n)}>
            <StickyNote />
            Add note
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => createFollowUpTask(n)}>
            <ListChecks />
            Create follow-up task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(n: NDA) {
    const { soon, days } = expiringWindow(n.expiryDate);
    return (
      <Card className="p-3" onClick={() => setDetailId(n.id)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-foreground">{n.reference}</p>
            <p className="truncate text-xs text-muted-foreground">{companyName(n.companyId)}</p>
          </div>
          <StatusBadge kind="ndaStatus" value={n.status} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge kind="ndaType" value={n.type} />
          <Badge variant="muted" className="text-2xs tabular">
            v{n.versions.length}
          </Badge>
          {soon ? (
            <Badge variant="warning" className="text-2xs">
              Expires {days}d
            </Badge>
          ) : null}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Sent {formatDate(n.dateSent, locale)} · Expiry {formatDate(n.expiryDate, locale)}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="NDAs & Documents"
        subtitle="Prepare, track and file confidentiality agreements across every relationship."
        actions={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload />
              Upload NDA
            </Button>
            <Button variant="gold" onClick={() => setCreateOpen(true)}>
              <Plus />
              New NDA
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total NDAs" value={stats?.total ?? 0} icon={FileSignature} tone="gold" />
        <StatCard label="Awaiting signature" value={stats?.awaitingSignature ?? 0} icon={Clock} tone="warning" delay={0.05} />
        <StatCard label="Fully signed" value={stats?.signed ?? 0} icon={CheckCircle2} tone="success" delay={0.1} />
        <StatCard label="To prepare" value={stats?.toPrepare ?? 0} icon={FileClock} tone="info" delay={0.15} />
        <StatCard
          label="Expiring soon"
          value={stats?.expiringSoon ?? 0}
          icon={AlertTriangle}
          tone="danger"
          hint="within 60 days"
          delay={0.2}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="NDA status mix"
          description="Distribution across the agreement lifecycle"
          loading={rows === null}
          isEmpty={donutData.length === 0}
        >
          <DonutChart data={donutData} centerLabel="NDAs" />
        </ChartCard>

        <ChartCard
          title="Sent vs. signed over time"
          description="Monthly NDA throughput"
          loading={rows === null}
          isEmpty={trendData.length === 0}
        >
          <TrendChart
            data={trendData}
            xKey="label"
            series={[
              { key: 'sent', name: 'Sent', color: CHART_COLORS[2], type: 'area' },
              { key: 'signed', name: 'Signed', color: CHART_COLORS[1], type: 'area' },
            ]}
          />
        </ChartCard>
      </div>

      {/* Table */}
      <DataTable<NDA>
        data={filtered}
        columns={columns}
        getRowId={(n) => n.id}
        loading={rows === null}
        searchable
        searchPlaceholder="Search reference, company, type…"
        searchValue={(n) =>
          [n.reference, companyName(n.companyId), getLabel('ndaType', n.type), getLabel('ndaStatus', n.status)]
            .filter(Boolean)
            .join(' ')
        }
        pageSize={12}
        rowActions={rowActions}
        onRowClick={(n) => setDetailId(n.id)}
        toolbar={toolbar}
        enableColumnVisibility
        enableDensityToggle
        mobileCard={mobileCard}
        emptyTitle="No NDAs match"
        emptyDescription="Adjust the filters or create a new agreement."
        exportFilename="ndas"
        storageKey="ndas-table"
      />

      {/* Detail sheet */}
      <DetailSheet
        nda={detailItem}
        company={detailItem ? companies.get(detailItem.companyId) ?? null : null}
        locale={locale}
        onOpenChange={(o) => !o && setDetailId(null)}
        onMarkSent={markSent}
        onMarkSigned={markSigned}
        onRequestRevision={(n) => {
          setDetailId(null);
          setRevisionFor(n);
        }}
        onReplace={replaceDocument}
        onAddNote={(n) => {
          setDetailId(null);
          setNoteFor(n);
        }}
        onDownload={download}
        onFollowUp={createFollowUpTask}
        onOpenCompany={(id) => {
          setDetailId(null);
          router.push('/admin/companies/' + id);
        }}
      />

      {/* New NDA dialog */}
      <CreateNdaDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={[...companies.values()]}
        onCreated={handleCreate}
      />

      {/* Upload NDA dialog */}
      <UploadNdaDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        companies={[...companies.values()]}
        onCreated={handleCreate}
      />

      {/* Add note dialog */}
      <NoteDialog
        nda={noteFor}
        onOpenChange={(o) => !o && setNoteFor(null)}
        onSubmit={async (n, note) => {
          await addNote(n, note);
          setNoteFor(null);
        }}
      />

      {/* Request revision dialog */}
      <RevisionDialog
        nda={revisionFor}
        onOpenChange={(o) => !o && setRevisionFor(null)}
        onSubmit={async (n, note) => {
          await requestRevision(n, note);
          setRevisionFor(null);
        }}
      />
    </div>
  );
}

/* ────────────────────────────── Helpers ────────────────────────────── */

/** Compute the next semantic version label (v1.0 → v1.1 …). */
function nextVersion(n: NDA): string {
  const last = n.versions[n.versions.length - 1]?.version ?? 'v1.0';
  const m = /^v?(\d+)\.(\d+)$/.exec(last.trim());
  if (!m) return `v${n.versions.length + 1}.0`;
  return `v${m[1]}.${Number(m[2]) + 1}`;
}

/* ────────────────────────────── Detail sheet ────────────────────────────── */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value ?? '—'}</div>
    </div>
  );
}

function DetailSheet({
  nda,
  company,
  locale,
  onOpenChange,
  onMarkSent,
  onMarkSigned,
  onRequestRevision,
  onReplace,
  onAddNote,
  onDownload,
  onFollowUp,
  onOpenCompany,
}: {
  nda: NDA | null;
  company: Company | null;
  locale: Locale;
  onOpenChange: (open: boolean) => void;
  onMarkSent: (n: NDA) => Promise<void>;
  onMarkSigned: (n: NDA) => Promise<void>;
  onRequestRevision: (n: NDA) => void;
  onReplace: (n: NDA) => Promise<void>;
  onAddNote: (n: NDA) => void;
  onDownload: (n: NDA) => void;
  onFollowUp: (n: NDA) => void;
  onOpenCompany: (id: string) => void;
}) {
  const isSigned = nda?.status === 'fully_signed';
  const { soon, days } = expiringWindow(nda?.expiryDate);

  // newest version first for the timeline
  const timeline = React.useMemo(
    () =>
      nda
        ? [...nda.versions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        : [],
    [nda],
  );

  return (
    <Sheet open={!!nda} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg sm:max-w-lg">
        {nda ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy/10 text-brand-navy">
                  <FileSignature className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <SheetTitle className="font-mono">{nda.reference}</SheetTitle>
                  <SheetDescription className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {company ? company.tradingName || company.legalName : 'Unknown company'}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="-mx-6 flex-1 overflow-y-auto px-6">
              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge kind="ndaStatus" value={nda.status} />
                <StatusBadge kind="ndaType" value={nda.type} />
                {soon ? (
                  <Badge variant="warning" className="gap-1 text-2xs">
                    <AlertTriangle className="h-3 w-3" />
                    Expires in {days}d
                  </Badge>
                ) : null}
              </div>

              {/* Company shortcut */}
              {company ? (
                <button
                  type="button"
                  onClick={() => onOpenCompany(company.id)}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-teal hover:underline"
                >
                  <span className="text-base leading-none">{flagEmoji(company.countryCode)}</span>
                  View company profile
                </button>
              ) : null}

              {/* Key facts */}
              <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3">
                <DetailRow label="Date prepared" value={formatDate(nda.datePrepared, locale)} />
                <DetailRow label="Date sent" value={formatDate(nda.dateSent, locale)} />
                <DetailRow label="Effective date" value={formatDate(nda.effectiveDate, locale)} />
                <DetailRow
                  label="Expiry date"
                  value={
                    <span className={cn(soon && 'text-warning')}>{formatDate(nda.expiryDate, locale)}</span>
                  }
                />
                <DetailRow label="Internal signatory" value={nda.internalSignatory} />
                <DetailRow label="External signatory" value={nda.externalSignatory} />
                {nda.governingLaw ? <DetailRow label="Governing law" value={nda.governingLaw} /> : null}
                {nda.jurisdiction ? <DetailRow label="Jurisdiction" value={nda.jurisdiction} /> : null}
                {nda.templateVersion ? <DetailRow label="Template" value={nda.templateVersion} /> : null}
                {nda.accessLevelUnlocked ? (
                  <DetailRow
                    label="Unlocks access"
                    value={<StatusBadge kind="documentAccessLevel" value={nda.accessLevelUnlocked} />}
                  />
                ) : null}
              </div>

              {/* Requested modifications */}
              {nda.requestedModifications ? (
                <div className="mt-4 rounded-lg border border-warning/40 bg-warning-subtle/50 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warning">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Requested modifications
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{nda.requestedModifications}</p>
                </div>
              ) : null}

              {/* Version history timeline */}
              <Separator className="my-4" />
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <History className="h-4 w-4 text-muted-foreground" />
                Version history ({nda.versions.length})
              </h3>
              {timeline.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  No versions recorded yet.
                </p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {timeline.map((v, i) => (
                    <li key={`${v.version}-${v.date}-${i}`} className="relative">
                      <span
                        className={cn(
                          'absolute -left-[1.42rem] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-background',
                          i === 0 ? 'bg-brand-teal' : 'bg-muted-foreground/40',
                        )}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">{v.version}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(v.date, locale)}</span>
                        {i === 0 ? (
                          <Badge variant="info" className="text-2xs">
                            Latest
                          </Badge>
                        ) : null}
                      </div>
                      {v.note ? <p className="mt-0.5 text-sm text-muted-foreground">{v.note}</p> : null}
                      {v.fileRef ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          {v.fileRef.name}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}

              {/* Signed files */}
              {nda.signedFiles && nda.signedFiles.length > 0 ? (
                <>
                  <Separator className="my-4" />
                  <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <ShieldCheck className="h-4 w-4 text-success" />
                    Signed files
                  </h3>
                  <ul className="space-y-2">
                    {nda.signedFiles.map((f) => (
                      <li
                        key={f.id}
                        className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <Button variant="ghost" size="icon-sm" aria-label="Download" onClick={() => onDownload(nda)}>
                          <Download />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>

            <SheetFooter className="flex-row flex-wrap gap-2 sm:justify-start">
              <Button variant="outline" size="sm" onClick={() => onDownload(nda)}>
                <Download />
                Download
              </Button>
              <Button variant="outline" size="sm" disabled={nda.status === 'sent' || isSigned} onClick={() => void onMarkSent(nda)}>
                <Send />
                Mark sent
              </Button>
              <Button variant="outline" size="sm" onClick={() => onRequestRevision(nda)}>
                <RotateCcw />
                Request revision
              </Button>
              <Button variant="outline" size="sm" onClick={() => void onReplace(nda)}>
                <FileUp />
                Replace
              </Button>
              <Button variant="outline" size="sm" onClick={() => onAddNote(nda)}>
                <StickyNote />
                Add note
              </Button>
              <Button variant="outline" size="sm" onClick={() => onFollowUp(nda)}>
                <ListChecks />
                Follow-up task
              </Button>
              <Button variant="success" size="sm" disabled={isSigned} onClick={() => void onMarkSigned(nda)}>
                <PenLine />
                Mark signed
              </Button>
            </SheetFooter>
          </>
        ) : (
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              NDA
            </SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* ────────────────────────────── New NDA dialog ────────────────────────────── */

function newReference(): string {
  return 'NDA-2026-' + String(Math.floor(1000 + Math.random() * 9000));
}

function CreateNdaDialog({
  open,
  onOpenChange,
  companies,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onCreated: (n: NDA) => void;
}) {
  const [companyId, setCompanyId] = React.useState('');
  const [type, setType] = React.useState<NDAType>('mutual');
  const [status, setStatus] = React.useState<NDAStatus>('to_prepare');
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const sortedCompanies = React.useMemo(
    () => [...companies].sort((a, b) => (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName)),
    [companies],
  );

  function reset() {
    setCompanyId('');
    setType('mutual');
    setStatus('to_prepare');
    setNote('');
  }

  const valid = companyId !== '';

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    const company = companies.find((c) => c.id === companyId);
    const reference = newReference();
    const nda: NDA = {
      id: uid('nda'),
      reference,
      companyId,
      type,
      templateVersion: type === 'mutual' ? 'Mutual NDA v3.1' : 'One-way NDA v2.4',
      status,
      datePrepared: TODAY,
      dateSent: status === 'sent' ? TODAY : undefined,
      internalSignatory: 'ITALPROTEIN S.r.l.',
      externalSignatory: company?.legalName,
      governingLaw: 'Italian law',
      jurisdiction: 'Court of Milan',
      versions: [
        {
          version: 'v1.0',
          date: TODAY,
          note: note.trim() || 'Initial draft prepared',
        },
      ],
      createdAt: TODAY,
    };

    await ndaService.create(nda);
    onCreated(nda);
    toast({
      variant: 'success',
      title: 'NDA created',
      description: `${reference} for ${company?.tradingName || company?.legalName || 'company'} created.`,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New NDA</DialogTitle>
          <DialogDescription>Draft a confidentiality agreement and track it through signing.</DialogDescription>
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

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as NDAType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NDA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {getLabel('ndaType', t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Initial status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as NDAStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CREATABLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getLabel('ndaStatus', s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nda-note">Preparation note</Label>
            <Textarea
              id="nda-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Template used, special clauses, affiliates covered…"
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
                <Plus className="h-4 w-4" />
                Create NDA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Upload NDA dialog ────────────────────────────── */

function UploadNdaDialog({
  open,
  onOpenChange,
  companies,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onCreated: (n: NDA) => void;
}) {
  const [companyId, setCompanyId] = React.useState('');
  const [type, setType] = React.useState<NDAType>('mutual');
  const [fileName, setFileName] = React.useState('');
  const [signed, setSigned] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const sortedCompanies = React.useMemo(
    () => [...companies].sort((a, b) => (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName)),
    [companies],
  );

  function reset() {
    setCompanyId('');
    setType('mutual');
    setFileName('');
    setSigned(false);
  }

  const valid = companyId !== '' && fileName.trim().length > 0;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    const company = companies.find((c) => c.id === companyId);
    const reference = newReference();
    const name = fileName.trim();
    const nda: NDA = {
      id: uid('nda'),
      reference,
      companyId,
      type,
      status: signed ? 'fully_signed' : 'under_review',
      datePrepared: TODAY,
      dateSent: TODAY,
      effectiveDate: signed ? TODAY : undefined,
      internalSignatory: 'ITALPROTEIN S.r.l.',
      externalSignatory: company?.legalName,
      versions: [
        {
          version: 'v1.0',
          date: TODAY,
          note: signed ? 'Signed document uploaded' : 'Document uploaded for review',
          fileRef: {
            id: uid('file'),
            name: name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`,
            fileType: 'pdf',
            uploadedAt: TODAY,
          },
        },
      ],
      signedFiles: signed
        ? [
            {
              id: uid('file'),
              name: name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`,
              fileType: 'pdf',
              uploadedAt: TODAY,
            },
          ]
        : undefined,
      createdAt: TODAY,
    };

    await ndaService.create(nda);
    onCreated(nda);
    toast({
      variant: 'success',
      title: 'NDA uploaded',
      description: `${reference} filed for ${company?.tradingName || company?.legalName || 'company'}.`,
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload NDA</DialogTitle>
          <DialogDescription>File an existing agreement document against a company record.</DialogDescription>
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

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as NDAType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NDA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {getLabel('ndaType', t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Document state</Label>
            <Select value={signed ? 'signed' : 'review'} onValueChange={(v) => setSigned(v === 'signed')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="review">For review</SelectItem>
                <SelectItem value="signed">Fully signed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nda-file">Document name *</Label>
            <Input
              id="nda-file"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="e.g. Mutual-NDA-Signed.pdf"
            />
            <p className="text-xs text-muted-foreground">
              Drag-and-drop is simulated in this prototype — enter the file name to file it.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>
            {submitting ? (
              'Uploading…'
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload & file
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Add note dialog ────────────────────────────── */

function NoteDialog({
  nda,
  onOpenChange,
  onSubmit,
}: {
  nda: NDA | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (n: NDA, note: string) => Promise<void>;
}) {
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (nda) setNote('');
  }, [nda]);

  async function submit() {
    if (!nda || !note.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(nda, note.trim());
    setSubmitting(false);
  }

  return (
    <Dialog open={!!nda} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
          <DialogDescription>
            {nda ? `Append a note to ${nda.reference}'s version history.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="note-body">Note</Label>
          <Textarea
            id="note-body"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add context — a call summary, legal observation, reminder…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!note.trim() || submitting}>
            {submitting ? 'Saving…' : (
              <>
                <StickyNote className="h-4 w-4" />
                Save note
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Request revision dialog ────────────────────────────── */

function RevisionDialog({
  nda,
  onOpenChange,
  onSubmit,
}: {
  nda: NDA | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (n: NDA, note: string) => Promise<void>;
}) {
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (nda) setNote(nda.requestedModifications ?? '');
  }, [nda]);

  async function submit() {
    if (!nda || !note.trim() || submitting) return;
    setSubmitting(true);
    await onSubmit(nda, note.trim());
    setSubmitting(false);
  }

  return (
    <Dialog open={!!nda} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request revision</DialogTitle>
          <DialogDescription>
            {nda ? `Flag changes required on ${nda.reference} and notify the counterparty.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="revision-body">Requested modifications</Label>
          <Textarea
            id="revision-body"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe the clauses or terms that need to change…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="default" onClick={submit} disabled={!note.trim() || submitting}>
            {submitting ? 'Sending…' : (
              <>
                <RotateCcw className="h-4 w-4" />
                Request revision
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
