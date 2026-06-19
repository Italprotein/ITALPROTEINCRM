'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import {
  Building2,
  Activity as ActivityIcon,
  CheckCircle2,
  FileSignature,
  Flame,
  Plus,
  Download,
  MoreHorizontal,
  ExternalLink,
  Pencil,
  StickyNote,
  ListTodo,
  Tag as TagIcon,
  Globe,
  X,
} from 'lucide-react';

import { companyService } from '@/lib/mock-services';
import { authService } from '@/lib/mock-services/authService';
import type { Company, CompanyType, RelationshipStage, Priority, Locale } from '@/lib/types';
import { COMPANY_TYPES } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatCurrency, formatRelative, flagEmoji } from '@/lib/formatting';
import { initials, uid } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { ChartCard, CategoryBar, DonutChart, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Option lists ────────────────────────────── */

const RELATIONSHIP_STAGES: RelationshipStage[] = [
  'lead', 'contacted', 'interested', 'qualified', 'nda_in_progress', 'nda_signed',
  'sampling', 'testing', 'commercial_discussion', 'customer', 'repeat_customer',
  'dormant', 'lost',
];

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

const ALL = '__all__';

/* ────────────────────────────── Helpers ────────────────────────────── */

function ownerName(id: string): string {
  const a = authService.getAccount(id);
  return a ? `${a.firstName} ${a.lastName}` : 'Unassigned';
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function CompaniesPage() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [rows, setRows] = React.useState<Company[] | null>(null);
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof companyService.getStatistics>> | null>(null);
  const [byType, setByType] = React.useState<{ type: CompanyType; count: number }[]>([]);
  const [byCountry, setByCountry] = React.useState<{ country: string; countryCode: string; count: number }[]>([]);

  // toolbar filters
  const [fType, setFType] = React.useState<string>(ALL);
  const [fCountry, setFCountry] = React.useState<string>(ALL);
  const [fStage, setFStage] = React.useState<string>(ALL);
  const [fPriority, setFPriority] = React.useState<string>(ALL);

  // create dialog
  const [createOpen, setCreateOpen] = React.useState(false);

  // row dialogs
  const [noteFor, setNoteFor] = React.useState<Company | null>(null);
  const [taskFor, setTaskFor] = React.useState<Company | null>(null);

  React.useEffect(() => {
    companyService.list().then(setRows);
    companyService.getStatistics().then(setStats);
    companyService.byType().then(setByType);
    companyService.byCountry().then(setByCountry);
  }, []);

  /* ── derived filter option lists ── */
  const countryOptions = React.useMemo(() => {
    const set = new Map<string, string>();
    for (const c of rows ?? []) set.set(c.country, c.countryCode);
    return [...set.entries()].map(([country, code]) => ({ country, code })).sort((a, b) => a.country.localeCompare(b.country));
  }, [rows]);

  const typeOptions = React.useMemo(() => {
    const present = new Set((rows ?? []).map((c) => c.type));
    return COMPANY_TYPES.filter((t) => present.has(t));
  }, [rows]);

  /* ── client-side filtered data ── */
  const filtered = React.useMemo(() => {
    let data = rows ?? [];
    if (fType !== ALL) data = data.filter((c) => c.type === fType);
    if (fCountry !== ALL) data = data.filter((c) => c.country === fCountry);
    if (fStage !== ALL) data = data.filter((c) => c.relationshipStage === fStage);
    if (fPriority !== ALL) data = data.filter((c) => c.priority === fPriority);
    return data;
  }, [rows, fType, fCountry, fStage, fPriority]);

  const activeFilterCount =
    (fType !== ALL ? 1 : 0) + (fCountry !== ALL ? 1 : 0) + (fStage !== ALL ? 1 : 0) + (fPriority !== ALL ? 1 : 0);

  const resetFilters = () => {
    setFType(ALL);
    setFCountry(ALL);
    setFStage(ALL);
    setFPriority(ALL);
  };

  /* ── chart data ── */
  const typeChart = React.useMemo(
    () => byType.map((t) => ({ label: getLabel('companyType', t.type), count: t.count })),
    [byType],
  );
  const countryChart = React.useMemo(
    () =>
      byCountry.slice(0, 7).map((c, i) => ({
        name: c.country,
        value: c.count,
        color: CHART_COLORS[i % CHART_COLORS.length],
      })),
    [byCountry],
  );

  /* ── mutations (mock) ── */
  function handleCreate(c: Company) {
    setRows((prev) => (prev ? [c, ...prev] : [c]));
    // keep stats roughly in sync
    setStats((prev) =>
      prev
        ? { ...prev, total: prev.total + 1, active: prev.active + 1 }
        : prev,
    );
  }

  function applyPatch(ids: string[], patch: Partial<Company>) {
    setRows((prev) =>
      prev ? prev.map((c) => (ids.includes(c.id) ? { ...c, ...patch } : c)) : prev,
    );
    for (const id of ids) void companyService.update(id, patch);
  }

  /* ── table columns ── */
  const columns: Column<Company>[] = [
    {
      key: 'company',
      header: 'Company',
      sortValue: (c) => c.tradingName || c.legalName,
      cell: (c) => (
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: c.accentColor || CHART_COLORS[0] }}
          >
            {c.initials || initials(c.legalName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{c.tradingName || c.legalName}</p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="mr-1">{flagEmoji(c.countryCode)}</span>
              {c.city}, {c.country}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (c) => getLabel('companyType', c.type),
      cell: (c) => <StatusBadge kind="companyType" value={c.type} />,
      hideable: true,
    },
    {
      key: 'country',
      header: 'Country',
      sortValue: (c) => c.country,
      cell: (c) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-base leading-none">{flagEmoji(c.countryCode)}</span>
          <span className="text-sm">{c.country}</span>
        </span>
      ),
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'contact',
      header: 'Main contact',
      sortValue: (c) => c.firstContact.personName ?? '',
      cell: (c) =>
        c.firstContact.personName ? (
          <span className="text-sm">{c.firstContact.personName}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      hideable: true,
    },
    {
      key: 'owner',
      header: 'Owner',
      sortValue: (c) => ownerName(c.accountOwnerId),
      cell: (c) => {
        const name = ownerName(c.accountOwnerId);
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
    {
      key: 'stage',
      header: 'Stage',
      sortValue: (c) => getLabel('relationshipStage', c.relationshipStage),
      cell: (c) => <StatusBadge kind="relationshipStage" value={c.relationshipStage} />,
      hideable: true,
    },
    {
      key: 'nda',
      header: 'NDA',
      sortValue: (c) => getLabel('ndaStatus', c.ndaStatus),
      cell: (c) => <StatusBadge kind="ndaStatus" value={c.ndaStatus} />,
      hideable: true,
    },
    {
      key: 'sample',
      header: 'Sample',
      sortValue: (c) => (c.latestSampleStatus ? getLabel('sampleStatus', c.latestSampleStatus) : ''),
      cell: (c) =>
        c.latestSampleStatus ? (
          <StatusBadge kind="sampleStatus" value={c.latestSampleStatus} />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      hideable: true,
      defaultHidden: true,
    },
    {
      key: 'value',
      header: 'Opportunity',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.opportunityValue ?? 0,
      cell: (c) => (
        <span className="tabular font-medium">
          {c.opportunityValue ? formatCurrency(c.opportunityValue, c.preferredCurrency, locale, { compact: true }) : '—'}
        </span>
      ),
      hideable: true,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortValue: (c) => PRIORITIES.indexOf(c.priority),
      cell: (c) => <PriorityBadge value={c.priority} />,
      hideable: true,
    },
    {
      key: 'lastActivity',
      header: 'Last activity',
      align: 'right',
      sortable: true,
      sortValue: (c) => (c.lastActivityAt ? new Date(c.lastActivityAt).getTime() : 0),
      cell: (c) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {c.lastActivityAt ? formatRelative(c.lastActivityAt, locale) : '—'}
        </span>
      ),
      hideable: true,
    },
    {
      key: 'tags',
      header: 'Tags',
      cell: (c) =>
        c.tags && c.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {c.tags.slice(0, 2).map((t) => (
              <Badge key={t} variant="muted" className="text-2xs">
                {t}
              </Badge>
            ))}
            {c.tags.length > 2 ? (
              <Badge variant="outline" className="text-2xs">
                +{c.tags.length - 2}
              </Badge>
            ) : null}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      hideable: true,
      defaultHidden: true,
    },
  ];

  /* ── toolbar (filters) ── */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fType} onValueChange={setFType}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {typeOptions.map((t) => (
            <SelectItem key={t} value={t}>
              {getLabel('companyType', t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fCountry} onValueChange={setFCountry}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Country" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All countries</SelectItem>
          {countryOptions.map((c) => (
            <SelectItem key={c.country} value={c.country}>
              {flagEmoji(c.code)} {c.country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fStage} onValueChange={setFStage}>
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All stages</SelectItem>
          {RELATIONSHIP_STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {getLabel('relationshipStage', s)}
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

  /* ── bulk actions ── */
  function bulkActions(ids: string[], clear: () => void) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Flame />
              Set priority
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Set priority</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PRIORITIES.map((p) => (
              <DropdownMenuItem
                key={p}
                onSelect={() => {
                  applyPatch(ids, { priority: p });
                  toast({
                    variant: 'success',
                    title: 'Priority updated',
                    description: `${ids.length} ${ids.length === 1 ? 'company' : 'companies'} set to ${getLabel('priority', p)}.`,
                  });
                  clear();
                }}
              >
                {getLabel('priority', p)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // append a "key-account" tag to each selected company, preserving existing tags
            setRows((prev) =>
              prev
                ? prev.map((c) => {
                    if (!ids.includes(c.id)) return c;
                    const nextTags = Array.from(new Set([...(c.tags ?? []), 'key-account']));
                    void companyService.update(c.id, { tags: nextTags });
                    return { ...c, tags: nextTags };
                  })
                : prev,
            );
            toast({
              variant: 'success',
              title: 'Tag added',
              description: `Tagged ${ids.length} ${ids.length === 1 ? 'company' : 'companies'} as “key-account”.`,
            });
            clear();
          }}
        >
          <TagIcon />
          Add tag
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            toast({
              variant: 'info',
              title: 'Export started',
              description: `Preparing CSV for ${ids.length} selected ${ids.length === 1 ? 'company' : 'companies'}…`,
            });
            clear();
          }}
        >
          <Download />
          Export selected
        </Button>
      </>
    );
  }

  /* ── row actions ── */
  function rowActions(c: Company) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push('/admin/companies/' + c.id)}>
            <ExternalLink />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push('/admin/companies/' + c.id)}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setNoteFor(c)}>
            <StickyNote />
            Add note
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTaskFor(c)}>
            <ListTodo />
            Create task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(c: Company) {
    return (
      <Card className="p-3">
        <div className="flex items-start gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: c.accentColor || CHART_COLORS[0] }}
          >
            {c.initials || initials(c.legalName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{c.tradingName || c.legalName}</p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="mr-1">{flagEmoji(c.countryCode)}</span>
              {c.city}, {c.country}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="relationshipStage" value={c.relationshipStage} />
              <StatusBadge kind="ndaStatus" value={c.ndaStatus} />
              <PriorityBadge value={c.priority} />
            </div>
            {c.opportunityValue ? (
              <p className="mt-2 text-sm font-semibold tabular">
                {formatCurrency(c.opportunityValue, c.preferredCurrency, locale, { compact: true })}
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Companies"
        subtitle="Every company in the Proamina® pipeline."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                toast({
                  variant: 'info',
                  title: 'Export started',
                  description: `Preparing CSV for ${filtered.length} ${filtered.length === 1 ? 'company' : 'companies'}…`,
                })
              }
            >
              <Download />
              Export
            </Button>
            <Button variant="gold" onClick={() => setCreateOpen(true)}>
              <Plus />
              Add company
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total companies" value={stats?.total ?? 0} icon={Building2} tone="gold" />
        <StatCard label="Active" value={stats?.active ?? 0} icon={ActivityIcon} tone="info" delay={0.05} />
        <StatCard label="Customers" value={stats?.customers ?? 0} icon={CheckCircle2} tone="success" delay={0.1} />
        <StatCard label="NDAs signed" value={stats?.ndaSigned ?? 0} icon={FileSignature} tone="success" delay={0.15} />
        <StatCard label="High priority" value={stats?.highPriority ?? 0} icon={Flame} tone="warning" delay={0.2} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Companies by type"
          description="Distribution across business categories"
          loading={rows === null}
          isEmpty={typeChart.length === 0}
        >
          <CategoryBar data={typeChart} xKey="label" barKey="count" horizontal color={CHART_COLORS[0]} name="Companies" />
        </ChartCard>

        <ChartCard
          title="Top markets"
          description="Companies by country (top 7)"
          loading={rows === null}
          isEmpty={countryChart.length === 0}
        >
          <DonutChart data={countryChart} centerLabel="companies" />
        </ChartCard>
      </div>

      {/* Table */}
      <DataTable<Company>
        data={filtered}
        columns={columns}
        getRowId={(c) => c.id}
        loading={rows === null}
        searchable
        searchPlaceholder="Search companies, country, tags…"
        searchValue={(c) => [c.legalName, c.tradingName, c.country, c.city, ...(c.tags ?? [])].filter(Boolean).join(' ')}
        pageSize={12}
        selectable
        bulkActions={bulkActions}
        rowActions={rowActions}
        onRowClick={(c) => router.push('/admin/companies/' + c.id)}
        toolbar={toolbar}
        enableColumnVisibility
        enableDensityToggle
        mobileCard={mobileCard}
        emptyTitle="No companies match"
        emptyDescription="Adjust the filters or add a new company."
        exportFilename="companies"
        storageKey="companies-table"
      />

      <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreate} />

      <NoteDialog company={noteFor} onOpenChange={(o) => !o && setNoteFor(null)} />
      <TaskDialog company={taskFor} onOpenChange={(o) => !o && setTaskFor(null)} />
    </div>
  );
}

/* ────────────────────────────── Create dialog ────────────────────────────── */

const accentPalette = ['#0a1628', '#c9a227', '#0eb89a', '#2563eb', '#0a9980', '#6f8a6b'];

function CreateCompanyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (c: Company) => void;
}) {
  const [legalName, setLegalName] = React.useState('');
  const [tradingName, setTradingName] = React.useState('');
  const [type, setType] = React.useState<CompanyType>('distributor');
  const [country, setCountry] = React.useState('');
  const [city, setCity] = React.useState('');
  const [stage, setStage] = React.useState<RelationshipStage>('lead');
  const [priority, setPriority] = React.useState<Priority>('medium');
  const [website, setWebsite] = React.useState('');
  const [countryCode, setCountryCode] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  function reset() {
    setLegalName('');
    setTradingName('');
    setType('distributor');
    setCountry('');
    setCity('');
    setStage('lead');
    setPriority('medium');
    setWebsite('');
    setCountryCode('');
  }

  const valid = legalName.trim().length > 0 && country.trim().length > 0 && city.trim().length > 0;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));

    const code = (countryCode.trim() || country.trim().slice(0, 2)).toUpperCase();
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const company: Company = {
      id: uid('c'),
      legalName: legalName.trim(),
      tradingName: tradingName.trim() || undefined,
      type,
      initials: initials(tradingName.trim() || legalName.trim()),
      accentColor: accentPalette[Math.floor(Math.random() * accentPalette.length)],
      headquarters: {
        line1: '—',
        city: city.trim(),
        country: country.trim(),
        countryCode: code,
      },
      country: country.trim(),
      countryCode: code,
      city: city.trim(),
      preferredLanguage: 'en',
      preferredCurrency: 'EUR',
      firstContact: { date: today, channel: 'inbound_web' },
      accountOwnerId: 'u_giuseppe',
      relationshipStage: stage,
      priority,
      ndaStatus: 'not_required',
      website: website.trim() || undefined,
      tags: [],
      lastActivityAt: nowIso,
      createdAt: nowIso,
    };

    await companyService.create(company);
    onCreated(company);
    toast({
      variant: 'success',
      title: 'Company created',
      description: `${company.tradingName || company.legalName} added to the pipeline.`,
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
          <DialogTitle>Add company</DialogTitle>
          <DialogDescription>Create a new company record. It will be prepended to the list.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="legalName">Legal name *</Label>
            <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Acme Foods S.p.A." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tradingName">Trading name</Label>
            <Input id="tradingName" value={tradingName} onChange={(e) => setTradingName(e.target.value)} placeholder="Acme" />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CompanyType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {getLabel('companyType', t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country">Country *</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Italy" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="countryCode">Country code</Label>
            <Input
              id="countryCode"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              maxLength={2}
              placeholder="IT"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">City *</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Milan" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>

          <div className="space-y-1.5">
            <Label>Relationship stage</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as RelationshipStage)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getLabel('relationshipStage', s)}
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>
            {submitting ? 'Creating…' : 'Create company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Note dialog ────────────────────────────── */

function NoteDialog({ company, onOpenChange }: { company: Company | null; onOpenChange: (open: boolean) => void }) {
  const [body, setBody] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (company) setBody('');
  }, [company]);

  async function submit() {
    if (!body.trim() || submitting || !company) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    setSubmitting(false);
    toast({ variant: 'success', title: 'Note added', description: `Logged against ${company.tradingName || company.legalName}.` });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
          <DialogDescription>{company ? company.tradingName || company.legalName : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="noteBody">Note</Label>
          <Textarea
            id="noteBody"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened?"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!body.trim() || submitting}>
            {submitting ? 'Saving…' : 'Save note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Task dialog ────────────────────────────── */

function TaskDialog({ company, onOpenChange }: { company: Company | null; onOpenChange: (open: boolean) => void }) {
  const [title, setTitle] = React.useState('');
  const [due, setDue] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (company) {
      setTitle('');
      setDue('');
    }
  }, [company]);

  async function submit() {
    if (!title.trim() || submitting || !company) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    setSubmitting(false);
    toast({
      variant: 'success',
      title: 'Task created',
      description: `“${title.trim()}” for ${company.tradingName || company.legalName}.`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {company ? company.tradingName || company.legalName : ''}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="taskTitle">Title</Label>
            <Input id="taskTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up on samples" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taskDue">Due date</Label>
            <Input id="taskDue" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || submitting}>
            {submitting ? 'Creating…' : 'Create task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
