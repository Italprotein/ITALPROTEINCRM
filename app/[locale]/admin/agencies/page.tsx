'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { agencyService, authService, type Agency } from '@/lib/mock-services';
import { formatRelative, flagEmoji } from '@/lib/formatting';
import { humanize } from '@/lib/labels';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard, DonutChart, CategoryBar, CHART_COLORS } from '@/components/charts/chart-kit';
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

type AgreementStatus = Agency['meta']['agreementStatus'];

const AGREEMENT_TONE: Record<AgreementStatus, Parameters<typeof Badge>[0]['variant']> = {
  none: 'muted',
  draft: 'warning',
  active: 'success',
  expired: 'danger',
};

const AGREEMENT_LABEL: Record<AgreementStatus, string> = {
  none: 'No agreement',
  draft: 'Draft',
  active: 'Active',
  expired: 'Expired',
};

function ownerName(id: string): string {
  const a = authService.getAccount(id);
  return a ? `${a.firstName} ${a.lastName}` : 'Unassigned';
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function AgenciesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Agency[] | null>(null);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof agencyService.getStatistics>> | null>(null);
  const [preview, setPreview] = useState<Agency | null>(null);

  useEffect(() => {
    agencyService.list().then(setRows);
    agencyService.getStatistics().then(setStats);
  }, []);

  const donutData = useMemo(() => {
    if (!rows) return [];
    const map = new Map<string, number>();
    for (const a of rows) map.set(a.meta.agencyType, (map.get(a.meta.agencyType) ?? 0) + 1);
    return [...map.entries()].map(([name, value], i) => ({
      name: humanize(name),
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [rows]);

  const introducedData = useMemo(() => {
    if (!rows) return [];
    return [...rows]
      .map((a) => ({
        name: a.tradingName ?? a.legalName,
        companies: a.meta.companiesIntroducedIds.length,
      }))
      .filter((d) => d.companies > 0)
      .sort((a, b) => b.companies - a.companies)
      .slice(0, 8);
  }, [rows]);

  const columns: Column<Agency>[] = [
    {
      key: 'agency',
      header: 'Agency',
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
      header: 'Territory',
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
      header: 'Countries covered',
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
      header: 'Type',
      sortValue: (a) => a.meta.agencyType,
      cell: (a) => <Badge variant="secondary">{humanize(a.meta.agencyType)}</Badge>,
    },
    {
      key: 'owner',
      header: 'Owner',
      hideable: true,
      sortValue: (a) => ownerName(a.accountOwnerId),
      cell: (a) => <span className="text-sm">{ownerName(a.accountOwnerId)}</span>,
    },
    {
      key: 'nda',
      header: 'NDA',
      sortValue: (a) => a.ndaStatus,
      cell: (a) => <StatusBadge kind="ndaStatus" value={a.ndaStatus} />,
    },
    {
      key: 'agreement',
      header: 'Agreement',
      sortValue: (a) => a.meta.agreementStatus,
      cell: (a) => (
        <Badge variant={AGREEMENT_TONE[a.meta.agreementStatus]}>
          {AGREEMENT_LABEL[a.meta.agreementStatus]}
        </Badge>
      ),
    },
    {
      key: 'introduced',
      header: 'Introduced',
      align: 'right',
      sortValue: (a) => a.meta.companiesIntroducedIds.length,
      cell: (a) => <span className="tabular font-medium">{a.meta.companiesIntroducedIds.length}</span>,
    },
    {
      key: 'leads',
      header: 'Active leads',
      align: 'right',
      sortValue: (a) => a.meta.activeLeads,
      cell: (a) => <span className="tabular">{a.meta.activeLeads}</span>,
    },
    {
      key: 'conversion',
      header: 'Conversion',
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
      header: 'Last interaction',
      hideable: true,
      sortValue: (a) => a.meta.lastInteractionAt,
      cell: (a) => <span className="text-sm text-muted-foreground">{formatRelative(a.meta.lastInteractionAt)}</span>,
    },
    {
      key: 'nextAction',
      header: 'Next action',
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
        title="Agencies & Distributors"
        subtitle="Partner network introducing Proamina® to manufacturers and brands across regions."
        actions={
          <Button
            variant="gold"
            onClick={() =>
              toast({
                title: 'Invite partner',
                description: 'Partner onboarding link generated and copied to clipboard.',
                variant: 'success',
              })
            }
          >
            <Handshake className="h-4 w-4" />
            Invite partner
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total partners" value={stats?.total ?? 0} icon={Handshake} tone="gold" delay={0} />
        <StatCard
          label="Active agreements"
          value={stats?.active ?? 0}
          icon={CheckCircle2}
          tone="success"
          hint="Signed distribution / agency deals"
          delay={0.05}
        />
        <StatCard
          label="Companies introduced"
          value={stats?.totalCompaniesIntroduced ?? 0}
          icon={Building2}
          tone="info"
          hint={`${stats?.totalLeads ?? 0} active leads in play`}
          delay={0.1}
        />
        <StatCard
          label="Avg conversion rate"
          value={stats?.avgConversionRate ?? 0}
          icon={TrendingUp}
          tone="warning"
          format={(n) => `${n}%`}
          delay={0.15}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Partners by type"
          description="Distribution of the partner network by relationship model"
          loading={rows === null}
          isEmpty={donutData.length === 0}
          height={280}
        >
          <DonutChart data={donutData} centerLabel="partners" />
        </ChartCard>

        <ChartCard
          title="Companies introduced"
          description="Top partners by number of companies brought into the pipeline"
          loading={rows === null}
          isEmpty={introducedData.length === 0}
          emptyMessage="No introductions recorded yet"
          height={280}
        >
          <CategoryBar data={introducedData} xKey="name" barKey="companies" horizontal name="Companies" />
        </ChartCard>
      </div>

      <DataTable<Agency>
        data={rows ?? []}
        columns={columns}
        getRowId={(a) => a.id}
        loading={rows === null}
        searchable
        searchPlaceholder="Search partners, territory, country…"
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
              aria-label="Quick view"
              onClick={() => setPreview(a)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open profile"
              onClick={() => router.push('/admin/agencies/' + a.id)}
            >
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </div>
        )}
        enableColumnVisibility
        enableDensityToggle
        exportFilename="agencies"
        storageKey="agencies"
        emptyTitle="No partners yet"
        emptyDescription="Agencies and distributors will appear here as they join the network."
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
                <Badge variant={AGREEMENT_TONE[preview.meta.agreementStatus]}>
                  {AGREEMENT_LABEL[preview.meta.agreementStatus]}
                </Badge>
                <StatusBadge kind="ndaStatus" value={preview.ndaStatus} />
              </div>

              <dl className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Territory</dt>
                    <dd className="font-medium">{preview.meta.territory}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Countries covered</dt>
                    <dd className="font-medium">{preview.meta.countriesCovered.join(', ')}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Last interaction</dt>
                    <dd className="font-medium">{formatRelative(preview.meta.lastInteractionAt)}</dd>
                  </div>
                </div>
              </dl>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold tabular">{preview.meta.companiesIntroducedIds.length}</p>
                  <p className="text-2xs text-muted-foreground">Introduced</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold tabular">{preview.meta.activeLeads}</p>
                  <p className="text-2xs text-muted-foreground">Leads</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold tabular">{pct(preview.meta.conversionRate)}</p>
                  <p className="text-2xs text-muted-foreground">Conversion</p>
                </div>
              </div>

              {preview.meta.nextAction && (
                <div className="rounded-lg border border-dashed bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Next action</p>
                  <p className="mt-0.5 text-sm font-medium">{preview.meta.nextAction.label}</p>
                  {preview.meta.nextAction.dueDate && (
                    <p className="text-xs text-muted-foreground">
                      Due {formatRelative(preview.meta.nextAction.dueDate)}
                    </p>
                  )}
                </div>
              )}

              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Close</Button>
                </SheetClose>
                <Button
                  variant="gold"
                  onClick={() => {
                    const id = preview.id;
                    setPreview(null);
                    router.push('/admin/agencies/' + id);
                  }}
                >
                  Open profile
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
