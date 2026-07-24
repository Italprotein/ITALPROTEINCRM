'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { format, subMonths } from 'date-fns';
import {
  Banknote,
  Wallet,
  AlertTriangle,
  FileText,
  ReceiptText,
  Plus,
  MoreHorizontal,
  Eye,
  Download,
  CheckCircle2,
  Send,
  X,
} from 'lucide-react';

import { financeService, companyService } from '@/lib/mock-services';
import type {
  FinanceDocument,
  FinanceDocKind,
  PaymentStatus,
  Company,
  Currency,
  Locale,
} from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatting';
import { uid } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { can } from '@/lib/permissions';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard, TrendChart, DonutChart, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
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
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

const KINDS: FinanceDocKind[] = ['quote', 'order', 'invoice', 'credit_note'];

const PAYMENT_STATUSES: PaymentStatus[] = [
  'draft',
  'pending',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
  'refunded',
];

const CURRENCIES: Currency[] = ['EUR', 'USD', 'GBP', 'CHF'];

/** Indicative fixed rates → EUR, so a single-currency revenue trend is coherent. */
const TO_EUR: Record<Currency, number> = { EUR: 1, USD: 0.92, GBP: 1.17, CHF: 1.04 };

/** Trailing 10 months ending at the current month. */
const TREND_MONTH_DATES = Array.from({ length: 10 }, (_, i) => subMonths(new Date(), 9 - i));

const TREND_MONTHS = TREND_MONTH_DATES.map((d) => format(d, 'yyyy-MM'));

const MONTH_LABELS: Record<string, string> = Object.fromEntries(
  TREND_MONTH_DATES.map((d) => [format(d, 'yyyy-MM'), format(d, 'MMM yy')]),
);

/* ────────────────────────────── Helpers ────────────────────────────── */

function lineNet(li: FinanceDocument['lineItems'][number]): number {
  const gross = li.quantity * li.pricePerUnit;
  const discount = li.discountPct ? gross * (li.discountPct / 100) : 0;
  return gross - discount;
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function FinancePage() {
  const t = useTranslations('AdminFinance');
  const locale = useLocale() as Locale;
  const { session } = useSession();
  const role = session?.role;
  const canFinanceEdit = !!role && can(role, 'finance.edit');

  const [rows, setRows] = React.useState<FinanceDocument[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof financeService.getStatistics>> | null>(null);

  // filters
  const [fKind, setFKind] = React.useState<string>(ALL);
  const [fStatus, setFStatus] = React.useState<string>(ALL);
  const [tab, setTab] = React.useState<string>('all');

  // dialogs / sheet
  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<FinanceDocument | null>(null);

  React.useEffect(() => {
    financeService.list().then(setRows);
    financeService.getStatistics().then(setStats);
    companyService.list().then((list) => setCompanyMap(new Map(list.map((c) => [c.id, c]))));
  }, []);

  const companyName = React.useCallback(
    (id: string) => {
      const c = companyMap.get(id);
      return c ? c.tradingName || c.legalName : '—';
    },
    [companyMap],
  );

  /* ── chart data ── */
  const revenueTrend = React.useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const m of TREND_MONTHS) byMonth.set(m, 0);
    for (const d of rows ?? []) {
      if (d.kind !== 'invoice') continue;
      const month = d.issueDate.slice(0, 7);
      if (!byMonth.has(month)) continue;
      const eur = d.total * (TO_EUR[d.currency] ?? 1);
      byMonth.set(month, (byMonth.get(month) ?? 0) + eur);
    }
    return TREND_MONTHS.map((m) => ({
      month: m,
      label: MONTH_LABELS[m] ?? m,
      value: Math.round(byMonth.get(m) ?? 0),
    }));
  }, [rows]);

  const statusDonut = React.useMemo(() => {
    if (!stats) return [];
    return (Object.entries(stats.byStatus) as [PaymentStatus, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v], i) => ({
        name: getLabel('paymentStatus', k),
        value: v,
        color: CHART_COLORS[i % CHART_COLORS.length],
      }));
  }, [stats]);

  /* ── filtered data ── */
  const filtered = React.useMemo(() => {
    let data = rows ?? [];
    if (tab !== 'all') data = data.filter((d) => d.kind === tab);
    if (fKind !== ALL) data = data.filter((d) => d.kind === fKind);
    if (fStatus !== ALL) data = data.filter((d) => d.paymentStatus === fStatus);
    return data;
  }, [rows, tab, fKind, fStatus]);

  const activeFilterCount = (fKind !== ALL ? 1 : 0) + (fStatus !== ALL ? 1 : 0);
  const resetFilters = () => {
    setFKind(ALL);
    setFStatus(ALL);
  };

  /* ── tab counts ── */
  const counts = React.useMemo(() => {
    const all = rows ?? [];
    return {
      all: all.length,
      quote: all.filter((d) => d.kind === 'quote').length,
      order: all.filter((d) => d.kind === 'order').length,
      invoice: all.filter((d) => d.kind === 'invoice').length,
    };
  }, [rows]);

  /* ── mutations (mock) ── */
  async function applyPatch(id: string, patch: Partial<FinanceDocument>): Promise<boolean> {
    const snapshotRows = rows;
    const snapshotViewing = viewing;
    setRows((prev) => (prev ? prev.map((d) => (d.id === id ? { ...d, ...patch } : d)) : prev));
    setViewing((v) => (v && v.id === id ? { ...v, ...patch } : v));
    try {
      await financeService.update(id, patch);
      return true;
    } catch {
      setRows(snapshotRows);
      setViewing(snapshotViewing);
      return false;
    }
  }

  async function markPaid(d: FinanceDocument) {
    if (d.paymentStatus === 'paid') return;
    await new Promise((r) => setTimeout(r, 500));
    const ok = await applyPatch(d.id, {
      paymentStatus: 'paid',
      paidAmount: d.total,
      outstandingAmount: 0,
      overdueAmount: 0,
    });
    if (!ok) {
      toast({ variant: 'danger', title: 'Action failed', description: 'The payment status could not be updated. Please try again.' });
      return;
    }
    // Bump the Revenue KPI only after the write succeeds so it stays in sync.
    setStats((prev) =>
      prev
        ? {
            ...prev,
            revenue: d.kind === 'invoice' ? prev.revenue + d.total * (TO_EUR[d.currency] ?? 1) : prev.revenue,
          }
        : prev,
    );
    toast({
      variant: 'success',
      title: t('toastMarkedPaidTitle'),
      description: t('toastMarkedPaidDescription', { reference: d.reference }),
    });
  }

  async function downloadPdf(d: FinanceDocument) {
    await new Promise((r) => setTimeout(r, 400));
    toast({
      variant: 'info',
      title: t('toastPdfGeneratedTitle'),
      description: t('toastPdfGeneratedDescription', { reference: d.reference }),
    });
  }

  async function sendReminder(d: FinanceDocument) {
    await new Promise((r) => setTimeout(r, 400));
    toast({
      variant: 'warning',
      title: t('toastReminderSentTitle'),
      description: t('toastReminderSentDescription', { reference: d.reference }),
    });
  }

  function handleCreate(d: FinanceDocument) {
    setRows((prev) => (prev ? [d, ...prev] : [d]));
    setStats((prev) =>
      prev ? { ...prev, total: prev.total + 1, quotes: prev.quotes + 1 } : prev,
    );
    setTab('quote');
  }

  /* ── table columns ── */
  const columns: Column<FinanceDocument>[] = [
    {
      key: 'reference',
      header: t('columnReference'),
      sortValue: (d) => d.reference,
      cell: (d) => <span className="font-medium text-foreground">{d.reference}</span>,
    },
    {
      key: 'kind',
      header: t('columnKind'),
      sortValue: (d) => d.kind,
      cell: (d) => <StatusBadge kind="financeDocKind" value={d.kind} />,
    },
    {
      key: 'company',
      header: t('columnCompany'),
      sortValue: (d) => companyName(d.companyId),
      cell: (d) => {
        const c = companyMap.get(d.companyId);
        if (!c) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Link
            href={'/admin/companies/' + c.id}
            className="text-sm font-medium text-foreground hover:text-brand-teal hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.tradingName || c.legalName}
          </Link>
        );
      },
      hideable: true,
    },
    {
      key: 'issueDate',
      header: t('columnIssueDate'),
      align: 'right',
      sortable: true,
      sortValue: (d) => new Date(d.issueDate).getTime(),
      cell: (d) => <span className="whitespace-nowrap text-sm">{formatDate(d.issueDate, locale)}</span>,
      hideable: true,
    },
    {
      key: 'dueDate',
      header: t('columnDueDate'),
      align: 'right',
      sortable: true,
      sortValue: (d) => (d.dueDate ? new Date(d.dueDate).getTime() : 0),
      cell: (d) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(d.dueDate, locale)}</span>
      ),
      hideable: true,
    },
    {
      key: 'total',
      header: t('columnTotal'),
      align: 'right',
      sortable: true,
      sortValue: (d) => d.total * (TO_EUR[d.currency] ?? 1),
      cell: (d) => (
        <span className="whitespace-nowrap font-medium tabular text-foreground">
          {formatCurrency(d.total, d.currency, locale)}
        </span>
      ),
    },
    {
      key: 'paymentStatus',
      header: t('columnPaymentStatus'),
      sortValue: (d) => d.paymentStatus,
      cell: (d) => <StatusBadge kind="paymentStatus" value={d.paymentStatus} />,
    },
    {
      key: 'outstanding',
      header: t('columnOutstanding'),
      align: 'right',
      sortable: true,
      sortValue: (d) => (d.outstandingAmount ?? 0) * (TO_EUR[d.currency] ?? 1),
      cell: (d) =>
        d.outstandingAmount && d.outstandingAmount > 0 ? (
          <span className="whitespace-nowrap tabular text-warning-foreground">
            {formatCurrency(d.outstandingAmount, d.currency, locale)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      hideable: true,
    },
  ];

  /* ── toolbar ── */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fKind} onValueChange={setFKind}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder={t('filterKindPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('filterAllKinds')}</SelectItem>
          {KINDS.map((k) => (
            <SelectItem key={k} value={k}>
              {getLabel('financeDocKind', k)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fStatus} onValueChange={setFStatus}>
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder={t('filterStatusPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('filterAllStatuses')}</SelectItem>
          {PAYMENT_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {getLabel('paymentStatus', s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeFilterCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X />
          {t('filterClear', { count: activeFilterCount })}
        </Button>
      ) : null}
    </div>
  );

  /* ── row actions ── */
  function rowActions(d: FinanceDocument) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('rowActions')}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setViewing(d)}>
            <Eye />
            {t('actionView')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void downloadPdf(d)}>
            <Download />
            {t('actionDownloadPdf')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {canFinanceEdit && d.paymentStatus !== 'paid' ? (
            <DropdownMenuItem onSelect={() => void markPaid(d)}>
              <CheckCircle2 />
              {t('actionMarkPaid')}
            </DropdownMenuItem>
          ) : null}
          {d.kind === 'invoice' && (d.paymentStatus === 'overdue' || d.paymentStatus === 'pending') ? (
            <DropdownMenuItem onSelect={() => void sendReminder(d)}>
              <Send />
              {t('actionSendReminder')}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(d: FinanceDocument) {
    return (
      <Card className="p-3" onClick={() => setViewing(d)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{d.reference}</p>
            <p className="truncate text-xs text-muted-foreground">{companyName(d.companyId)}</p>
          </div>
          <StatusBadge kind="financeDocKind" value={d.kind} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <StatusBadge kind="paymentStatus" value={d.paymentStatus} />
          <span className="font-semibold tabular text-foreground">
            {formatCurrency(d.total, d.currency, locale)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('mobileIssued', { date: formatDate(d.issueDate, locale) })}</span>
          {d.dueDate ? <span>{t('mobileDue', { date: formatDate(d.dueDate, locale) })}</span> : null}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        actions={
          canFinanceEdit ? (
            <Button variant="gold" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t('newQuote')}
            </Button>
          ) : null
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('kpiRevenueLabel')}
          value={stats?.revenue ?? 0}
          icon={Banknote}
          tone="gold"
          format={(n) => formatCurrency(n, 'EUR', locale, { compact: true })}
          hint={t('kpiRevenueHint')}
        />
        <StatCard
          label={t('kpiOutstandingLabel')}
          value={stats?.outstanding ?? 0}
          icon={Wallet}
          tone="warning"
          format={(n) => formatCurrency(n, 'EUR', locale, { compact: true })}
          hint={t('kpiOutstandingHint')}
          delay={0.05}
        />
        <StatCard
          label={t('kpiOverdueLabel')}
          value={stats?.overdue ?? 0}
          icon={AlertTriangle}
          tone="danger"
          format={(n) => formatCurrency(n, 'EUR', locale, { compact: true })}
          hint={t('kpiOverdueHint')}
          delay={0.1}
        />
        <StatCard
          label={t('kpiQuotesLabel')}
          value={stats?.quotes ?? 0}
          icon={FileText}
          tone="info"
          hint={t('kpiQuotesHint')}
          delay={0.15}
        />
        <StatCard
          label={t('kpiOrdersInvoicesLabel')}
          value={(stats?.orders ?? 0) + (stats?.invoices ?? 0)}
          icon={ReceiptText}
          tone="default"
          hint={t('kpiOrdersInvoicesHint', { orders: stats?.orders ?? 0, invoices: stats?.invoices ?? 0 })}
          delay={0.2}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={t('chartRevenueTitle')}
          description={t('chartRevenueDescription')}
          loading={rows === null}
          isEmpty={revenueTrend.every((d) => d.value === 0)}
        >
          <TrendChart
            data={revenueTrend}
            xKey="label"
            series={[{ key: 'value', name: t('chartRevenueSeries'), type: 'area', color: CHART_COLORS[1] }]}
          />
        </ChartCard>

        <ChartCard
          title={t('chartStatusTitle')}
          description={t('chartStatusDescription')}
          loading={rows === null}
          isEmpty={statusDonut.length === 0}
        >
          <DonutChart data={statusDonut} centerLabel={t('chartStatusCenterLabel')} />
        </ChartCard>
      </div>

      {/* Tabs + table */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t('tabAll', { count: counts.all })}</TabsTrigger>
          <TabsTrigger value="quote">{t('tabQuotes', { count: counts.quote })}</TabsTrigger>
          <TabsTrigger value="order">{t('tabOrders', { count: counts.order })}</TabsTrigger>
          <TabsTrigger value="invoice">{t('tabInvoices', { count: counts.invoice })}</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <DataTable<FinanceDocument>
            data={filtered}
            columns={columns}
            getRowId={(d) => d.id}
            loading={rows === null}
            searchable
            searchPlaceholder={t('searchPlaceholder')}
            searchValue={(d) => [d.reference, companyName(d.companyId)].join(' ')}
            pageSize={12}
            rowActions={rowActions}
            onRowClick={(d) => setViewing(d)}
            toolbar={toolbar}
            enableColumnVisibility
            enableDensityToggle
            mobileCard={mobileCard}
            emptyTitle={t('emptyTitle')}
            emptyDescription={t('emptyDescription')}
            exportFilename="finance"
            storageKey="finance-table"
          />
        </TabsContent>
      </Tabs>

      <CreateQuoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={[...companyMap.values()]}
        onCreated={handleCreate}
      />

      <DocumentSheet
        doc={viewing}
        locale={locale}
        companyName={viewing ? companyName(viewing.companyId) : ''}
        canMarkPaid={canFinanceEdit}
        onOpenChange={(o) => !o && setViewing(null)}
        onMarkPaid={markPaid}
        onDownload={downloadPdf}
        onSendReminder={sendReminder}
      />
    </div>
  );
}

/* ────────────────────────────── Document detail sheet ────────────────────────────── */

function DocumentSheet({
  doc,
  locale,
  companyName,
  canMarkPaid,
  onOpenChange,
  onMarkPaid,
  onDownload,
  onSendReminder,
}: {
  doc: FinanceDocument | null;
  locale: Locale;
  companyName: string;
  canMarkPaid: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkPaid: (d: FinanceDocument) => void | Promise<void>;
  onDownload: (d: FinanceDocument) => void | Promise<void>;
  onSendReminder: (d: FinanceDocument) => void | Promise<void>;
}) {
  const t = useTranslations('AdminFinance');
  return (
    <Sheet open={!!doc} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg overflow-y-auto">
        {doc ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <SheetTitle>{doc.reference}</SheetTitle>
                <StatusBadge kind="financeDocKind" value={doc.kind} />
              </div>
              <SheetDescription>
                {doc.dueDate
                  ? t('sheetDescriptionWithDue', {
                      company: companyName,
                      issueDate: formatDate(doc.issueDate, locale),
                      dueDate: formatDate(doc.dueDate, locale),
                    })
                  : t('sheetDescription', {
                      company: companyName,
                      issueDate: formatDate(doc.issueDate, locale),
                    })}
              </SheetDescription>
            </SheetHeader>

            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
              <span className="text-sm font-medium text-muted-foreground">{t('sheetPaymentStatus')}</span>
              <StatusBadge kind="paymentStatus" value={doc.paymentStatus} />
            </div>

            {/* Line items */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('sheetColItem')}</TableHead>
                    <TableHead className="text-right">{t('sheetColQty')}</TableHead>
                    <TableHead className="text-right">{t('sheetColUnitPrice')}</TableHead>
                    <TableHead className="text-right">{t('sheetColNet')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doc.lineItems.map((li) => (
                    <TableRow key={li.id}>
                      <TableCell className="font-medium text-foreground">{li.productName}</TableCell>
                      <TableCell className="text-right tabular">
                        {formatNumber(li.quantity, locale)} {li.unit}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatCurrency(li.pricePerUnit, doc.currency, locale)}
                        {li.discountPct ? (
                          <span className="ml-1 text-2xs text-success">−{li.discountPct}%</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular">
                        {formatCurrency(lineNet(li), doc.currency, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('sheetSubtotal')}</span>
                <span className="tabular text-foreground">{formatCurrency(doc.subtotal, doc.currency, locale)}</span>
              </div>
              {doc.discountTotal && doc.discountTotal > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('sheetDiscount')}</span>
                  <span className="tabular text-success">−{formatCurrency(doc.discountTotal, doc.currency, locale)}</span>
                </div>
              ) : null}
              {doc.shippingCost && doc.shippingCost > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('sheetShipping')}</span>
                  <span className="tabular text-foreground">{formatCurrency(doc.shippingCost, doc.currency, locale)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('sheetVat')}</span>
                <span className="tabular text-foreground">{formatCurrency(doc.vatTotal ?? 0, doc.currency, locale)}</span>
              </div>
              <Separator className="my-1.5" />
              <div className="flex items-center justify-between text-base font-semibold">
                <span className="text-foreground">{t('sheetTotal')}</span>
                <span className="tabular text-foreground">{formatCurrency(doc.total, doc.currency, locale)}</span>
              </div>
              {doc.outstandingAmount && doc.outstandingAmount > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('sheetOutstanding')}</span>
                  <span className="tabular text-warning-foreground">
                    {formatCurrency(doc.outstandingAmount, doc.currency, locale)}
                  </span>
                </div>
              ) : null}
            </div>

            {doc.paymentTerms ? (
              <p className="text-xs text-muted-foreground">{t('sheetTerms', { terms: doc.paymentTerms })}</p>
            ) : null}
            {doc.notes ? (
              <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{doc.notes}</p>
            ) : null}

            {/* Actions */}
            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => void onDownload(doc)}>
                <Download />
                {t('actionDownloadPdf')}
              </Button>
              {doc.kind === 'invoice' && (doc.paymentStatus === 'overdue' || doc.paymentStatus === 'pending') ? (
                <Button variant="outline" className="flex-1" onClick={() => void onSendReminder(doc)}>
                  <Send />
                  {t('actionSendReminder')}
                </Button>
              ) : null}
              {canMarkPaid && doc.paymentStatus !== 'paid' ? (
                <Button variant="success" className="flex-1" onClick={() => void onMarkPaid(doc)}>
                  <CheckCircle2 />
                  {t('actionMarkPaid')}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/* ────────────────────────────── Create quote dialog ────────────────────────────── */

function CreateQuoteDialog({
  open,
  onOpenChange,
  companies,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onCreated: (d: FinanceDocument) => void;
}) {
  const t = useTranslations('AdminFinance');
  const [companyId, setCompanyId] = React.useState('');
  const [currency, setCurrency] = React.useState<Currency>('EUR');
  const [productName, setProductName] = React.useState('Proamina® 100% Protein Sweetener');
  const [quantity, setQuantity] = React.useState('100');
  const [pricePerUnit, setPricePerUnit] = React.useState('42');
  const [vatPct, setVatPct] = React.useState('22');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const qty = Number(quantity) || 0;
  const price = Number(pricePerUnit) || 0;
  const vat = Number(vatPct) || 0;
  const subtotal = qty * price;
  const vatTotal = subtotal * (vat / 100);
  const total = subtotal + vatTotal;

  const valid = companyId.length > 0 && productName.trim().length > 0 && qty > 0 && price > 0;

  function reset() {
    setCompanyId('');
    setCurrency('EUR');
    setProductName('Proamina® 100% Protein Sweetener');
    setQuantity('100');
    setPricePerUnit('42');
    setVatPct('22');
    setNotes('');
  }

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    const nowIso = new Date().toISOString();
    const issueDate = nowIso.slice(0, 10);
    const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const year = issueDate.slice(0, 4);
    const seq = String(Math.floor(Math.random() * 9000) + 1000);

    const doc: FinanceDocument = {
      id: uid('fin'),
      kind: 'quote',
      reference: `QT-${year}-${seq}`,
      companyId,
      currency,
      issueDate,
      dueDate: due,
      lineItems: [
        {
          id: uid('li'),
          productName: productName.trim(),
          quantity: qty,
          unit: 'kg',
          pricePerUnit: price,
          pricePerKg: price,
          vatPct: vat,
        },
      ],
      subtotal,
      vatTotal,
      total,
      paymentTerms: '30 days net',
      paymentStatus: 'draft',
      notes: notes.trim() || undefined,
      createdAt: nowIso,
    };

    try {
      await financeService.create(doc);
      onCreated(doc);
      toast({ variant: 'success', title: t('toastQuoteCreatedTitle'), description: t('toastQuoteCreatedDescription', { reference: doc.reference }) });
      reset();
      onOpenChange(false);
    } catch {
      toast({ variant: 'danger', title: 'Action failed', description: 'The quote could not be created. Please try again.' });
    } finally {
      setSubmitting(false);
    }
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
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('fieldCompany')}</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder={t('fieldCompanyPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {companies
                  .slice()
                  .sort((a, b) => (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradingName || c.legalName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('fieldCurrency')}</Label>
            <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="productName">{t('fieldProduct')}</Label>
            <Input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity">{t('fieldQuantity')}</Label>
            <Input
              id="quantity"
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pricePerUnit">{t('fieldPrice')}</Label>
            <Input
              id="pricePerUnit"
              type="number"
              min={0}
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vatPct">{t('fieldVat')}</Label>
            <Input id="vatPct" type="number" min={0} value={vatPct} onChange={(e) => setVatPct(e.target.value)} />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">{t('fieldNotes')}</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('fieldNotesPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('dialogSubtotal')}</span>
            <span className="tabular text-foreground">{formatCurrency(subtotal, currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t('dialogVat')}</span>
            <span className="tabular text-foreground">{formatCurrency(vatTotal, currency)}</span>
          </div>
          <Separator className="my-1" />
          <div className="flex items-center justify-between font-semibold">
            <span className="text-foreground">{t('dialogTotal')}</span>
            <span className="tabular text-foreground">{formatCurrency(total, currency)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>
            {submitting ? t('creating') : t('createQuote')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
