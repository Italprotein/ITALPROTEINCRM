'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  CalendarClock,
  AlarmClock,
  PauseCircle,
  CheckCircle2,
  Eye,
  Pencil,
  Trash2,
  Plus,
  RefreshCw,
  Building2,
  StickyNote,
} from 'lucide-react';

import type { FollowUp, FollowUpSource, FollowUpStatus, Locale } from '@/lib/types';
import {
  FOLLOW_UP_STATUSES,
  FOLLOW_UP_SOURCES,
  daysUntil,
  isDue,
  type FollowUpStats,
} from '@/lib/follow-ups';
import { followUpRegisterService } from '@/lib/mock-services';
import type { FollowUpFormInput } from '@/lib/services/follow-up-register.mapper';
import { useSession } from '@/components/providers/session-provider';
import { canEdit } from '@/lib/permissions';
import { getLabel } from '@/lib/labels';
import { formatDate, formatRelative } from '@/lib/formatting';
import { CHART_COLORS } from '@/lib/chart-colors';
import { cn, initials as initialsOf } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { CompanyLogo, type CompanyLogoSubject } from '@/components/shared/company-logo';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { toast } from '@/components/ui/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

/* The status palette. `pending` is the only state that asks for something
 * today, so it is the only one that carries warning colour; `waiting` is an
 * instruction to do nothing, which reads as quiet rather than alarming. */
const STATUS_CLASS: Record<FollowUpStatus, string> = {
  pending: 'bg-warning-subtle text-warning-text',
  scheduled: 'bg-info-subtle text-info-text',
  waiting: 'bg-muted text-muted-foreground',
  contacted: 'bg-success-subtle text-success-text',
  closed: 'bg-muted text-muted-foreground',
};

/** Deterministic accent for the initials tile, stable across renders. */
function accentFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHART_COLORS[hash % CHART_COLORS.length];
}

/**
 * FollowUp -> the shape the shared logo tile consumes.
 *
 * Rows with no company get the initials tile and nothing else: passing an
 * unlinked row's own id as `logoUpdatedAt` would send the browser after
 * /api/companies/<followUpId>/logo, which cannot exist.
 */
function logoSubject(row: FollowUp): CompanyLogoSubject {
  return {
    id: row.companyId ?? row.id,
    legalName: row.companyName,
    tradingName: undefined,
    initials: initialsOf(row.companyName),
    accentColor: accentFor(row.companyName),
    logoUpdatedAt: row.companyId ? row.logoUpdatedAt : undefined,
  };
}

const ALL = '__all__';

interface FormState {
  id?: string;
  companyId: string;
  companyName: string;
  domain: string;
  status: FollowUpStatus;
  followUpOn: string;
  reason: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  companyId: '', companyName: '', domain: '', status: 'pending',
  followUpOn: '', reason: '', notes: '',
};

function toForm(row: FollowUp): FormState {
  return {
    id: row.id,
    companyId: row.companyId ?? '',
    companyName: row.companyName,
    domain: row.domain ?? '',
    status: row.status,
    followUpOn: row.followUpOn ?? '',
    reason: row.reason ?? '',
    notes: row.notes ?? '',
  };
}

function toInput(form: FormState): FollowUpFormInput {
  return {
    companyId: form.companyId || null,
    companyName: form.companyName,
    domain: form.domain || null,
    status: form.status,
    followUpOn: form.followUpOn || null,
    reason: form.reason || null,
    notes: form.notes || null,
  };
}

export default function FollowUpsPage() {
  const t = useTranslations('AdminFollowUps');
  const locale = useLocale() as Locale;
  const { session } = useSession();
  const role = session?.role;
  const canManage = !!role && canEdit(role, 'follow_ups');
  const { confirm, ConfirmDialog: confirmDialog } = useConfirm();

  const [rows, setRows] = useState<FollowUp[] | null>(null);
  const [stats, setStats] = useState<FollowUpStats | null>(null);
  const [companies, setCompanies] = useState<{ id: string; name: string; countryCode: string }[]>([]);
  const [fStatus, setFStatus] = useState<string>(ALL);
  const [fSource, setFSource] = useState<string>(ALL);
  const [preview, setPreview] = useState<FollowUp | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const statusLabel = (s: FollowUpStatus) => getLabel('followUpStatus', s);
  const sourceLabel = (s: FollowUpSource) => getLabel('followUpSource', s);

  function refresh() {
    void followUpRegisterService.list().then(setRows);
    void followUpRegisterService.getStatistics().then(setStats);
  }

  useEffect(() => {
    refresh();
    // Only editors are offered the picker, so only they need to pay for it.
    if (canManage) void followUpRegisterService.companyOptions().then(setCompanies);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const visible = useMemo(() => {
    let list = rows ?? [];
    if (fStatus !== ALL) list = list.filter((r) => r.status === fStatus);
    if (fSource !== ALL) list = list.filter((r) => r.source === fSource);
    return list;
  }, [rows, fStatus, fSource]);

  /**
   * Inline status change.
   *
   * Sends only the status, unlike the investors table which has to resend the
   * whole row: `setFollowUpStatus` is a narrow action for exactly this, so a
   * stale tab cannot revert a date or a note somebody else just edited.
   */
  async function changeStatus(row: FollowUp, status: FollowUpStatus) {
    if (status === row.status) return;
    const before = rows;
    setRows((prev) => (prev ? prev.map((r) => (r.id === row.id ? { ...r, status } : r)) : prev));
    try {
      const saved = await followUpRegisterService.setStatus(row.id, status);
      if (!saved) throw new Error('update_refused');
      setRows((prev) => (prev ? prev.map((r) => (r.id === row.id ? saved : r)) : prev));
      void followUpRegisterService.getStatistics().then(setStats);
      toast({
        variant: 'success',
        title: t('toastSavedTitle'),
        description: t('toastStatusDescription', { name: row.companyName, status: statusLabel(status) }),
      });
    } catch {
      setRows(before ?? null);
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('toastActionFailedDescription') });
    }
  }

  /** Inline date change, same contract as the status control above. */
  async function changeDate(row: FollowUp, value: string) {
    const next = value || null;
    if ((row.followUpOn ?? null) === next) return;
    const before = rows;
    setRows((prev) =>
      prev ? prev.map((r) => (r.id === row.id ? { ...r, followUpOn: next ?? undefined } : r)) : prev,
    );
    try {
      const saved = await followUpRegisterService.setStatus(row.id, row.status, next);
      if (!saved) throw new Error('update_refused');
      setRows((prev) => (prev ? prev.map((r) => (r.id === row.id ? saved : r)) : prev));
      void followUpRegisterService.getStatistics().then(setStats);
    } catch {
      setRows(before ?? null);
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('toastActionFailedDescription') });
    }
  }

  async function save() {
    if (!form) return;
    if (!form.companyName.trim()) {
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('nameRequired') });
      return;
    }
    setSaving(true);
    try {
      const input = toInput(form);
      const result = form.id
        ? await followUpRegisterService.update(form.id, input)
        : await followUpRegisterService.create(input);
      if (!result) throw new Error('missing');
      if (!result.ok) {
        toast({
          variant: 'danger',
          title: t('toastActionFailedTitle'),
          description: result.reason === 'duplicate_company' ? t('duplicateCompany') : t('nameRequired'),
        });
        return;
      }
      setForm(null);
      refresh();
      if (canManage) void followUpRegisterService.companyOptions().then(setCompanies);
      toast({
        variant: 'success',
        title: t('toastSavedTitle'),
        description: t('toastSavedDescription', { name: result.followUp.companyName }),
      });
    } catch {
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('toastActionFailedDescription') });
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: FollowUp) {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      description: t('deleteConfirmDescription', { name: row.companyName }),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await followUpRegisterService.remove(row.id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
      void followUpRegisterService.getStatistics().then(setStats);
      toast({ variant: 'success', title: t('toastDeletedTitle'), description: t('toastDeletedDescription', { name: row.companyName }) });
    } catch {
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('toastActionFailedDescription') });
    }
  }

  /** Re-scan the mailbox for companies that have gone quiet since last time. */
  async function sync() {
    setSyncing(true);
    try {
      const report = await followUpRegisterService.sync();
      refresh();
      toast({
        variant: 'success',
        title: t('syncDoneTitle'),
        description: t('syncDoneDescription', { created: report.created, refreshed: report.refreshed }),
      });
    } catch {
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('toastActionFailedDescription') });
    } finally {
      setSyncing(false);
    }
  }

  const columns: Column<FollowUp>[] = [
    {
      key: 'company',
      header: t('colCompany'),
      sortValue: (r) => r.companyName,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <CompanyLogo company={logoSubject(r)} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.companyName}</p>
            {r.domain && <p className="truncate text-xs text-muted-foreground">{r.domain}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('colStatus'),
      sortValue: (r) => r.status,
      // Editors change the status right here — the whole point of the table.
      // The trigger is dressed as the badge so the column reads the same to
      // someone who cannot edit. stopPropagation keeps the row's quick-view
      // click out of the dropdown interaction.
      cell: (r) =>
        canManage ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Select value={r.status} onValueChange={(v) => void changeStatus(r, v as FollowUpStatus)}>
              <SelectTrigger
                aria-label={t('changeStatus', { name: r.companyName })}
                className={cn(
                  // min-w-fit + nowrap + line-clamp-none undo the base trigger's
                  // w-full/line-clamp-1, which would ellipsize the longer
                  // labels ("Non contattare anc…") in this narrow column.
                  'h-7 w-auto min-w-fit gap-1 whitespace-nowrap rounded-full border-transparent px-2.5 text-xs font-semibold shadow-none focus:ring-1 [&>span]:line-clamp-none [&>span]:whitespace-nowrap',
                  STATUS_CLASS[r.status],
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOLLOW_UP_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <Badge className={cn('border-transparent', STATUS_CLASS[r.status])}>{statusLabel(r.status)}</Badge>
        ),
    },
    {
      key: 'followUpOn',
      header: t('colFollowUpOn'),
      sortValue: (r) => r.followUpOn ?? '',
      cell: (r) => {
        const remaining = daysUntil(r.followUpOn);
        return canManage ? (
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
            <Input
              type="date"
              value={r.followUpOn ?? ''}
              aria-label={t('changeDate', { name: r.companyName })}
              onChange={(e) => void changeDate(r, e.target.value)}
              className="h-7 w-[9.5rem] px-2 text-xs"
            />
            {remaining !== null && remaining > 0 && (
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {t('inDays', { days: remaining })}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {r.followUpOn ? formatDate(r.followUpOn, locale) : '—'}
          </span>
        );
      },
    },
    {
      key: 'quiet',
      header: t('colQuiet'),
      sortValue: (r) => r.quietDays ?? -1,
      cell: (r) =>
        r.quietDays == null ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <span className="text-sm text-foreground">
            {t('quietDays', { days: r.quietDays })}
          </span>
        ),
    },
    {
      key: 'lastContact',
      header: t('colLastContact'),
      hideable: true,
      sortValue: (r) => r.lastContactAt ?? '',
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.lastContactAt ? formatRelative(r.lastContactAt, locale) : '—'}
        </span>
      ),
    },
    {
      key: 'source',
      header: t('colSource'),
      hideable: true,
      sortValue: (r) => r.source,
      cell: (r) => <Badge variant="muted">{sourceLabel(r.source)}</Badge>,
    },
    {
      key: 'reason',
      header: t('colReason'),
      hideable: true,
      sortValue: (r) => r.reason ?? '',
      cell: (r) =>
        r.reason ? (
          <span className="line-clamp-2 max-w-[26rem] text-sm text-foreground">{r.reason}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        actions={
          canManage ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void sync()} disabled={syncing}>
                <RefreshCw className={cn('h-4 w-4', syncing && 'motion-safe:animate-spin')} />
                {syncing ? t('syncRunning') : t('sync')}
              </Button>
              <Button variant="gold" onClick={() => setForm({ ...EMPTY_FORM })}>
                <Plus className="h-4 w-4" />
                {t('addFollowUp')}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('statTotal')} value={stats?.total ?? 0} icon={CalendarClock} tone="gold" delay={0} />
        <StatCard
          label={t('statDue')}
          value={stats?.due ?? 0}
          icon={AlarmClock}
          tone="warning"
          hint={t('statDueHint')}
          delay={0.05}
        />
        <StatCard
          label={t('statWaiting')}
          value={stats?.waiting ?? 0}
          icon={PauseCircle}
          tone="info"
          hint={t('statWaitingHint')}
          delay={0.1}
        />
        <StatCard label={t('statContacted')} value={stats?.contacted ?? 0} icon={CheckCircle2} tone="success" delay={0.15} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-9 w-full sm:w-[220px]" aria-label={t('statusFilterLabel')}>
            <SelectValue placeholder={t('statusFilterLabel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allStatuses')}</SelectItem>
            {FOLLOW_UP_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fSource} onValueChange={setFSource}>
          <SelectTrigger className="h-9 w-full sm:w-[220px]" aria-label={t('sourceFilterLabel')}>
            <SelectValue placeholder={t('sourceFilterLabel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allSources')}</SelectItem>
            {FOLLOW_UP_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>{sourceLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable<FollowUp>
        data={visible}
        columns={columns}
        getRowId={(r) => r.id}
        loading={rows === null}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchValue={(r) => [r.companyName, r.domain, r.reason, r.notes].filter(Boolean).join(' ')}
        onRowClick={(r) => setPreview(r)}
        rowActions={(r) => (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={t('quickView')} onClick={() => setPreview(r)}>
              <Eye className="h-4 w-4" />
            </Button>
            {canManage && (
              <>
                <Button variant="ghost" size="icon-sm" aria-label={t('edit')} onClick={() => setForm(toForm(r))}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('delete')}
                  className="text-danger-text"
                  onClick={() => void remove(r)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}
        enableColumnVisibility
        enableDensityToggle
        exportFilename="follow-ups"
        defaultSortKey="followUpOn"
        defaultSortDir="asc"
        storageKey="follow-ups"
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {/* ── Quick view ── */}
      <Sheet open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent side="right" className="max-w-md">
          {preview && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <CompanyLogo company={logoSubject(preview)} />
                  {preview.companyName}
                </SheetTitle>
                {preview.domain && <SheetDescription>{preview.domain}</SheetDescription>}
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <Badge className={cn('border-transparent', STATUS_CLASS[preview.status])}>
                  {statusLabel(preview.status)}
                </Badge>
                <Badge variant="muted">{sourceLabel(preview.source)}</Badge>
                {isDue(preview) && <Badge variant="warning">{t('dueNow')}</Badge>}
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('colFollowUpOn')}</dt>
                    <dd className="font-medium">
                      {preview.followUpOn ? formatDate(preview.followUpOn, locale) : '—'}
                    </dd>
                  </div>
                </div>
                {preview.quietDays != null && (
                  <div className="flex items-start gap-2">
                    <AlarmClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs text-muted-foreground">{t('colQuiet')}</dt>
                      <dd className="font-medium">{t('quietDays', { days: preview.quietDays })}</dd>
                    </div>
                  </div>
                )}
                {preview.reason && (
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{t('colReason')}</dt>
                      <dd className="font-medium">{preview.reason}</dd>
                    </div>
                  </div>
                )}
                {preview.notes && (
                  <div className="flex items-start gap-2">
                    <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{t('notesLabel')}</dt>
                      <dd className="whitespace-pre-wrap font-medium">{preview.notes}</dd>
                    </div>
                  </div>
                )}
              </dl>

              <SheetFooter>
                {canManage && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm(toForm(preview));
                      setPreview(null);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    {t('edit')}
                  </Button>
                )}
                <SheetClose asChild>
                  <Button variant="ghost">{t('close')}</Button>
                </SheetClose>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add / edit ── */}
      <Sheet open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent side="right" className="max-w-md">
          {form && (
            <>
              <SheetHeader>
                <SheetTitle>{form.id ? t('editTitle') : t('addTitle')}</SheetTitle>
                <SheetDescription>{t('formDescription')}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                {/* A new row may point at a company or stand alone — the
                    outreach freeze names counterparties with no company record
                    yet, and those still have to be listed. */}
                {!form.id && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fu-company">{t('companyPickerLabel')}</Label>
                    <Select
                      value={form.companyId || ALL}
                      onValueChange={(v) => {
                        const picked = companies.find((c) => c.id === v);
                        setForm((f) =>
                          f
                            ? {
                                ...f,
                                companyId: v === ALL ? '' : v,
                                companyName: picked ? picked.name : f.companyName,
                              }
                            : f,
                        );
                      }}
                    >
                      <SelectTrigger id="fu-company">
                        <SelectValue placeholder={t('companyPickerPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>{t('noCompany')}</SelectItem>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="fu-name">{t('nameLabel')}</Label>
                  <Input
                    id="fu-name"
                    value={form.companyName}
                    onChange={(e) => setForm((f) => (f ? { ...f, companyName: e.target.value } : f))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fu-domain">{t('domainLabel')}</Label>
                  <Input
                    id="fu-domain"
                    value={form.domain}
                    placeholder="example.com"
                    onChange={(e) => setForm((f) => (f ? { ...f, domain: e.target.value } : f))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fu-status">{t('statusLabel')}</Label>
                    <Select
                      value={form.status}
                      onValueChange={(v) => setForm((f) => (f ? { ...f, status: v as FollowUpStatus } : f))}
                    >
                      <SelectTrigger id="fu-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLLOW_UP_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fu-date">{t('dateLabel')}</Label>
                    <Input
                      id="fu-date"
                      type="date"
                      value={form.followUpOn}
                      onChange={(e) => setForm((f) => (f ? { ...f, followUpOn: e.target.value } : f))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fu-reason">{t('reasonLabel')}</Label>
                  <Input
                    id="fu-reason"
                    value={form.reason}
                    onChange={(e) => setForm((f) => (f ? { ...f, reason: e.target.value } : f))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fu-notes">{t('notesLabel')}</Label>
                  <Textarea
                    id="fu-notes"
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm((f) => (f ? { ...f, notes: e.target.value } : f))}
                  />
                </div>
              </div>

              <SheetFooter>
                <Button variant="gold" onClick={() => void save()} disabled={saving}>
                  {saving ? t('saving') : t('save')}
                </Button>
                <SheetClose asChild>
                  <Button variant="ghost">{t('cancel')}</Button>
                </SheetClose>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {confirmDialog}
    </div>
  );
}
