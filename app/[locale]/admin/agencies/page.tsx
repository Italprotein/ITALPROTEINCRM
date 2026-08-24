'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Handshake,
  CheckCircle2,
  Building2,
  TrendingUp,
  Globe2,
  MapPin,
  CalendarClock,
  Eye,
  ArrowUpRight,
  Sparkles,
  Mail,
  Trash2,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { agencyService, companyService, leadService, type Agency } from '@/lib/mock-services';
import type { LeadEntry } from '@/lib/types';
import { useSession } from '@/components/providers/session-provider';
import { can } from '@/lib/permissions';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { formatRelative, flagEmoji } from '@/lib/formatting';
import { humanize } from '@/lib/labels';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { CHART_COLORS } from '@/lib/chart-colors';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function AgenciesPage() {
  const t = useTranslations('AdminAgencies');
  const router = useRouter();
  const { nameOf } = useStaffDirectory();
  const { session } = useSession();
  const role = session?.role;
  // A partner IS a Company row, so deletion is gated on the same action the
  // server action behind it requires: `company.edit` (internal-only).
  const canDeletePartner = !!role && can(role, 'company.edit');
  const { confirm, ConfirmDialog: confirmDialog } = useConfirm();
  const [rows, setRows] = useState<Agency[] | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof agencyService.getStatistics>> | null>(null);
  const [preview, setPreview] = useState<Agency | null>(null);
  const [myLeads, setMyLeads] = useState<LeadEntry[] | null>(null);

  useEffect(() => {
    agencyService.list().then(setRows);
    agencyService.getStatistics().then(setStats);
    leadService.listMine().then(setMyLeads);
  }, []);

  async function removeLead(id: string) {
    setMyLeads((prev) => (prev ? prev.filter((l) => l.id !== id) : prev));
    await leadService.remove(id);
  }

  /**
   * Delete a partner — which means deleting the Company row it is stored in.
   * The confirmation says so in as many words, because "remove this partner"
   * and "delete this company and everything filed under it" are the same
   * button here and only one of them is obvious from where you are standing.
   */
  async function deletePartner(a: Agency) {
    const name = a.tradingName ?? a.legalName;
    const ok = await confirm({
      title: t('deleteConfirmTitle'),
      description: t('deleteConfirmDescription', { name }),
      confirmLabel: t('delete'),
      cancelLabel: t('cancel'),
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await companyService.remove(a.id);
      setRows((prev) => (prev ? prev.filter((row) => row.id !== a.id) : prev));
      void agencyService.getStatistics().then(setStats);
      toast({ variant: 'success', title: t('toastDeletedTitle'), description: t('toastDeletedDescription', { name }) });
    } catch (error) {
      // A company holding quotes, orders or invoices is refused rather than
      // destroyed. Say which records blocked it instead of leaking the raw
      // `COMPANY_DELETE_BLOCKED: 2 quote(s)` string at the reader.
      const message = error instanceof Error ? error.message : '';
      const blocked = message.includes('COMPANY_DELETE_BLOCKED');
      toast({
        variant: 'danger',
        title: blocked ? t('deleteBlockedTitle') : t('toastActionFailedTitle'),
        description: blocked
          ? t('deleteBlockedDescription', { name, reasons: message.split('COMPANY_DELETE_BLOCKED:')[1]?.trim() ?? '' })
          : t('toastActionFailedDescription'),
      });
    }
  }

  const ownerName = (id: string, unassignedLabel: string) => nameOf(id, unassignedLabel);

  const columns: Column<Agency>[] = [
    {
      key: 'agency',
      header: t('colAgency'),
      sortValue: (a) => a.tradingName ?? a.legalName,
      cell: (a) => (
        <div className="flex items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: a.accentColor ?? CHART_COLORS[0] }}
          >
            {a.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{a.tradingName ?? a.legalName}</p>
            <p className="truncate text-xs text-muted-foreground">{a.legalName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'territory',
      header: t('colTerritory'),
      sortValue: (a) => a.meta.territory,
      cell: (a) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className="text-base">{flagEmoji(a.countryCode)}</span>
          {a.meta.territory}
        </span>
      ),
    },
    {
      key: 'countries',
      header: t('colCountriesCovered'),
      hideable: true,
      sortValue: (a) => a.meta.countriesCovered.length,
      cell: (a) => (
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm text-muted-foreground" title={a.meta.countriesCovered.join(', ')}>
            {a.meta.countriesCovered.slice(0, 2).join(', ')}
          </span>
          {a.meta.countriesCovered.length > 2 && (
            <Badge variant="muted">+{a.meta.countriesCovered.length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('colType'),
      sortValue: (a) => a.meta.agencyType,
      cell: (a) => <Badge variant="secondary">{humanize(a.meta.agencyType)}</Badge>,
    },
    {
      key: 'owner',
      header: t('colOwner'),
      hideable: true,
      sortValue: (a) => ownerName(a.accountOwnerId, t('unassigned')),
      cell: (a) => <span className="text-sm">{ownerName(a.accountOwnerId, t('unassigned'))}</span>,
    },
    {
      key: 'nda',
      header: t('colNda'),
      sortValue: (a) => a.ndaStatus,
      cell: (a) => <StatusBadge kind="ndaStatus" value={a.ndaStatus} />,
    },
    {
      key: 'agreement',
      header: t('colAgreement'),
      sortValue: (a) => a.meta.agreementStatus,
      cell: (a) => (
        <StatusBadge kind="agreementStatus" value={a.meta.agreementStatus} />
      ),
    },
    {
      key: 'introduced',
      header: t('colIntroduced'),
      align: 'right',
      sortValue: (a) => a.meta.companiesIntroducedIds.length,
      cell: (a) => <span className="tabular font-medium">{a.meta.companiesIntroducedIds.length}</span>,
    },
    {
      key: 'leads',
      header: t('colActiveLeads'),
      align: 'right',
      sortValue: (a) => a.meta.activeLeads,
      cell: (a) => <span className="tabular">{a.meta.activeLeads}</span>,
    },
    {
      key: 'conversion',
      header: t('colConversion'),
      sortValue: (a) => a.meta.conversionRate,
      cell: (a) => (
        <div className="flex items-center gap-2">
          <Progress value={a.meta.conversionRate * 100} className="w-16" />
          <span className="w-9 text-right text-xs tabular text-muted-foreground">{pct(a.meta.conversionRate)}</span>
        </div>
      ),
    },
    {
      key: 'lastInteraction',
      header: t('colLastInteraction'),
      hideable: true,
      sortValue: (a) => a.meta.lastInteractionAt,
      cell: (a) => <span className="text-sm text-muted-foreground">{formatRelative(a.meta.lastInteractionAt)}</span>,
    },
    {
      key: 'nextAction',
      header: t('colNextAction'),
      hideable: true,
      sortValue: (a) => a.meta.nextAction?.label ?? '',
      cell: (a) =>
        a.meta.nextAction ? (
          <span className="text-sm text-foreground">{a.meta.nextAction.label}</span>
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
          <Button
            variant="gold"
            onClick={() =>
              toast({
                title: t('invitePartnerToastTitle'),
                description: t('invitePartnerToastDescription'),
                variant: 'success',
              })
            }
          >
            <Handshake className="h-4 w-4" />
            {t('invitePartner')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('statTotalPartners')} value={stats?.total ?? 0} icon={Handshake} tone="gold" delay={0} />
        <StatCard
          label={t('statActiveAgreements')}
          value={stats?.active ?? 0}
          icon={CheckCircle2}
          tone="success"
          hint={t('statActiveAgreementsHint')}
          delay={0.05}
        />
        <StatCard
          label={t('statCompaniesIntroduced')}
          value={stats?.totalCompaniesIntroduced ?? 0}
          icon={Building2}
          tone="info"
          hint={t('statActiveLeadsHint', { count: stats?.totalLeads ?? 0 })}
          delay={0.1}
        />
        <StatCard
          label={t('statAvgConversionRate')}
          value={stats?.avgConversionRate ?? 0}
          icon={TrendingUp}
          tone="warning"
          format={(n) => `${n}%`}
          delay={0.15}
        />
      </div>

      {/* ── My Leads: company names auto-extracted from Gmail for the signed-in admin ── */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy dark:text-brand-blueBright">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t('myLeadsTitle')}{myLeads && myLeads.length > 0 ? ` (${myLeads.length})` : ''}
              </h2>
              <p className="text-xs text-muted-foreground">{t('myLeadsSubtitle')}</p>
            </div>
          </div>
        </div>

        {myLeads === null ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 w-full rounded-lg" />)}
          </div>
        ) : myLeads.length === 0 ? (
          <EmptyState icon={Mail} title={t('myLeadsEmpty')} className="py-8" />
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {myLeads.map((lead) => (
              <div key={lead.id} className="group flex items-center justify-between gap-2 rounded-lg border bg-muted/20 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{lead.companyName}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    {t('myLeadsMeta', { count: lead.emailCount, time: formatRelative(lead.lastSeenAt) })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('myLeadsRemove')}
                  className="shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
                  onClick={() => removeLead(lead.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <DataTable<Agency>
        data={rows ?? []}
        columns={columns}
        getRowId={(a) => a.id}
        loading={rows === null}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchValue={(a) =>
          [a.legalName, a.tradingName, a.meta.territory, a.meta.agencyType, ...a.meta.countriesCovered]
            .filter(Boolean)
            .join(' ')
        }
        onRowClick={(a) => router.push('/admin/agencies/' + a.id)}
        rowActions={(a) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('quickView')}
              onClick={() => setPreview(a)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('openProfile')}
              onClick={() => router.push('/admin/agencies/' + a.id)}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
            {canDeletePartner && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('deletePartner')}
                className="text-danger-text"
                onClick={() => void deletePartner(a)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        enableColumnVisibility
        enableDensityToggle
        exportFilename="agencies"
        defaultSortKey="lastInteraction"
        defaultSortDir="desc"
        storageKey="agencies"
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      <Sheet open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent side="right" className="max-w-md">
          {preview && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: preview.accentColor ?? CHART_COLORS[0] }}
                  >
                    {preview.initials}
                  </span>
                  {preview.tradingName ?? preview.legalName}
                </SheetTitle>
                <SheetDescription>{preview.legalName}</SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{humanize(preview.meta.agencyType)}</Badge>
                <StatusBadge kind="agreementStatus" value={preview.meta.agreementStatus} />
                <StatusBadge kind="ndaStatus" value={preview.ndaStatus} />
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('colTerritory')}</dt>
                    <dd className="font-medium">{preview.meta.territory}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('colCountriesCovered')}</dt>
                    <dd className="font-medium">{preview.meta.countriesCovered.join(', ')}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">{t('colLastInteraction')}</dt>
                    <dd className="font-medium">{formatRelative(preview.meta.lastInteractionAt)}</dd>
                  </div>
                </div>
              </dl>

              <div className="grid grid-cols-3 gap-3 max-[360px]:grid-cols-1">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold tabular">{preview.meta.companiesIntroducedIds.length}</p>
                  <p className="text-2xs text-muted-foreground">{t('colIntroduced')}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold tabular">{preview.meta.activeLeads}</p>
                  <p className="text-2xs text-muted-foreground">{t('leads')}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold tabular">{pct(preview.meta.conversionRate)}</p>
                  <p className="text-2xs text-muted-foreground">{t('colConversion')}</p>
                </div>
              </div>

              {preview.meta.nextAction && (
                <div className="rounded-lg border border-dashed bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t('colNextAction')}</p>
                  <p className="mt-0.5 text-sm font-medium">{preview.meta.nextAction.label}</p>
                  {preview.meta.nextAction.dueDate && (
                    <p className="text-xs text-muted-foreground">
                      {t('due', { date: formatRelative(preview.meta.nextAction.dueDate) })}
                    </p>
                  )}
                </div>
              )}

              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">{t('close')}</Button>
                </SheetClose>
                <Button
                  variant="gold"
                  onClick={() => {
                    const id = preview.id;
                    setPreview(null);
                    router.push('/admin/agencies/' + id);
                  }}
                >
                  {t('openProfile')}
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
