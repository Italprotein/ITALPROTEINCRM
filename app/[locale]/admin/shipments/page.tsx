'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Truck,
  PlaneTakeoff,
  ShieldAlert,
  PackageCheck,
  AlertTriangle,
  Timer,
  Plus,
  MoreHorizontal,
  ExternalLink,
  Send,
  CheckCircle2,
  Flag,
  MapPin,
  X,
} from 'lucide-react';

import {
  shipmentService,
  companyService,
  sampleService,
  analyticsService,
} from '@/lib/mock-services';
import type {
  Shipment,
  Company,
  SampleRequest,
  Locale,
  CustomsStatus,
  Incoterm,
} from '@/lib/types';
import type { DerivedShipmentStatus } from '@/lib/mock-services';
import { getLabel } from '@/lib/labels';
import { formatDate, flagEmoji } from '@/lib/formatting';
import { uid } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { ChartCard, DonutChart, CategoryBar, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/lib/i18n/navigation';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Constants ────────────────────────────── */

const ALL = '__all__';

const DERIVED_STATUSES: DerivedShipmentStatus[] = ['preparing', 'in_transit', 'customs', 'delivered'];

const STATUS_META: Record<
  DerivedShipmentStatus,
  { labelKey: string; variant: 'success' | 'info' | 'warning' | 'muted' }
> = {
  delivered: { labelKey: 'delivered', variant: 'success' },
  in_transit: { labelKey: 'inTransit', variant: 'info' },
  customs: { labelKey: 'atCustoms', variant: 'warning' },
  preparing: { labelKey: 'preparing', variant: 'muted' },
};

const INCOTERMS: Incoterm[] = ['DAP', 'DDP', 'EXW', 'CPT', 'FCA', 'CIP'];

/* ────────────────────────────── Status badge ────────────────────────────── */

function ShipmentStatusCell({ shipment }: { shipment: Shipment }) {
  const t = useTranslations('AdminShipments');
  const status = shipmentService.deriveStatus(shipment);
  const meta = STATUS_META[status];
  const delayed = shipment.isDelayed && !shipment.actualDelivery;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant={meta.variant}>{t(meta.labelKey)}</Badge>
      {delayed ? <Badge variant="danger">{t('delayed')}</Badge> : null}
    </div>
  );
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function ShipmentsPage() {
  const t = useTranslations('AdminShipments');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [rows, setRows] = React.useState<Shipment[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [sampleMap, setSampleMap] = React.useState<Map<string, SampleRequest>>(new Map());
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof shipmentService.getStatistics>> | null>(null);
  const [statusBreakdown, setStatusBreakdown] = React.useState<{ name: string; value: number }[]>([]);

  // filters
  const [fStatus, setFStatus] = React.useState<string>(ALL);
  const [fCourier, setFCourier] = React.useState<string>(ALL);

  // dialogs
  const [createOpen, setCreateOpen] = React.useState(false);
  const [issueFor, setIssueFor] = React.useState<Shipment | null>(null);
  const [trackingFor, setTrackingFor] = React.useState<Shipment | null>(null);

  React.useEffect(() => {
    shipmentService.list().then(setRows);
    shipmentService.getStatistics().then(setStats);
    analyticsService.shipmentStatusBreakdown().then(setStatusBreakdown);
    companyService.list().then((list) => setCompanyMap(new Map(list.map((c) => [c.id, c]))));
    sampleService.list().then((list) => setSampleMap(new Map(list.map((s) => [s.id, s]))));
  }, []);

  /* ── derived option lists ── */
  const courierOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of rows ?? []) if (s.courier) set.add(s.courier);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  /* ── filtered data ── */
  const filtered = React.useMemo(() => {
    let data = rows ?? [];
    if (fStatus !== ALL) data = data.filter((s) => shipmentService.deriveStatus(s) === fStatus);
    if (fCourier !== ALL) data = data.filter((s) => s.courier === fCourier);
    return data;
  }, [rows, fStatus, fCourier]);

  const activeFilterCount = (fStatus !== ALL ? 1 : 0) + (fCourier !== ALL ? 1 : 0);
  const resetFilters = () => {
    setFStatus(ALL);
    setFCourier(ALL);
  };

  /* ── chart data ── */
  const donutData = React.useMemo(
    () =>
      statusBreakdown.map((d, i) => ({
        name: d.name,
        value: d.value,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [statusBreakdown],
  );

  const courierChart = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const s of rows ?? []) {
      const key = s.courier ?? 'Unassigned';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  /* ── mutations (mock) ── */
  function applyPatch(id: string, patch: Partial<Shipment>) {
    setRows((prev) => (prev ? prev.map((s) => (s.id === id ? { ...s, ...patch } : s)) : prev));
    void shipmentService.update(id, patch);
  }

  async function markDispatched(s: Shipment) {
    await new Promise((r) => setTimeout(r, 500));
    const today = new Date().toISOString().slice(0, 10);
    applyPatch(s.id, { shipmentDate: s.shipmentDate ?? today });
    toast({
      variant: 'success',
      title: t('toastDispatchedTitle'),
      description: t('toastDispatchedDescription', { reference: s.reference }),
    });
  }

  async function markDelivered(s: Shipment) {
    await new Promise((r) => setTimeout(r, 500));
    const today = new Date().toISOString().slice(0, 10);
    applyPatch(s.id, { actualDelivery: today, isDelayed: false, customsStatus: 'cleared' });
    toast({
      variant: 'success',
      title: t('toastDeliveredTitle'),
      description: t('toastDeliveredDescription', { reference: s.reference }),
    });
  }

  function handleCreate(s: Shipment) {
    setRows((prev) => (prev ? [s, ...prev] : [s]));
    setStats((prev) => (prev ? { ...prev, total: prev.total + 1, preparing: prev.preparing + 1 } : prev));
  }

  /* ── table columns ── */
  const columns: Column<Shipment>[] = [
    {
      key: 'reference',
      header: t('colReference'),
      sortValue: (s) => s.reference,
      cell: (s) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{s.reference}</p>
          <p className="truncate text-xs text-muted-foreground">{s.recipient}</p>
        </div>
      ),
    },
    {
      key: 'company',
      header: t('colCompany'),
      sortValue: (s) => companyMap.get(s.companyId)?.legalName ?? '',
      cell: (s) => {
        const c = companyMap.get(s.companyId);
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
      key: 'courier',
      header: t('colCourier'),
      sortValue: (s) => s.courier ?? '',
      cell: (s) => (
        <div className="min-w-0">
          <p className="text-sm text-foreground">{s.courier ?? '—'}</p>
          {s.service ? <p className="truncate text-xs text-muted-foreground">{s.service}</p> : null}
        </div>
      ),
      hideable: true,
    },
    {
      key: 'tracking',
      header: t('colTracking'),
      sortValue: (s) => s.trackingNumber ?? '',
      cell: (s) =>
        s.trackingNumber ? (
          s.trackingUrl ? (
            <a
              href={s.trackingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand-teal hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {s.trackingNumber}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="text-sm tabular">{s.trackingNumber}</span>
          )
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      hideable: true,
    },
    {
      key: 'destination',
      header: t('colDestination'),
      sortValue: (s) => s.address.country,
      cell: (s) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm">
          <span className="text-base leading-none">{flagEmoji(s.address.countryCode)}</span>
          {s.address.city}, {s.address.country}
        </span>
      ),
      hideable: true,
    },
    {
      key: 'dispatch',
      header: t('colDispatch'),
      align: 'right',
      sortable: true,
      sortValue: (s) => (s.shipmentDate ? new Date(s.shipmentDate).getTime() : 0),
      cell: (s) => <span className="whitespace-nowrap text-sm">{formatDate(s.shipmentDate, locale)}</span>,
      hideable: true,
    },
    {
      key: 'eta',
      header: t('colEta'),
      align: 'right',
      sortable: true,
      sortValue: (s) => (s.estimatedDelivery ? new Date(s.estimatedDelivery).getTime() : 0),
      cell: (s) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(s.estimatedDelivery, locale)}
        </span>
      ),
      hideable: true,
    },
    {
      key: 'delivered',
      header: t('delivered'),
      align: 'right',
      sortable: true,
      sortValue: (s) => (s.actualDelivery ? new Date(s.actualDelivery).getTime() : 0),
      cell: (s) =>
        s.actualDelivery ? (
          <span className="whitespace-nowrap text-sm font-medium text-success">
            {formatDate(s.actualDelivery, locale)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'status',
      header: t('colStatus'),
      sortValue: (s) => shipmentService.deriveStatus(s),
      cell: (s) => <ShipmentStatusCell shipment={s} />,
    },
    {
      key: 'sample',
      header: t('colRelatedSample'),
      sortValue: (s) => sampleMap.get(s.sampleRequestId)?.reference ?? '',
      cell: (s) => {
        const sample = sampleMap.get(s.sampleRequestId);
        if (!sample) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Link
            href={'/admin/samples/' + sample.id}
            className="text-sm text-brand-teal hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {sample.reference}
          </Link>
        );
      },
      hideable: true,
    },
  ];

  /* ── toolbar ── */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fStatus} onValueChange={setFStatus}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder={t('colStatus')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allStatuses')}</SelectItem>
          {DERIVED_STATUSES.map((st) => (
            <SelectItem key={st} value={st}>
              {t(STATUS_META[st].labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fCourier} onValueChange={setFCourier}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder={t('colCourier')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allCouriers')}</SelectItem>
          {courierOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeFilterCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          <X />
          {t('clearFilters', { count: activeFilterCount })}
        </Button>
      ) : null}
    </div>
  );

  /* ── row actions ── */
  function rowActions(s: Shipment) {
    const status = shipmentService.deriveStatus(s);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push('/admin/shipments/' + s.id)}>
            <ExternalLink />
            Open detail
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {status === 'preparing' ? (
            <DropdownMenuItem onSelect={() => void markDispatched(s)}>
              <Send />
              Mark dispatched
            </DropdownMenuItem>
          ) : null}
          {status !== 'delivered' ? (
            <DropdownMenuItem onSelect={() => void markDelivered(s)}>
              <CheckCircle2 />
              Mark delivered
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setTrackingFor(s)}>
            <MapPin />
            Add tracking update
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setIssueFor(s)}>
            <Flag />
            Report issue
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(s: Shipment) {
    const c = companyMap.get(s.companyId);
    const delayed = s.isDelayed && !s.actualDelivery;
    return (
      <Card className={delayed ? 'border-danger/40 bg-danger-subtle/30 p-3' : 'p-3'}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{s.reference}</p>
            <p className="truncate text-xs text-muted-foreground">{c?.tradingName || c?.legalName}</p>
          </div>
          <ShipmentStatusCell shipment={s} />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-sm">
          <span className="text-base leading-none">{flagEmoji(s.address.countryCode)}</span>
          {s.address.city}, {s.address.country}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{s.courier ?? 'No courier'}</span>
          <span>ETA {formatDate(s.estimatedDelivery, locale)}</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Shipments & Logistics"
        subtitle="Track every sample dispatch from preparation to delivery."
        actions={
          <Button variant="gold" onClick={() => setCreateOpen(true)}>
            <Plus />
            New shipment
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Total" value={stats?.total ?? 0} icon={Truck} tone="gold" />
        <StatCard label="In transit" value={stats?.inTransit ?? 0} icon={PlaneTakeoff} tone="info" delay={0.05} />
        <StatCard label="At customs" value={stats?.customs ?? 0} icon={ShieldAlert} tone="warning" delay={0.1} />
        <StatCard label="Delivered" value={stats?.delivered ?? 0} icon={PackageCheck} tone="success" delay={0.15} />
        <StatCard label="Delayed" value={stats?.delayed ?? 0} icon={AlertTriangle} tone="danger" delay={0.2} />
        <StatCard
          label="Avg delivery"
          value={stats?.avgDeliveryDays ?? 0}
          icon={Timer}
          tone="default"
          hint="avg days"
          delay={0.25}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Status breakdown"
          description="Where every shipment stands today"
          loading={rows === null}
          isEmpty={donutData.length === 0}
        >
          <DonutChart data={donutData} centerLabel="shipments" />
        </ChartCard>

        <ChartCard
          title="Shipments by courier"
          description="Volume handled per carrier"
          loading={rows === null}
          isEmpty={courierChart.length === 0}
        >
          <CategoryBar data={courierChart} xKey="label" barKey="count" horizontal color={CHART_COLORS[2]} name="Shipments" />
        </ChartCard>
      </div>

      {/* Table */}
      <DataTable<Shipment>
        data={filtered}
        columns={columns}
        getRowId={(s) => s.id}
        loading={rows === null}
        searchable
        searchPlaceholder="Search reference, courier, tracking, destination…"
        searchValue={(s) =>
          [
            s.reference,
            s.recipient,
            s.courier,
            s.trackingNumber,
            s.address.city,
            s.address.country,
            companyMap.get(s.companyId)?.legalName,
          ]
            .filter(Boolean)
            .join(' ')
        }
        pageSize={12}
        rowActions={rowActions}
        onRowClick={(s) => router.push('/admin/shipments/' + s.id)}
        toolbar={toolbar}
        enableColumnVisibility
        enableDensityToggle
        mobileCard={mobileCard}
        emptyTitle="No shipments match"
        emptyDescription="Adjust the filters or create a new shipment."
        exportFilename="shipments"
        storageKey="shipments-table"
      />

      <CreateShipmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        companies={[...companyMap.values()]}
        samples={[...sampleMap.values()]}
        onCreated={handleCreate}
      />

      <ReportIssueDialog
        shipment={issueFor}
        onOpenChange={(o) => !o && setIssueFor(null)}
        onReported={(id, issue) => applyPatch(id, { deliveryIssue: issue, isDelayed: true })}
      />

      <TrackingUpdateDialog shipment={trackingFor} onOpenChange={(o) => !o && setTrackingFor(null)} />
    </div>
  );
}

/* ────────────────────────────── Create dialog ────────────────────────────── */

function CreateShipmentDialog({
  open,
  onOpenChange,
  companies,
  samples,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  samples: SampleRequest[];
  onCreated: (s: Shipment) => void;
}) {
  const [companyId, setCompanyId] = React.useState('');
  const [sampleId, setSampleId] = React.useState('');
  const [recipient, setRecipient] = React.useState('');
  const [courier, setCourier] = React.useState('');
  const [incoterm, setIncoterm] = React.useState<Incoterm>('DAP');
  const [city, setCity] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [countryCode, setCountryCode] = React.useState('');
  const [eta, setEta] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const sampleOptions = React.useMemo(
    () => (companyId ? samples.filter((s) => s.companyId === companyId) : []),
    [samples, companyId],
  );

  function reset() {
    setCompanyId('');
    setSampleId('');
    setRecipient('');
    setCourier('');
    setIncoterm('DAP');
    setCity('');
    setCountry('');
    setCountryCode('');
    setEta('');
  }

  const valid =
    companyId.length > 0 && sampleId.length > 0 && recipient.trim().length > 0 && city.trim().length > 0 && country.trim().length > 0;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    const code = (countryCode.trim() || country.trim().slice(0, 2)).toUpperCase();
    const nowIso = new Date().toISOString();
    const company = companies.find((c) => c.id === companyId);
    const year = nowIso.slice(0, 4);
    const seq = String(Math.floor(Math.random() * 9000) + 1000);

    const shipment: Shipment = {
      id: uid('shp'),
      reference: `SHP-${year}-${seq}`,
      sampleRequestId: sampleId,
      companyId,
      senderLocation: 'ITALPROTEIN HQ, Italy',
      recipient: recipient.trim(),
      address: {
        line1: '—',
        city: city.trim(),
        country: country.trim(),
        countryCode: code,
      },
      courier: courier.trim() || undefined,
      incoterm,
      customsStatus: company && company.countryCode === 'IT' ? 'not_required' : 'pending',
      estimatedDelivery: eta || undefined,
      packageCount: 1,
      createdAt: nowIso,
    };

    await shipmentService.create(shipment);
    onCreated(shipment);
    toast({ variant: 'success', title: 'Shipment created', description: `${shipment.reference} added to logistics.` });
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
          <DialogTitle>New shipment</DialogTitle>
          <DialogDescription>Create a logistics record for a sample dispatch.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Company *</Label>
            <Select
              value={companyId}
              onValueChange={(v) => {
                setCompanyId(v);
                setSampleId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company" />
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
            <Label>Sample request *</Label>
            <Select value={sampleId} onValueChange={setSampleId} disabled={!companyId}>
              <SelectTrigger>
                <SelectValue placeholder={companyId ? 'Select sample' : 'Pick a company first'} />
              </SelectTrigger>
              <SelectContent>
                {sampleOptions.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No samples for this company
                  </SelectItem>
                ) : (
                  sampleOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.reference}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="recipient">Recipient *</Label>
            <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="John Doe, QA Lab" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lyon" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country">Country *</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="France" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="countryCode">Country code</Label>
            <Input id="countryCode" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} maxLength={2} placeholder="FR" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="courier">Courier</Label>
            <Input id="courier" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="DHL Express" />
          </div>

          <div className="space-y-1.5">
            <Label>Incoterm</Label>
            <Select value={incoterm} onValueChange={(v) => setIncoterm(v as Incoterm)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCOTERMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {getLabel('incoterm', t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="eta">Estimated delivery</Label>
            <Input id="eta" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>
            {submitting ? 'Creating…' : 'Create shipment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Report issue dialog ────────────────────────────── */

function ReportIssueDialog({
  shipment,
  onOpenChange,
  onReported,
}: {
  shipment: Shipment | null;
  onOpenChange: (open: boolean) => void;
  onReported: (id: string, issue: string) => void;
}) {
  const [issue, setIssue] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (shipment) setIssue('');
  }, [shipment]);

  async function submit() {
    if (!issue.trim() || submitting || !shipment) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    onReported(shipment.id, issue.trim());
    setSubmitting(false);
    toast({ variant: 'warning', title: 'Issue reported', description: `Logged against ${shipment.reference}.` });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!shipment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report issue</DialogTitle>
          <DialogDescription>{shipment ? shipment.reference : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="issueBody">Describe the issue</Label>
          <Textarea
            id="issueBody"
            rows={4}
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Held at customs, missing CN23 declaration…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!issue.trim() || submitting}>
            {submitting ? 'Reporting…' : 'Report issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Tracking update dialog ────────────────────────────── */

function TrackingUpdateDialog({
  shipment,
  onOpenChange,
}: {
  shipment: Shipment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (shipment) setNote('');
  }, [shipment]);

  async function submit() {
    if (!note.trim() || submitting || !shipment) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    setSubmitting(false);
    toast({ variant: 'info', title: 'Tracking updated', description: `Update posted to ${shipment.reference}.` });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!shipment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add tracking update</DialogTitle>
          <DialogDescription>{shipment ? shipment.reference : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="trackNote">Update</Label>
          <Textarea
            id="trackNote"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Arrived at sorting hub, Paris CDG…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!note.trim() || submitting}>
            {submitting ? 'Posting…' : 'Post update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
