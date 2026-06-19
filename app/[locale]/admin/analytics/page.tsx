'use client';

import * as React from 'react';
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

const RANGE_OPTIONS = [
  { value: '90d', label: 'Last 90 days' },
  { value: '6m', label: 'Last 6 months' },
  { value: 'ytd', label: 'Year to date' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];

export default function AnalyticsPage() {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [range, setRange] = React.useState('12m');

  React.useEffect(() => {
    let active = true;
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
        analyticsService.companiesOverTime(),
        analyticsService.topMarkets(),
        analyticsService.companiesByCategory(),
        analyticsService.pipelineDistribution(),
        analyticsService.ndaFunnel(),
        analyticsService.sampleFunnel(),
        analyticsService.ndaCompletionTrend(),
        analyticsService.samplesOverTime(),
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
  }, []);

  const loading = data === null;

  const handleExport = () => {
    toast({
      title: 'Export started',
      description: 'Your analytics report is being prepared and will download shortly.',
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
        title="Analytics & Reports"
        subtitle="Pipeline, conversion and operational performance across the Proamina® business."
        actions={
          <>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-[180px]">
                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="gold" onClick={handleExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard
          label="Avg first contact → NDA"
          value={data?.avgFirstContactToNda ?? 0}
          icon={Timer}
          tone="info"
          format={(n) => `${formatNumber(n)} d`}
          hint="Days to a signed NDA"
          delay={0}
        />
        <StatCard
          label="Avg NDA → shipment"
          value={data?.avgNdaToShipment ?? 0}
          icon={TrendingUp}
          tone="info"
          format={(n) => `${formatNumber(n)} d`}
          hint="Days to first dispatch"
          delay={0.04}
        />
        <StatCard
          label="Avg delivery time"
          value={data?.shipmentPerformance.avgDeliveryDays ?? 0}
          icon={ShipWheel}
          tone="gold"
          format={(n) => `${formatNumber(n)} d`}
          hint="Dispatch to delivery"
          delay={0.08}
        />
        <StatCard
          label="On-time delivery"
          value={data?.shipmentPerformance.onTimePct ?? 0}
          icon={Package}
          tone="success"
          format={(n) => `${n}%`}
          hint={`${formatNumber(data?.shipmentPerformance.totalDelivered ?? 0)} delivered`}
          delay={0.12}
        />
        <StatCard
          label="Task completion"
          value={data?.taskCompletionRate.rate ?? 0}
          icon={Activity}
          tone="success"
          format={(n) => `${n}%`}
          hint={`${formatNumber(data?.taskCompletionRate.done ?? 0)} of ${formatNumber(
            data?.taskCompletionRate.total ?? 0,
          )} done`}
          delay={0.16}
        />
        <StatCard
          label="Active markets"
          value={data?.topMarkets.length ?? 0}
          icon={Globe2}
          tone="default"
          hint="Countries with accounts"
          delay={0.2}
        />
      </div>

      {/* Chart grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Companies over time"
          description="New accounts added each month and cumulative growth."
          loading={loading}
          isEmpty={!loading && (data?.companiesOverTime.length ?? 0) === 0}
        >
          <TrendChart
            data={data?.companiesOverTime ?? []}
            xKey="label"
            series={[
              { key: 'cumulative', name: 'Cumulative', type: 'area' },
              { key: 'count', name: 'New', type: 'line', color: '#0eb89a' },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Companies by country"
          description="Where accounts are concentrated across export markets."
          loading={loading}
          isEmpty={!loading && marketsData.length === 0}
        >
          <CategoryBar data={marketsData} xKey="country" barKey="count" horizontal name="Companies" />
        </ChartCard>

        <ChartCard
          title="Companies by category"
          description="Split of accounts by company type."
          loading={loading}
          isEmpty={!loading && categoryDonut.length === 0}
        >
          <DonutChart data={categoryDonut} centerLabel="Companies" />
        </ChartCard>

        <ChartCard
          title="Pipeline distribution"
          description="Accounts grouped by current relationship stage."
          loading={loading}
          isEmpty={!loading && pipelineData.length === 0}
        >
          <CategoryBar data={pipelineData} xKey="stage" barKey="count" name="Companies" />
        </ChartCard>

        <ChartCard
          title="NDA conversion"
          description="Drop-off from NDA prepared through to fully signed."
          loading={loading}
          isEmpty={!loading && (data?.ndaFunnel.length ?? 0) === 0}
        >
          <FunnelChartCard data={data?.ndaFunnel ?? []} />
        </ChartCard>

        <ChartCard
          title="Sample conversion"
          description="Sample journey from request to feedback received."
          loading={loading}
          isEmpty={!loading && (data?.sampleFunnel.length ?? 0) === 0}
        >
          <FunnelChartCard data={data?.sampleFunnel ?? []} />
        </ChartCard>

        <ChartCard
          title="NDA completion trend"
          description="NDAs signed versus sent each month."
          loading={loading}
          isEmpty={!loading && (data?.ndaCompletionTrend.length ?? 0) === 0}
        >
          <TrendChart
            data={data?.ndaCompletionTrend ?? []}
            xKey="label"
            series={[
              { key: 'sent', name: 'Sent', type: 'area', color: '#2563eb' },
              { key: 'signed', name: 'Signed', type: 'area', color: '#0eb89a' },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Sample requests over time"
          description="Volume of sample requests created each month."
          loading={loading}
          isEmpty={!loading && (data?.samplesOverTime.length ?? 0) === 0}
        >
          <TrendChart
            data={data?.samplesOverTime ?? []}
            xKey="label"
            series={[{ key: 'count', name: 'Requests', type: 'area', color: '#c9a227' }]}
          />
        </ChartCard>

        <ChartCard
          title="Shipment status"
          description="Current state of all tracked shipments."
          loading={loading}
          isEmpty={!loading && (data?.shipmentStatusBreakdown.length ?? 0) === 0}
        >
          <DonutChart data={data?.shipmentStatusBreakdown ?? []} centerLabel="Shipments" />
        </ChartCard>

        <ChartCard
          title="Feedback results"
          description="Overall outcomes reported on returned samples."
          loading={loading}
          isEmpty={!loading && feedbackDonut.length === 0}
        >
          <DonutChart data={feedbackDonut} centerLabel="Reports" />
        </ChartCard>

        <ChartCard
          title="Most active markets"
          description="Top countries ranked by number of accounts."
          loading={loading}
          isEmpty={!loading && marketsData.length === 0}
        >
          <CategoryBar data={marketsData} xKey="country" barKey="count" color="#0eb89a" name="Companies" />
        </ChartCard>

        <ChartCard
          title="Most common applications"
          description="Leading product applications across sample requests."
          loading={loading}
          isEmpty={!loading && applicationsData.length === 0}
        >
          <CategoryBar
            data={applicationsData}
            xKey="category"
            barKey="count"
            horizontal
            color="#2563eb"
            name="Samples"
          />
        </ChartCard>
      </div>

      {/* Team activity & workload */}
      <Stagger>
        <StaggerItem>
          <ChartCard
            title="Team activity & workload"
            description="Logged activities, open tasks and assigned accounts per team member."
            loading={loading}
            isEmpty={!loading && (data?.teamActivity.length ?? 0) === 0}
            height={420}
          >
            <div className="h-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="min-w-[220px]">Activities</TableHead>
                    <TableHead className="text-right">Open tasks</TableHead>
                    <TableHead className="text-right">Companies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.teamActivity ?? []).map((member) => (
                    <TableRow key={member.userId}>
                      <TableCell className="font-medium">{member.name}</TableCell>
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
