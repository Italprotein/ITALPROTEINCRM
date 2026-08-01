'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  Trash2,
  StickyNote,
  ListTodo,
  Tag as TagIcon,
  Globe,
  X,
} from 'lucide-react';

import { companyService } from '@/lib/mock-services';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { useSession } from '@/components/providers/session-provider';
import { can } from '@/lib/permissions';
import type { Company, CompanyType, RelationshipStage, Priority, NDAStatus, Locale } from '@/lib/types';
import { COMPANY_TYPES } from '@/lib/types';
import { getLabel, COMPANY_TYPE_OPTIONS } from '@/lib/labels';
import { formatCurrency, formatRelative, flagEmoji } from '@/lib/formatting';
import { cn, initials, uid } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { CHART_COLORS } from '@/lib/chart-colors';
import { DataTable, type Column } from '@/components/ui/data-table';
import { InlineSelect } from '@/components/crm/inline-select';

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
import { useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Option lists ────────────────────────────── */

const RELATIONSHIP_STAGES: RelationshipStage[] = [
  'lead', 'contacted', 'interested', 'qualified', 'nda_in_progress', 'nda_signed',
  'sampling', 'testing', 'commercial_discussion', 'customer', 'repeat_customer',
  'dormant', 'lost',
];

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

/** NDA states offered inline. The full enum includes terminal/administrative
 *  values that are set from the NDA record itself, not from this list. */
const NDA_STATUSES: NDAStatus[] = [
  'not_required', 'to_prepare', 'draft', 'sent', 'under_review',
  'changes_requested', 'approved', 'awaiting_counterparty_signature',
  'partially_signed', 'fully_signed', 'expired',
];

const ALL = '__all__';

/* ────────────────────────────── Page ────────────────────────────── */

export default function CompaniesPage() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations('AdminCompanies');
  const { nameOf, staff } = useStaffDirectory();
  const { session } = useSession();
  const role = session?.role;
  const canCreateCompany = !!role && can(role, 'company.create');

  const canEditCompany = !!role && can(role, 'company.edit');
  const { confirm, ConfirmDialog: confirmDialog } = useConfirm();

  const [rows, setRows] = React.useState<Company[] | null>(null);
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof companyService.getStatistics>> | null>(null);

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

  /**
   * Single-row edit from an inline cell. Unlike applyPatch this awaits the
   * write and rethrows, so InlineSelect can roll the cell back and the user is
   * told rather than left looking at a change that never persisted.
   */
  async function editCompany(id: string, patch: Partial<Company>) {
    const before = rows?.find((c) => c.id === id);
    setRows((prev) => (prev ? prev.map((c) => (c.id === id ? { ...c, ...patch } : c)) : prev));
    try {
      await companyService.update(id, patch);
    } catch (error) {
      if (before) {
        setRows((prev) => (prev ? prev.map((c) => (c.id === id ? before : c)) : prev));
      }
      toast({
        variant: 'danger',
        title: t('updateFailedTitle'),
        description: t('updateFailedDescription'),
      });
      throw error;
    }
  }

  async function handleDelete(c: Company) {
    const name = c.tradingName || c.legalName;
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      description: t('deleteConfirmDescription', { name }),
      confirmLabel: t('delete'),
      variant: 'danger',
    });
    if (!ok) return;
    const prev = rows;
    setRows((r) => (r ? r.filter((x) => x.id !== c.id) : r));
    setStats((s) => (s ? { ...s, total: Math.max(0, s.total - 1) } : s));
    try {
      await companyService.remove(c.id);
      toast({ variant: 'success', title: t('toastDeletedTitle'), description: t('toastDeletedDescription', { name }) });
    } catch (error) {
      setRows(prev ?? null); // roll back the optimistic removal
      // A company holding quotes, orders or invoices is refused rather than
      // destroyed — say which, instead of a generic failure.
      const message = error instanceof Error ? error.message : '';
      const blocked = message.includes('COMPANY_DELETE_BLOCKED');
      toast({
        variant: 'danger',
        title: blocked ? t('deleteBlockedTitle') : t('toastActionFailedTitle'),
        description: blocked
          ? t('deleteBlockedDescription', {
              name,
              reasons: message.split('COMPANY_DELETE_BLOCKED:')[1]?.trim() ?? '',
            })
          : t('toastActionFailedDescription'),
      });
    }
  }

  /* ── table columns ── */
  const columns: Column<Company>[] = [
    {
      key: 'company',
      header: t('colCompany'),
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
      header: t('colType'),
      sortValue: (c) => getLabel('companyType', c.type),
      cell: (c) => (
        <InlineSelect<CompanyType>
          value={c.type}
          options={COMPANY_TYPE_OPTIONS.map((v) => ({ value: v, label: getLabel('companyType', v) }))}
          onChange={(next) => editCompany(c.id, { type: next })}
          disabled={!canEditCompany}
          ariaLabel={t('colType')}
          render={(v) => <StatusBadge kind="companyType" value={v} />}
        />
      ),
      hideable: true,
    },
    {
      key: 'country',
      header: t('colCountry'),
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
      header: t('colMainContact'),
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
      header: t('colOwner'),
      sortValue: (c) => nameOf(c.accountOwnerId, 'Unassigned'),
      cell: (c) => (
        <InlineSelect<string>
          value={c.accountOwnerId}
          options={staff.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}`.trim() }))}
          onChange={(next) => editCompany(c.id, { accountOwnerId: next })}
          disabled={!canEditCompany}
          ariaLabel={t('colOwner')}
          render={(id) => {
            const name = nameOf(id, 'Unassigned');
            return (
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 text-2xs font-semibold text-brand-navy">
                  {initials(name)}
                </span>
                <span className="text-sm">{name}</span>
              </span>
            );
          }}
        />
      ),
      hideable: true,
    },
    {
      key: 'stage',
      header: t('colStage'),
      sortValue: (c) => getLabel('relationshipStage', c.relationshipStage),
      cell: (c) => (
        <InlineSelect<RelationshipStage>
          value={c.relationshipStage}
          options={RELATIONSHIP_STAGES.map((v) => ({ value: v, label: getLabel('relationshipStage', v) }))}
          onChange={(next) => editCompany(c.id, { relationshipStage: next })}
          disabled={!canEditCompany}
          ariaLabel={t('colStage')}
          render={(v) => <StatusBadge kind="relationshipStage" value={v} />}
        />
      ),
      hideable: true,
    },
    {
      key: 'nda',
      header: t('colNda'),
      sortValue: (c) => getLabel('ndaStatus', c.ndaStatus),
      cell: (c) => (
        <InlineSelect<NDAStatus>
          value={c.ndaStatus}
          options={NDA_STATUSES.map((v) => ({ value: v, label: getLabel('ndaStatus', v) }))}
          onChange={(next) => editCompany(c.id, { ndaStatus: next })}
          disabled={!canEditCompany}
          ariaLabel={t('colNda')}
          render={(v) => <StatusBadge kind="ndaStatus" value={v} />}
        />
      ),
      hideable: true,
    },
    {
      key: 'sample',
      header: t('colSample'),
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
      key: 'priority',
      header: t('colPriority'),
      sortValue: (c) => PRIORITIES.indexOf(c.priority),
      cell: (c) => (
        <InlineSelect<Priority>
          value={c.priority}
          options={PRIORITIES.map((v) => ({ value: v, label: getLabel('priority', v) }))}
          onChange={(next) => editCompany(c.id, { priority: next })}
          disabled={!canEditCompany}
          ariaLabel={t('colPriority')}
          render={(v) => <PriorityBadge value={v} />}
        />
      ),
      hideable: true,
    },
    {
      key: 'lastActivity',
      header: t('colLastActivity'),
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
      header: t('colTags'),
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
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={fType} onValueChange={setFType}>
        <SelectTrigger className="h-9 w-full sm:w-[150px]">
          <SelectValue placeholder={t('colType')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allTypes')}</SelectItem>
          {typeOptions.map((t) => (
            <SelectItem key={t} value={t}>
              {getLabel('companyType', t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fCountry} onValueChange={setFCountry}>
        <SelectTrigger className="h-9 w-full sm:w-[160px]">
          <SelectValue placeholder={t('colCountry')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allCountries')}</SelectItem>
          {countryOptions.map((c) => (
            <SelectItem key={c.country} value={c.country}>
              {flagEmoji(c.code)} {c.country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fStage} onValueChange={setFStage}>
        <SelectTrigger className="h-9 w-full sm:w-[170px]">
          <SelectValue placeholder={t('colStage')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allStages')}</SelectItem>
          {RELATIONSHIP_STAGES.map((s) => (
            <SelectItem key={s} value={s}>
              {getLabel('relationshipStage', s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fPriority} onValueChange={setFPriority}>
        <SelectTrigger className="h-9 w-full sm:w-[140px]">
          <SelectValue placeholder={t('colPriority')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allPriorities')}</SelectItem>
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
          {t('clearFilters', { count: activeFilterCount })}
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
              {t('setPriority')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('setPriority')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PRIORITIES.map((p) => (
              <DropdownMenuItem
                key={p}
                onSelect={() => {
                  applyPatch(ids, { priority: p });
                  toast({
                    variant: 'success',
                    title: t('toastPriorityUpdatedTitle'),
                    description: t('toastPriorityUpdatedDescription', {
                      count: ids.length,
                      priority: getLabel('priority', p),
                    }),
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
              title: t('toastTagAddedTitle'),
              description: t('toastTagAddedDescription', { count: ids.length, tag: 'key-account' }),
            });
            clear();
          }}
        >
          <TagIcon />
          {t('addTag')}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            toast({
              variant: 'info',
              title: t('toastExportStartedTitle'),
              description: t('toastExportSelectedDescription', { count: ids.length }),
            });
            clear();
          }}
        >
          <Download />
          {t('exportSelected')}
        </Button>
      </>
    );
  }

  /* ── row actions ── */
  function rowActions(c: Company) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={t('rowActions')}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push('/admin/companies/' + c.id)}>
            <ExternalLink />
            {t('open')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push('/admin/companies/' + c.id)}>
            <Pencil />
            {t('edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setNoteFor(c)}>
            <StickyNote />
            {t('addNote')}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTaskFor(c)}>
            <ListTodo />
            {t('createTask')}
          </DropdownMenuItem>
          {canEditCompany && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => void handleDelete(c)}>
                <Trash2 />
                {t('delete')}
              </DropdownMenuItem>
            </>
          )}
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
    // Full-height app layout from md up: the header and the KPI bar are fixed
    // rails and the table fills whatever is left, so its horizontal scrollbar
    // always sits at the bottom of the viewport instead of below the fold.
    // Below md the table renders as cards with no inner scroll region, so the
    // page flows and scrolls normally there. 4rem is the topbar.
    <div className="flex flex-col gap-4 p-4 sm:p-6 md:h-[calc(100vh-4rem)] md:overflow-hidden lg:p-8">
      <PageHeader
        className="shrink-0"
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        actions={
          canCreateCompany ? (
            <Button variant="gold" onClick={() => setCreateOpen(true)}>
              <Plus />
              {t('addCompany')}
            </Button>
          ) : undefined
        }
      />

      {/* Book-of-business summary as one slim strip: the table below stays the
          work surface at full height, and nothing lands under the floating
          assistant in the bottom corner. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card px-4 py-2.5">
        {(
          [
            { icon: Building2, value: stats?.total, label: t('statTotalCompanies'), cls: 'text-brand-goldDark' },
            { icon: ActivityIcon, value: stats?.active, label: t('statActive'), cls: 'text-info' },
            { icon: CheckCircle2, value: stats?.customers, label: t('statCustomers'), cls: 'text-success' },
            { icon: FileSignature, value: stats?.ndaSigned, label: t('statNdasSigned'), cls: 'text-success' },
            { icon: Flame, value: stats?.highPriority, label: t('statHighPriority'), cls: 'text-warning-foreground' },
          ] as const
        ).map((chip) => (
          <span key={chip.label} className="flex items-center gap-1.5 text-sm">
            <chip.icon className={cn('h-4 w-4 shrink-0', chip.cls)} />
            <span className="font-semibold tabular text-foreground">{chip.value ?? '—'}</span>
            <span className="text-muted-foreground">{chip.label}</span>
          </span>
        ))}
      </div>

      <DataTable<Company>
        className="min-h-0 flex-1"
        data={filtered}
        columns={columns}
        getRowId={(c) => c.id}
        loading={rows === null}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
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
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
        exportFilename="companies"
        defaultSortKey="lastActivity"
        defaultSortDir="desc"
        storageKey="companies-table"
      />

      <CreateCompanyDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreate} />

      <NoteDialog company={noteFor} onOpenChange={(o) => !o && setNoteFor(null)} />
      <TaskDialog company={taskFor} onOpenChange={(o) => !o && setTaskFor(null)} />
      {confirmDialog}
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
  const t = useTranslations('AdminCompanies');
  const { account } = useSession();
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

  // Smart add: only the legal name and country are required. City, code, stage,
  // priority and website all have sensible defaults, so a company can be created
  // in two fields and enriched later on its detail page.
  const valid = legalName.trim().length > 0 && country.trim().length > 0;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);

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
      accountOwnerId: account?.id ?? '',
      relationshipStage: stage,
      priority,
      ndaStatus: 'not_required',
      website: website.trim() || undefined,
      tags: [],
      lastActivityAt: nowIso,
      createdAt: nowIso,
    };

    try {
      await companyService.create(company);
      onCreated(company);
      toast({
        variant: 'success',
        title: t('toastCompanyCreatedTitle'),
        description: t('toastCompanyCreatedDescription', { name: company.tradingName || company.legalName }),
      });
      reset();
      onOpenChange(false);
    } catch {
      toast({ variant: 'danger', title: 'Action failed', description: 'Please try again.' });
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
          <DialogTitle>{t('addCompany')}</DialogTitle>
          <DialogDescription>{t('createDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="legalName">{t('fieldLegalName')}</Label>
            <Input id="legalName" value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder={t('placeholderLegalName')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tradingName">{t('fieldTradingName')}</Label>
            <Input id="tradingName" value={tradingName} onChange={(e) => setTradingName(e.target.value)} placeholder={t('placeholderTradingName')} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('colType')}</Label>
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
            <Label htmlFor="country">{t('fieldCountry')}</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t('placeholderCountry')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="countryCode">{t('fieldCountryCode')}</Label>
            <Input
              id="countryCode"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              maxLength={2}
              placeholder={t('placeholderCountryCode')}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">{t('fieldCity')}</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('placeholderCity')} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="website">{t('fieldWebsite')}</Label>
            <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder={t('placeholderWebsite')} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('fieldRelationshipStage')}</Label>
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
            <Label>{t('colPriority')}</Label>
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
            {t('cancel')}
          </Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>
            {submitting ? t('creating') : t('createCompany')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Note dialog ────────────────────────────── */

function NoteDialog({ company, onOpenChange }: { company: Company | null; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('AdminCompanies');
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
    toast({ variant: 'success', title: t('toastNoteAddedTitle'), description: t('toastNoteAddedDescription', { name: company.tradingName || company.legalName }) });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addNote')}</DialogTitle>
          <DialogDescription>{company ? company.tradingName || company.legalName : ''}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="noteBody">{t('fieldNote')}</Label>
          <Textarea
            id="noteBody"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('placeholderNote')}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={!body.trim() || submitting}>
            {submitting ? t('saving') : t('saveNote')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Task dialog ────────────────────────────── */

function TaskDialog({ company, onOpenChange }: { company: Company | null; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('AdminCompanies');
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
      title: t('toastTaskCreatedTitle'),
      description: t('toastTaskCreatedDescription', { title: title.trim(), name: company.tradingName || company.legalName }),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!company} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('createTask')}</DialogTitle>
          <DialogDescription>
            <span className="inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {company ? company.tradingName || company.legalName : ''}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="taskTitle">{t('fieldTitle')}</Label>
            <Input id="taskTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('placeholderTaskTitle')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="taskDue">{t('fieldDueDate')}</Label>
            <Input id="taskDue" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={!title.trim() || submitting}>
            {submitting ? t('creating') : t('createTask')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
