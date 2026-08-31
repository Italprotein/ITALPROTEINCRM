'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity,
  CalendarRange,
  Download,
  Globe2,
  Package,
  ShipWheel,
  Timer,
  TrendingUp,
} from 'lucide-react';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Stagger, StaggerItem } from '@/components/shared/motion';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  CategoryBar,
  ChartCard,
  DonutChart,
  FunnelChartCard,
  TrendChart,
} from '@/components/charts/chart-kit';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { analyticsService } from '@/lib/mock-services';
import { getLabel } from '@/lib/labels';
import { flagEmoji, formatNumber } from '@/lib/formatting';

/* Resolved shapes from the analytics service. */
type Await<T> = T extends Promise<infer U> ? U : T;

interface AnalyticsData {
  companiesOverTime: Await<ReturnType<typeof analyticsService.companiesOverTime>>;
  topMarkets: Await<ReturnType<typeof analyticsService.topMarkets>>;
  companiesByCategory: Await<ReturnType<typeof analyticsService.companiesByCategory>>;
  pipelineDistribution: Await<ReturnType<typeof analyticsService.pipelineDistribution>>;
  ndaFunnel: Await<ReturnType<typeof analyticsService.ndaFunnel>>;
  sampleFunnel: Await<ReturnType<typeof analyticsService.sampleFunnel>>;
  ndaCompletionTrend: Await<ReturnType<typeof analyticsService.ndaCompletionTrend>>;
  samplesOverTime: Await<ReturnType<typeof analyticsService.samplesOverTime>>;
  shipmentStatusBreakdown: Await<ReturnType<typeof analyticsService.shipmentStatusBreakdown>>;
  feedbackResults: Await<ReturnType<typeof analyticsService.feedbackResults>>;
  topApplications: Await<ReturnType<typeof analyticsService.topApplications>>;
  shipmentPerformance: Await<ReturnType<typeof analyticsService.shipmentPerformance>>;
  avgFirstContactToNda: Await<ReturnType<typeof analyticsService.avgFirstContactToNda>>;
  avgNdaToShipment: Await<ReturnType<typeof analyticsService.avgNdaToShipment>>;
  taskCompletionRate: Await<ReturnType<typeof analyticsService.taskCompletionRate>>;
  teamActivity: Await<ReturnType<typeof analyticsService.teamActivity>>;
}

const RANGE_OPTIONS = (t: ReturnType<typeof useTranslations>) => [
  { value: '90d', label: t('rangeLast90Days') },
  { value: '6m', label: t('rangeLast6Months') },
  { value: 'ytd', label: t('rangeYearToDate') },
  { value: '12m', label: t('rangeLast12Months') },
  { value: 'all', label: t('rangeAllTime') },
];

/** Range key → month-bucket count for the trend charts. 0 = all time. */
function monthsForRange(range: string): number {
  if (range === '90d') return 3;
  if (range === '6m') return 6;
  if (range === 'ytd') return new Date().getMonth() + 1;
  if (range === 'all') return 0;
  return 12;
}

/* ── Real CSV export of everything currently on screen ── */

const csvCell = (v: unknown): string => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function csvSection(title: string, header: string[], rows: (string | number)[][]): string {
  return [title, header.map(csvCell).join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\n');
}

function buildAnalyticsCsv(data: AnalyticsData): string {
  const sections = [
    csvSection('KPIs', ['metric', 'value'], [
      ['avg_first_contact_to_nda_days', data.avgFirstContactToNda],
      ['avg_nda_to_shipment_days', data.avgNdaToShipment],
      ['avg_delivery_days', data.shipmentPerformance.avgDeliveryDays],
      ['on_time_delivery_pct', data.shipmentPerformance.onTimePct],
      ['delivered_shipments', data.shipmentPerformance.totalDelivered],
      ['task_completion_pct', data.taskCompletionRate.rate],
      ['tasks_done', data.taskCompletionRate.done],
      ['tasks_total', data.taskCompletionRate.total],
    ]),
    csvSection('Companies over time', ['month', 'new', 'cumulative'],
      data.companiesOverTime.map((d) => [d.month, d.count, d.cumulative])),
    csvSection('Top markets', ['country', 'companies'],
      data.topMarkets.map((d) => [d.country, d.count])),
    csvSection('Companies by category', ['type', 'count'],
      data.companiesByCategory.map((d) => [d.type, d.count])),
    csvSection('Pipeline distribution', ['stage', 'count'],
      data.pipelineDistribution.map((d) => [d.stage, d.count])),
    csvSection('NDA funnel', ['step', 'count'],
      data.ndaFunnel.map((d) => [d.name, d.value])),
    csvSection('Sample funnel', ['step', 'count'],
      data.sampleFunnel.map((d) => [d.name, d.value])),
    csvSection('NDA trend', ['month', 'sent', 'signed'],
      data.ndaCompletionTrend.map((d) => [d.month, d.sent, d.signed])),
    csvSection('Samples over time', ['month', 'requests'],
      data.samplesOverTime.map((d) => [d.month, d.count])),
    csvSection('Shipment status', ['status', 'count'],
      data.shipmentStatusBreakdown.map((d) => [d.name, d.value])),
    csvSection('Feedback results', ['result', 'count'],
      data.feedbackResults.map((d) => [d.name, d.value])),
    csvSection('Top applications', ['category', 'samples'],
      data.topApplications.map((d) => [d.category, d.count])),
    csvSection('Team activity', ['member', 'role', 'activities', 'open_tasks', 'companies'],
      data.teamActivity.map((m) => [m.name, m.role, m.activities, m.tasks, m.companies])),
  ];
  return sections.join('\n\n');
}

export default function AnalyticsPage() {
  const t = useTranslations('AdminAnalytics');
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [range, setRange] = React.useState('12m');

  // The three trend charts follow the range selector; everything else is a
  // current-state snapshot (funnels, distributions, KPIs) and loads once.
  React.useEffect(() => {
    let active = true;
    const months = monthsForRange(range);
    (async () => {
      const [
        companiesOverTime,
        topMarkets,
        companiesByCategory,
        pipelineDistribution,
        ndaFunnel,
        sampleFunnel,
        ndaCompletionTrend,
        samplesOverTime,
        shipmentStatusBreakdown,
        feedbackResults,
        topApplications,
        shipmentPerformance,
        avgFirstContactToNda,
        avgNdaToShipment,
        taskCompletionRate,
        teamActivity,
      ] = await Promise.all([
        analyticsService.companiesOverTime(months),
        analyticsService.topMarkets(),
        analyticsService.companiesByCategory(),
        analyticsService.pipelineDistribution(),
        analyticsService.ndaFunnel(),
        analyticsService.sampleFunnel(),
        analyticsService.ndaCompletionTrend(months),
        analyticsService.samplesOverTime(months),
        analyticsService.shipmentStatusBreakdown(),
        analyticsService.feedbackResults(),
        analyticsService.topApplications(),
        analyticsService.shipmentPerformance(),
        analyticsService.avgFirstContactToNda(),
        analyticsService.avgNdaToShipment(),
        analyticsService.taskCompletionRate(),
        analyticsService.teamActivity(),
      ]);
      if (!active) return;
      setData({
        companiesOverTime,
        topMarkets,
        companiesByCategory,
        pipelineDistribution,
        ndaFunnel,
        sampleFunnel,
        ndaCompletionTrend,
        samplesOverTime,
        shipmentStatusBreakdown,
        feedbackResults,
        topApplications,
        shipmentPerformance,
        avgFirstContactToNda,
        avgNdaToShipment,
        taskCompletionRate,
        teamActivity,
      });
    })();
    return () => {
      active = false;
    };
  }, [range]);

  const loading = data === null;

  /** Downloads everything currently on screen as a sectioned CSV. */
  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([`﻿${buildAnalyticsCsv(data)}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: t('exportStartedTitle'),
      description: t('exportStartedDescription'),
      variant: 'success',
    });
  };

  /* Derived chart datasets (memoised once data is present). */
  const categoryDonut = React.useMemo(
    () =>
      (data?.companiesByCategory ?? []).map((d) => ({
        name: getLabel('companyType', d.type),
        value: d.count,
      })),
    [data],
  );

  const pipelineData = React.useMemo(
    () =>
      (data?.pipelineDistribution ?? []).map((d) => ({
        stage: getLabel('relationshipStage', d.stage),
        count: d.count,
      })),
    [data],
  );

  const marketsData = React.useMemo(
    () =>
      (data?.topMarkets ?? []).map((d) => ({
        country: d.country,
        count: d.count,
      })),
    [data],
  );

  const applicationsData = React.useMemo(
    () =>
      (data?.topApplications ?? []).map((d) => ({
        category: getLabel('applicationCategory', d.category),
        count: d.count,
      })),
    [data],
  );

  const feedbackDonut = React.useMemo(
    () =>
      (data?.feedbackResults ?? []).map((d) => ({
        name: getLabel('feedbackResult', d.name),
        value: d.value,
      })),
    [data],
  );

  const maxActivities = React.useMemo(
    () => Math.max(1, ...(data?.teamActivity ?? []).map((t) => t.activities)),
    [data],
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={t('dateRangePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS(t).map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="gold" onClick={handleExport} disabled={loading}>
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label={t('kpiAvgFirstContactToNdaLabel')}
          value={data?.avgFirstContactToNda ?? 0}
          icon={Timer}
          tone="info"
          format={(n) => t('daysUnit', { value: formatNumber(n) })}
          hint={t('kpiAvgFirstContactToNdaHint')}
          delay={0}
        />
        <StatCard
          label={t('kpiAvgNdaToShipmentLabel')}
          value={data?.avgNdaToShipment ?? 0}
          icon={TrendingUp}
          tone="info"
          format={(n) => t('daysUnit', { value: formatNumber(n) })}
          hint={t('kpiAvgNdaToShipmentHint')}
          delay={0.04}
        />
        <StatCard
          label={t('kpiAvgDeliveryTimeLabel')}
          value={data?.shipmentPerformance.avgDeliveryDays ?? 0}
          icon={ShipWheel}
          tone="gold"
          format={(n) => t('daysUnit', { value: formatNumber(n) })}
          hint={t('kpiAvgDeliveryTimeHint')}
          delay={0.08}
        />
        <StatCard
          label={t('kpiOnTimeDeliveryLabel')}
          value={data?.shipmentPerformance.onTimePct ?? 0}
          icon={Package}
          tone="success"
          format={(n) => `${n}%`}
          hint={t('kpiOnTimeDeliveryHint', {
            count: formatNumber(data?.shipmentPerformance.totalDelivered ?? 0),
          })}
          delay={0.12}
        />
        <StatCard
          label={t('kpiTaskCompletionLabel')}
          value={data?.taskCompletionRate.rate ?? 0}
          icon={Activity}
          tone="success"
          format={(n) => `${n}%`}
          hint={t('kpiTaskCompletionHint', {
            done: formatNumber(data?.taskCompletionRate.done ?? 0),
            total: formatNumber(data?.taskCompletionRate.total ?? 0),
          })}
          delay={0.16}
        />
        <StatCard
          label={t('kpiActiveMarketsLabel')}
          value={data?.topMarkets.length ?? 0}
          icon={Globe2}
          tone="default"
          hint={t('kpiActiveMarketsHint')}
          delay={0.2}
        />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title={t('companiesOverTimeTitle')}
          description={t('companiesOverTimeDescription')}
          loading={loading}
          isEmpty={!loading && (data?.companiesOverTime.length ?? 0) === 0}
        >
          <TrendChart
            data={data?.companiesOverTime ?? []}
            xKey="label"
            series={[
              { key: 'cumulative', name: t('seriesCumulative'), type: 'area' },
              { key: 'count', name: t('seriesNew'), type: 'line', color: '#0eb89a' },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={t('companiesByCountryTitle')}
          description={t('companiesByCountryDescription')}
          loading={loading}
          isEmpty={!loading && marketsData.length === 0}
        >
          <CategoryBar data={marketsData} xKey="country" barKey="count" horizontal name={t('seriesCompanies')} />
        </ChartCard>

        <ChartCard
          title={t('companiesByCategoryTitle')}
          description={t('companiesByCategoryDescription')}
          loading={loading}
          isEmpty={!loading && categoryDonut.length === 0}
        >
          <DonutChart data={categoryDonut} centerLabel={t('centerLabelCompanies')} />
        </ChartCard>

        <ChartCard
          title={t('pipelineDistributionTitle')}
          description={t('pipelineDistributionDescription')}
          loading={loading}
          isEmpty={!loading && pipelineData.length === 0}
        >
          <CategoryBar data={pipelineData} xKey="stage" barKey="count" name={t('seriesCompanies')} />
        </ChartCard>

        <ChartCard
          title={t('ndaConversionTitle')}
          description={t('ndaConversionDescription')}
          loading={loading}
          isEmpty={!loading && (data?.ndaFunnel.length ?? 0) === 0}
        >
          <FunnelChartCard data={data?.ndaFunnel ?? []} />
        </ChartCard>

        <ChartCard
          title={t('sampleConversionTitle')}
          description={t('sampleConversionDescription')}
          loading={loading}
          isEmpty={!loading && (data?.sampleFunnel.length ?? 0) === 0}
        >
          <FunnelChartCard data={data?.sampleFunnel ?? []} />
        </ChartCard>

        <ChartCard
          title={t('ndaCompletionTrendTitle')}
          description={t('ndaCompletionTrendDescription')}
          loading={loading}
          isEmpty={!loading && (data?.ndaCompletionTrend.length ?? 0) === 0}
        >
          <TrendChart
            data={data?.ndaCompletionTrend ?? []}
            xKey="label"
            series={[
              { key: 'sent', name: t('seriesSent'), type: 'area', color: '#2563eb' },
              { key: 'signed', name: t('seriesSigned'), type: 'area', color: '#0eb89a' },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={t('sampleRequestsOverTimeTitle')}
          description={t('sampleRequestsOverTimeDescription')}
          loading={loading}
          isEmpty={!loading && (data?.samplesOverTime.length ?? 0) === 0}
        >
          <TrendChart
            data={data?.samplesOverTime ?? []}
            xKey="label"
            series={[{ key: 'count', name: t('seriesRequests'), type: 'area', color: '#c9a227' }]}
          />
        </ChartCard>

        <ChartCard
          title={t('shipmentStatusTitle')}
          description={t('shipmentStatusDescription')}
          loading={loading}
          isEmpty={!loading && (data?.shipmentStatusBreakdown.length ?? 0) === 0}
        >
          <DonutChart data={data?.shipmentStatusBreakdown ?? []} centerLabel={t('centerLabelShipments')} />
        </ChartCard>

        <ChartCard
          title={t('feedbackResultsTitle')}
          description={t('feedbackResultsDescription')}
          loading={loading}
          isEmpty={!loading && feedbackDonut.length === 0}
        >
          <DonutChart data={feedbackDonut} centerLabel={t('centerLabelReports')} />
        </ChartCard>

        <ChartCard
          title={t('mostActiveMarketsTitle')}
          description={t('mostActiveMarketsDescription')}
          loading={loading}
          isEmpty={!loading && marketsData.length === 0}
        >
          <CategoryBar data={marketsData} xKey="country" barKey="count" color="#0eb89a" name={t('seriesCompanies')} />
        </ChartCard>

        <ChartCard
          title={t('mostCommonApplicationsTitle')}
          description={t('mostCommonApplicationsDescription')}
          loading={loading}
          isEmpty={!loading && applicationsData.length === 0}
        >
          <CategoryBar
            data={applicationsData}
            xKey="category"
            barKey="count"
            horizontal
            color="#2563eb"
            name={t('seriesSamples')}
          />
        </ChartCard>
      </div>

      {/* Team activity & workload */}
      <Stagger>
        <StaggerItem>
          <ChartCard
            title={t('teamActivityTitle')}
            description={t('teamActivityDescription')}
            loading={loading}
            isEmpty={!loading && (data?.teamActivity.length ?? 0) === 0}
            height={420}
          >
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colTeamMember')}</TableHead>
                    <TableHead>{t('colRole')}</TableHead>
                    <TableHead className="min-w-[220px]">{t('colActivities')}</TableHead>
                    <TableHead className="text-right">{t('colOpenTasks')}</TableHead>
                    <TableHead className="text-right">{t('colCompanies')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.teamActivity ?? []).map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell className="max-w-[14rem] truncate font-medium" title={member.name}>
                        {member.name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="role" value={member.role} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Progress
                            value={(member.activities / maxActivities) * 100}
                            className="h-2 max-w-[160px] flex-1"
                          />
                          <span className="w-8 shrink-0 text-right text-sm font-semibold tabular text-foreground">
                            {member.activities}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular">{member.tasks}</TableCell>
                      <TableCell className="text-right tabular">{member.companies}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ChartCard>
        </StaggerItem>
      </Stagger>
    </div>
  );
}
