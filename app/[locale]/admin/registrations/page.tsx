'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Inbox,
  Clock,
  Info,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  MapPin,
  Globe,
  CalendarClock,
  UserPlus,
  MessageSquarePlus,
  ArrowRightCircle,
} from 'lucide-react';

import { registrationService, userService } from '@/lib/mock-services';
import type {
  Registration,
  RegistrationStatus,
  Locale,
} from '@/lib/types';
import type { StaffMember } from '@/fixtures';
import { getLabel } from '@/lib/labels';
import { formatRelative, formatDate, flagEmoji } from '@/lib/formatting';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';

type Stats = Awaited<ReturnType<typeof registrationService.getStatistics>>;

const ALL = '__all__';
const TODAY = '2026-06-18';

/** Tab → which statuses are included. */
const TAB_FILTER: Record<string, (r: Registration) => boolean> = {
  all: () => true,
  pending: (r) => ['submitted', 'email_verification', 'pending_approval'].includes(r.status),
  more_info: (r) => r.status === 'more_info_requested',
  approved: (r) => r.status === 'approved',
  rejected: (r) => r.status === 'rejected',
};

export default function RegistrationsPage() {
  const locale = useLocale() as Locale;
  const t = useTranslations('AdminRegistrations');

  const [rows, setRows] = React.useState<Registration[] | null>(null);
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [staff, setStaff] = React.useState<StaffMember[]>([]);

  const [tab, setTab] = React.useState<string>('all');

  // review panel
  const [active, setActive] = React.useState<Registration | null>(null);
  const [reviewOpen, setReviewOpen] = React.useState(false);

  React.useEffect(() => {
    registrationService.list().then(setRows);
    registrationService.getStatistics().then(setStats);
    userService.list().then(setStaff);
  }, []);

  const refreshStats = React.useCallback(() => {
    void registrationService.getStatistics().then(setStats);
  }, []);

  const filtered = React.useMemo(() => {
    const data = rows ?? [];
    const fn = TAB_FILTER[tab] ?? TAB_FILTER.all;
    return data.filter(fn);
  }, [rows, tab]);

  /* ── mutations (mock) ── */
  const patchRow = React.useCallback(
    (id: string, patch: Partial<Registration>) => {
      setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));
      setActive((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev));
      void registrationService.update(id, patch);
      refreshStats();
    },
    [refreshStats],
  );

  function openReview(r: Registration) {
    setActive(r);
    setReviewOpen(true);
  }

  /* ── table columns ── */
  const columns: Column<Registration>[] = [
    {
      key: 'reference',
      header: t('colReference'),
      sortValue: (r) => r.reference,
      cell: (r) => <span className="font-mono text-sm font-medium text-foreground">{r.reference}</span>,
    },
    {
      key: 'company',
      header: t('colCompany'),
      sortValue: (r) => r.legalName,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{r.legalName}</p>
          {r.tradingName && r.tradingName !== r.legalName ? (
            <p className="truncate text-xs text-muted-foreground">{r.tradingName}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('colType'),
      sortValue: (r) => getLabel('companyType', r.companyType),
      cell: (r) => <StatusBadge kind="companyType" value={r.companyType} />,
      hideable: true,
    },
    {
      key: 'country',
      header: t('colCountry'),
      sortValue: (r) => r.country,
      cell: (r) => (
        <span className="flex items-center gap-1.5 whitespace-nowrap text-sm">
          <span className="text-base leading-none">{flagEmoji(r.countryCode)}</span>
          {r.country}
        </span>
      ),
      hideable: true,
    },
    {
      key: 'applicant',
      header: t('colApplicant'),
      sortValue: (r) => `${r.contactFirstName} ${r.contactLastName}`,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {r.contactFirstName} {r.contactLastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{r.contactEmail}</p>
        </div>
      ),
      hideable: true,
    },
    {
      key: 'applications',
      header: t('colApplications'),
      cell: (r) => {
        const apps = r.intendedApplications ?? [];
        if (apps.length === 0) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <div className="flex flex-wrap items-center gap-1">
            {apps.slice(0, 2).map((a) => (
              <Badge key={a} variant="muted" className="text-2xs">
                {getLabel('applicationCategory', a)}
              </Badge>
            ))}
            {apps.length > 2 ? (
              <span className="text-2xs font-medium text-muted-foreground">+{apps.length - 2}</span>
            ) : null}
          </div>
        );
      },
      hideable: true,
    },
    {
      key: 'submitted',
      header: t('colSubmitted'),
      align: 'right',
      sortable: true,
      sortValue: (r) => new Date(r.createdAt).getTime(),
      cell: (r) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatRelative(r.createdAt, locale)}
        </span>
      ),
      hideable: true,
    },
    {
      key: 'status',
      header: t('colStatus'),
      sortValue: (r) => getLabel('registrationStatus', r.status),
      cell: (r) => <StatusBadge kind="registrationStatus" value={r.status} />,
    },
  ];

  /* ── mobile card ── */
  function mobileCard(r: Registration) {
    return (
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-2xs font-semibold text-muted-foreground">{r.reference}</p>
            <p className="truncate text-sm font-medium text-foreground">{r.legalName}</p>
          </div>
          <StatusBadge kind="registrationStatus" value={r.status} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-sm leading-none">{flagEmoji(r.countryCode)}</span>
          {r.country} · {r.contactFirstName} {r.contactLastName}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <StatusBadge kind="companyType" value={r.companyType} />
          <span className="text-2xs text-muted-foreground">{formatRelative(r.createdAt, locale)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('pageTitle')} subtitle={t('pageSubtitle')} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-5">
        <StatCard label={t('statTotal')} value={stats?.total ?? 0} icon={Inbox} tone="gold" />
        <StatCard label={t('statPending')} value={stats?.pending ?? 0} icon={Clock} tone="warning" delay={0.05} />
        <StatCard label={t('statMoreInfo')} value={stats?.moreInfo ?? 0} icon={Info} tone="info" delay={0.1} />
        <StatCard label={t('statApproved')} value={stats?.approved ?? 0} icon={CheckCircle2} tone="success" delay={0.15} />
        <StatCard label={t('statRejected')} value={stats?.rejected ?? 0} icon={XCircle} tone="danger" delay={0.2} />
      </div>

      {/* Status tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">{t('tabAll')}</TabsTrigger>
          <TabsTrigger value="pending">{t('tabPending')}</TabsTrigger>
          <TabsTrigger value="more_info">{t('tabMoreInfo')}</TabsTrigger>
          <TabsTrigger value="approved">{t('tabApproved')}</TabsTrigger>
          <TabsTrigger value="rejected">{t('tabRejected')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Table */}
      <DataTable<Registration>
        data={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        loading={rows === null}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchValue={(r) =>
          [r.reference, r.legalName, r.tradingName, r.country, `${r.contactFirstName} ${r.contactLastName}`, r.contactEmail]
            .filter(Boolean)
            .join(' ')
        }
        pageSize={12}
        onRowClick={openReview}
        rowActions={(r) => (
          <Button variant="ghost" size="sm" onClick={() => openReview(r)}>
            {t('rowActionReview')}
          </Button>
        )}
        enableColumnVisibility
        enableDensityToggle
        mobileCard={mobileCard}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
        exportFilename="registrations"
        storageKey="registrations-table"
      />

      <ReviewPanel
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        registration={active}
        staff={staff}
        locale={locale}
        onPatch={patchRow}
      />
    </div>
  );
}

/* ────────────────────────────── Review panel ────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function ReviewPanel({
  open,
  onOpenChange,
  registration,
  staff,
  locale,
  onPatch,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  registration: Registration | null;
  staff: StaffMember[];
  locale: Locale;
  onPatch: (id: string, patch: Partial<Registration>) => void;
}) {
  const t = useTranslations('AdminRegistrations');
  const [assignee, setAssignee] = React.useState<string>('');
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [infoOpen, setInfoOpen] = React.useState(false);
  const [infoMessage, setInfoMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setAssignee(registration?.decidedByUserId ?? '');
    setInfoMessage('');
  }, [registration]);

  if (!registration) return null;
  const r = registration;

  const decided = r.status === 'approved' || r.status === 'rejected';

  async function simulate() {
    setBusy(true);
    await new Promise((res) => setTimeout(res, 500));
    setBusy(false);
  }

  async function approve() {
    await simulate();
    onPatch(r.id, { status: 'approved', decidedAt: TODAY, decidedByUserId: assignee || 'u_giuseppe' });
    toast({
      variant: 'success',
      title: t('toastApprovedTitle'),
      description: t('toastApprovedDescription', { reference: r.reference, company: r.legalName }),
    });
  }

  async function reject() {
    await simulate();
    onPatch(r.id, { status: 'rejected', decidedAt: TODAY, decidedByUserId: assignee || 'u_giuseppe' });
    toast({
      variant: 'warning',
      title: t('toastRejectedTitle'),
      description: t('toastRejectedDescription', { reference: r.reference, company: r.legalName }),
    });
  }

  async function requestInfo() {
    await simulate();
    onPatch(r.id, {
      status: 'more_info_requested',
      adminNote: infoMessage.trim() || r.adminNote,
    });
    toast({
      variant: 'info',
      title: t('toastInfoRequestedTitle'),
      description: t('toastInfoRequestedDescription', { email: r.contactEmail }),
    });
    setInfoOpen(false);
    setInfoMessage('');
  }

  function assign(userId: string) {
    setAssignee(userId);
    onPatch(r.id, { decidedByUserId: userId });
    const m = staff.find((s) => s.id === userId);
    toast({
      variant: 'success',
      title: t('toastStaffAssignedTitle'),
      description: m
        ? t('toastStaffAssignedDescription', { reference: r.reference, name: `${m.firstName} ${m.lastName}` })
        : t('toastStaffAssignedFallback'),
    });
  }

  async function convertToCompany() {
    await simulate();
    onPatch(r.id, { status: 'approved', decidedAt: TODAY, decidedByUserId: assignee || 'u_giuseppe' });
    toast({
      variant: 'success',
      title: t('toastCompanyCreatedTitle'),
      description: t('toastCompanyCreatedDescription', { company: r.legalName }),
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-muted-foreground">{r.reference}</span>
              <StatusBadge kind="registrationStatus" value={r.status} />
            </div>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-gold" />
              {r.legalName}
            </SheetTitle>
            <SheetDescription>
              {t('submittedPrefix')} {formatRelative(r.createdAt, locale)} · {formatDate(r.createdAt, locale)}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 text-sm">
            {/* Company */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionCompany')}</h4>
              <div className="grid grid-cols-2 gap-3">
                {r.tradingName ? <Field label={t('fieldTradingName')}>{r.tradingName}</Field> : null}
                <Field label={t('fieldType')}>
                  <StatusBadge kind="companyType" value={r.companyType} />
                </Field>
                {r.companySize ? (
                  <Field label={t('fieldSize')}>{getLabel('companySize', r.companySize)}</Field>
                ) : null}
                <Field label={t('fieldCountry')}>
                  <span className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{flagEmoji(r.countryCode)}</span>
                    {r.country}
                  </span>
                </Field>
                <Field label={t('fieldCity')}>{r.city}</Field>
                {r.vatNumber ? <Field label={t('fieldVatNumber')}>{r.vatNumber}</Field> : null}
                {r.registrationNumber ? <Field label={t('fieldRegNumber')}>{r.registrationNumber}</Field> : null}
                {r.website ? (
                  <Field label={t('fieldWebsite')}>
                    <span className="inline-flex items-center gap-1 text-info">
                      <Globe className="h-3.5 w-3.5" />
                      {r.website}
                    </span>
                  </Field>
                ) : null}
              </div>
              {r.address ? (
                <p className="flex items-start gap-1.5 text-muted-foreground">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {[r.address, r.postalCode, r.city, r.region, r.country].filter(Boolean).join(', ')}
                </p>
              ) : null}
              {r.mainActivity ? <Field label={t('fieldMainActivity')}>{r.mainActivity}</Field> : null}
            </section>

            <Separator />

            {/* Contact */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('sectionPrimaryContact')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('fieldName')}>
                  {r.contactFirstName} {r.contactLastName}
                </Field>
                {r.contactJobTitle ? <Field label={t('fieldJobTitle')}>{r.contactJobTitle}</Field> : null}
                <Field label={t('fieldEmail')}>
                  <span className="inline-flex items-center gap-1 text-info">
                    <Mail className="h-3.5 w-3.5" />
                    {r.contactEmail}
                  </span>
                </Field>
                {r.contactPhone ? <Field label={t('fieldPhone')}>{r.contactPhone}</Field> : null}
              </div>
            </section>

            <Separator />

            {/* Interest */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionInterest')}</h4>
              {r.intendedApplications && r.intendedApplications.length > 0 ? (
                <Field label={t('fieldIntendedApplications')}>
                  <div className="flex flex-wrap gap-1">
                    {r.intendedApplications.map((a) => (
                      <Badge key={a} variant="info" className="text-2xs">
                        {getLabel('applicationCategory', a)}
                      </Badge>
                    ))}
                  </div>
                </Field>
              ) : null}
              {r.intendedTerritories && r.intendedTerritories.length > 0 ? (
                <Field label={t('fieldTerritories')}>{r.intendedTerritories.join(', ')}</Field>
              ) : null}
              {r.estimatedTimeline ? (
                <Field label={t('fieldEstimatedTimeline')}>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    {r.estimatedTimeline}
                  </span>
                </Field>
              ) : null}
              {r.reason ? <Field label={t('fieldReason')}>{r.reason}</Field> : null}
              {r.additionalMessage ? (
                <Field label={t('fieldAdditionalMessage')}>
                  <p className="rounded-md bg-muted/50 p-2 text-muted-foreground">{r.additionalMessage}</p>
                </Field>
              ) : null}
              {r.adminNote ? (
                <Field label={t('fieldAdminNote')}>
                  <p className="rounded-md bg-warning-subtle p-2 text-warning-foreground">{r.adminNote}</p>
                </Field>
              ) : null}
            </section>

            <Separator />

            {/* Assignment */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('sectionAssignStaff')}</h4>
              <Select value={assignee} onValueChange={assign}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectStaffPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} — {getLabel('role', s.role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          </div>

          <SheetFooter className="flex-col gap-2 sm:flex-col">
            {!decided ? (
              <div className="grid w-full grid-cols-2 gap-2">
                <Button variant="success" onClick={approve} disabled={busy}>
                  <CheckCircle2 className="h-4 w-4" />
                  {t('btnApprove')}
                </Button>
                <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={busy}>
                  <XCircle className="h-4 w-4" />
                  {t('btnReject')}
                </Button>
              </div>
            ) : null}
            <Button variant="outline" className="w-full" onClick={() => setInfoOpen(true)} disabled={busy}>
              <MessageSquarePlus className="h-4 w-4" />
              {t('btnRequestInfo')}
            </Button>
            <Button variant="gold" className="w-full" onClick={convertToCompany} disabled={busy}>
              <ArrowRightCircle className="h-4 w-4" />
              {t('btnConvertToCompany')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t('rejectDialogTitle')}
        description={t('rejectDialogDescription', { reference: r.reference, company: r.legalName })}
        confirmLabel={t('rejectDialogConfirm')}
        variant="danger"
        onConfirm={reject}
      />

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('infoDialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('infoDialogDescription', { email: r.contactEmail })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="info-message">{t('infoMessageLabel')}</Label>
            <Textarea
              id="info-message"
              rows={4}
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
              placeholder={t('infoMessagePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInfoOpen(false)} disabled={busy}>
              {t('btnCancel')}
            </Button>
            <Button
              variant="default"
              onClick={requestInfo}
              disabled={busy || infoMessage.trim().length === 0}
            >
              <UserPlus className="h-4 w-4" />
              {t('btnSendRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
