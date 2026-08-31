'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Landmark,
  CheckCircle2,
  RotateCcw,
  Send,
  Eye,
  Pencil,
  Trash2,
  Mail,
  MapPin,
  CalendarClock,
  ExternalLink,
  ImageDown,
  Plus,
} from 'lucide-react';

import type { Investor, InvestorStatus, Locale } from '@/lib/types';
import { INVESTOR_STATUSES } from '@/lib/investors';
import { investorService } from '@/lib/mock-services';
import type { InvestorFormInput } from '@/lib/services/investor.mapper';
import { useSession } from '@/components/providers/session-provider';
import { canEdit } from '@/lib/permissions';
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

/* Investor statuses are their own vocabulary (see lib/investors.ts), so the
 * badge palette lives here rather than in StatusBadge's CRM kinds. Silence is
 * informational (first_contact = info), not a warning and never a rejection. */
const STATUS_CLASS: Record<InvestorStatus, string> = {
  in_contact: 'bg-success-subtle text-success-text',
  to_recontact: 'bg-warning-subtle text-warning-text',
  rejected: 'bg-danger-subtle text-danger-text',
  first_contact: 'bg-info-subtle text-info-text',
};

/** Deterministic accent for the initials tile, stable across renders. */
function accentFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CHART_COLORS[hash % CHART_COLORS.length];
}

/** Investor -> the shape the shared logo tile consumes. */
function logoSubject(inv: Investor): CompanyLogoSubject {
  return {
    id: inv.id,
    legalName: inv.name,
    tradingName: undefined,
    initials: initialsOf(inv.name),
    accentColor: accentFor(inv.name),
    logoUpdatedAt: inv.logoUpdatedAt,
  };
}

const ALL = '__all__';

interface FormState {
  id?: string;
  name: string;
  status: InvestorStatus;
  emails: string;
  country: string;
  city: string;
  domain: string;
  firstContactAt: string;
  lastContactAt: string;
  nextStep: string;
  gmailUrl: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: '', status: 'first_contact', emails: '', country: '', city: '', domain: '',
  firstContactAt: '', lastContactAt: '', nextStep: '', gmailUrl: '', notes: '',
};

function toForm(inv: Investor): FormState {
  return {
    id: inv.id,
    name: inv.name,
    status: inv.status,
    emails: inv.emails.join('; '),
    country: inv.country ?? '',
    city: inv.city ?? '',
    domain: inv.domain ?? '',
    firstContactAt: inv.firstContactAt?.slice(0, 10) ?? '',
    lastContactAt: inv.lastContactAt?.slice(0, 10) ?? '',
    nextStep: inv.nextStep ?? '',
    gmailUrl: inv.gmailUrl ?? '',
    notes: inv.notes ?? '',
  };
}

export default function InvestorsPage() {
  const t = useTranslations('AdminInvestors');
  const locale = useLocale() as Locale;
  const { session } = useSession();
  const canManage = !!session?.role && canEdit(session.role, 'investors');
  const { confirm, ConfirmDialog: confirmDialog } = useConfirm();

  const [rows, setRows] = useState<Investor[] | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof investorService.getStatistics>> | null>(null);
  const [fStatus, setFStatus] = useState<string>(ALL);
  const [preview, setPreview] = useState<Investor | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [importingLogos, setImportingLogos] = useState(false);

  const refresh = () => {
    investorService.list().then(setRows);
    investorService.getStatistics().then(setStats);
  };
  useEffect(refresh, []);

  const visible = useMemo(
    () => (rows ?? []).filter((r) => fStatus === ALL || r.status === fStatus),
    [rows, fStatus],
  );

  const statusLabel = (s: InvestorStatus) => t(`status_${s}`);

  async function save() {
    if (!form) return;
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    const input: InvestorFormInput = {
      name,
      status: form.status,
      emails: form.emails,
      country: form.country,
      city: form.city,
      domain: form.domain,
      firstContactAt: form.firstContactAt || null,
      lastContactAt: form.lastContactAt || null,
      nextStep: form.nextStep,
      gmailUrl: form.gmailUrl,
      notes: form.notes,
    };
    try {
      const result = form.id
        ? await investorService.update(form.id, input)
        : await investorService.create(input);
      if (!result) return;
      if (!result.ok) {
        toast({ variant: 'danger', title: t('toastDuplicateTitle'), description: t('toastDuplicateDescription', { name }) });
        return;
      }
      toast({ variant: 'success', title: t('toastSavedTitle'), description: t('toastSavedDescription', { name }) });
      setForm(null);
      refresh();
    } catch {
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('toastActionFailedDescription') });
    } finally {
      setSaving(false);
    }
  }

  async function remove(inv: Investor) {
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      description: t('deleteConfirmDescription', { name: inv.name }),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await investorService.remove(inv.id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== inv.id) : prev));
      void investorService.getStatistics().then(setStats);
      toast({ variant: 'success', title: t('toastDeletedTitle'), description: t('toastDeletedDescription', { name: inv.name }) });
    } catch {
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('toastActionFailedDescription') });
    }
  }

  /* One click of the button runs one 60s budget; `remaining` tells the admin
   * whether to click again. Same contract as the companies backfill. */
  async function importLogos() {
    setImportingLogos(true);
    try {
      const response = await fetch('/api/investors/import-logos', { method: 'POST' });
      if (!response.ok) throw new Error(String(response.status));
      const result = (await response.json()) as { updated: number; remaining: number };
      toast({
        variant: 'success',
        title: t('importLogosDoneTitle'),
        description: t('importLogosDoneDescription', { updated: result.updated, remaining: result.remaining }),
      });
      refresh();
    } catch {
      toast({ variant: 'danger', title: t('toastActionFailedTitle'), description: t('importLogosFailedDescription') });
    } finally {
      setImportingLogos(false);
    }
  }

  const columns: Column<Investor>[] = [
    {
      key: 'investor',
      header: t('colInvestor'),
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <CompanyLogo company={logoSubject(r)} endpointBase="/api/investors" />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.name}</p>
            {r.domain && <p className="truncate text-xs text-muted-foreground">{r.domain}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('colStatus'),
      sortValue: (r) => r.status,
      cell: (r) => (
        <Badge className={cn('border-transparent', STATUS_CLASS[r.status])}>{statusLabel(r.status)}</Badge>
      ),
    },
    {
      key: 'location',
      header: t('colLocation'),
      hideable: true,
      sortValue: (r) => `${r.country ?? ''} ${r.city ?? ''}`,
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {[r.city, r.country].filter(Boolean).join(', ') || '—'}
        </span>
      ),
    },
    {
      key: 'emails',
      header: t('colEmails'),
      hideable: true,
      sortValue: (r) => r.emails[0] ?? '',
      cell: (r) =>
        r.emails.length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          <div className="flex items-center gap-1.5" title={r.emails.join('\n')}>
            <span className="truncate text-sm text-muted-foreground">{r.emails[0]}</span>
            {r.emails.length > 1 && <Badge variant="muted">+{r.emails.length - 1}</Badge>}
          </div>
        ),
    },
    {
      key: 'firstContact',
      header: t('colFirstContact'),
      hideable: true,
      sortValue: (r) => r.firstContactAt ?? '',
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.firstContactAt ? formatDate(r.firstContactAt, locale) : '—'}
        </span>
      ),
    },
    {
      key: 'lastContact',
      header: t('colLastContact'),
      sortValue: (r) => r.lastContactAt ?? '',
      cell: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.lastContactAt ? formatRelative(r.lastContactAt, locale) : '—'}
        </span>
      ),
    },
    {
      key: 'nextStep',
      header: t('colNextStep'),
      hideable: true,
      sortValue: (r) => r.nextStep ?? '',
      cell: (r) =>
        r.nextStep ? (
          <span className="line-clamp-2 max-w-[26rem] text-sm text-foreground">{r.nextStep}</span>
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
              <Button variant="outline" onClick={() => void importLogos()} disabled={importingLogos}>
                <ImageDown className="h-4 w-4" />
                {importingLogos ? t('importLogosRunning') : t('importLogos')}
              </Button>
              <Button variant="gold" onClick={() => setForm({ ...EMPTY_FORM })}>
                <Plus className="h-4 w-4" />
                {t('addInvestor')}
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('statTotal')}
          value={stats?.total ?? 0}
          icon={Landmark}
          tone="gold"
          hint={t('statTotalHint', { count: stats?.rejected ?? 0 })}
          delay={0}
        />
        <StatCard label={t('statInContact')} value={stats?.inContact ?? 0} icon={CheckCircle2} tone="success" delay={0.05} />
        <StatCard label={t('statToRecontact')} value={stats?.toRecontact ?? 0} icon={RotateCcw} tone="warning" delay={0.1} />
        <StatCard label={t('statFirstContact')} value={stats?.firstContact ?? 0} icon={Send} tone="info" delay={0.15} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="h-9 w-full sm:w-[220px]" aria-label={t('statusFilterLabel')}>
            <SelectValue placeholder={t('statusFilterLabel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allStatuses')}</SelectItem>
            {INVESTOR_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable<Investor>
        data={visible}
        columns={columns}
        getRowId={(r) => r.id}
        loading={rows === null}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchValue={(r) =>
          [r.name, r.domain, r.country, r.city, r.nextStep, ...r.emails].filter(Boolean).join(' ')
        }
        onRowClick={(r) => setPreview(r)}
        rowActions={(r) => (
          <div className="flex items-center gap-1">
            {r.gmailUrl && (
              <Button variant="ghost" size="icon-sm" aria-label={t('openGmail')} asChild>
                <a href={r.gmailUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  <Mail className="h-4 w-4" />
                </a>
              </Button>
            )}
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
        exportFilename="investors"
        defaultSortKey="lastContact"
        defaultSortDir="desc"
        storageKey="investors"
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
                  <CompanyLogo company={logoSubject(preview)} endpointBase="/api/investors" />
                  {preview.name}
                </SheetTitle>
                {preview.domain && <SheetDescription>{preview.domain}</SheetDescription>}
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <Badge className={cn('border-transparent', STATUS_CLASS[preview.status])}>
                  {statusLabel(preview.status)}
                </Badge>
                {preview.responseType && <Badge variant="secondary">{preview.responseType}</Badge>}
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('colLocation')}</dt>
                    <dd className="font-medium">{[preview.city, preview.country].filter(Boolean).join(', ') || '—'}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{t('colEmails')}</dt>
                    {preview.emails.length === 0 ? (
                      <dd className="font-medium">—</dd>
                    ) : (
                      preview.emails.map((e) => (
                        <dd key={e} className="truncate font-medium">{e}</dd>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('contactWindow')}</dt>
                    <dd className="font-medium">
                      {preview.firstContactAt ? formatDate(preview.firstContactAt, locale) : '—'}
                      {' → '}
                      {preview.lastContactAt ? formatDate(preview.lastContactAt, locale) : '—'}
                    </dd>
                  </div>
                </div>
              </dl>

              {preview.nextStep && (
                <div className="rounded-lg border border-dashed bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t('colNextStep')}</p>
                  <p className="mt-0.5 text-sm font-medium">{preview.nextStep}</p>
                </div>
              )}
              {preview.notes && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t('formNotesLabel')}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{preview.notes}</p>
                </div>
              )}

              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">{t('close')}</Button>
                </SheetClose>
                {preview.gmailUrl && (
                  <Button variant="gold" asChild>
                    <a href={preview.gmailUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      {t('openGmail')}
                    </a>
                  </Button>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add / edit ── */}
      <Sheet open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <SheetContent side="right" className="max-w-md overflow-y-auto">
          {form && (
            <>
              <SheetHeader>
                <SheetTitle>{form.id ? t('editTitle') : t('addInvestor')}</SheetTitle>
                <SheetDescription>{t('formSubtitle')}</SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-name">{t('formNameLabel')}</Label>
                  <Input id="inv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('colStatus')}</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InvestorStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INVESTOR_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-emails">{t('formEmailsLabel')}</Label>
                  <Input
                    id="inv-emails"
                    value={form.emails}
                    placeholder="info@fund.com; partner@fund.com"
                    onChange={(e) => setForm({ ...form, emails: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">{t('formEmailsHint')}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-country">{t('formCountryLabel')}</Label>
                    <Input id="inv-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-city">{t('formCityLabel')}</Label>
                    <Input id="inv-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-domain">{t('formDomainLabel')}</Label>
                  <Input id="inv-domain" value={form.domain} placeholder="fund.com" onChange={(e) => setForm({ ...form, domain: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-first">{t('colFirstContact')}</Label>
                    <Input id="inv-first" type="date" value={form.firstContactAt} onChange={(e) => setForm({ ...form, firstContactAt: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-last">{t('colLastContact')}</Label>
                    <Input id="inv-last" type="date" value={form.lastContactAt} onChange={(e) => setForm({ ...form, lastContactAt: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-next">{t('colNextStep')}</Label>
                  <Textarea id="inv-next" rows={3} value={form.nextStep} onChange={(e) => setForm({ ...form, nextStep: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-gmail">{t('formGmailUrlLabel')}</Label>
                  <Input id="inv-gmail" value={form.gmailUrl} placeholder="https://mail.google.com/mail/#all/…" onChange={(e) => setForm({ ...form, gmailUrl: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-notes">{t('formNotesLabel')}</Label>
                  <Textarea id="inv-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>

              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">{t('cancel')}</Button>
                </SheetClose>
                <Button variant="gold" onClick={() => void save()} disabled={saving || !form.name.trim()}>
                  {saving ? t('saving') : t('save')}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {confirmDialog}
    </div>
  );
}
