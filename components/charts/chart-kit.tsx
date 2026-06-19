'use client';

import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

/* ────────────────────────────────────────────────────────────────────────
 * Palette — on-brand chart colours (navy · gold · teal · molecular + tints)
 * ──────────────────────────────────────────────────────────────────────── */
export const CHART_COLORS: string[] = [
  '#0a1628', // brand navy
  '#c9a227', // brand gold
  '#0eb89a', // brand teal
  '#2563eb', // molecular blue
  '#1b3a5b', // navy600 tint
  '#e8c84a', // goldLight tint
  '#6f8a6b', // sage
  '#0a9980', // tealDark
];

/* ────────────────────────────────────────────────────────────────────────
 * Shared axis / tooltip styling
 * ──────────────────────────────────────────────────────────────────────── */
const AXIS_PROPS = {
  stroke: 'hsl(var(--muted-foreground))',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const GRID_STROKE = 'hsl(var(--border))';

/** Styled recharts tooltip matching the popover surface. */
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      {label != null && label !== '' && (
        <p className="mb-1 font-medium text-foreground">{label}</p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? entry.payload?.fill }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular text-foreground">
              {typeof entry.value === 'number'
                ? entry.value.toLocaleString()
                : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const legendStyle: React.CSSProperties = { fontSize: 12, paddingTop: 8 };

/* ────────────────────────────────────────────────────────────────────────
 * ChartCard — container with header, loading shimmer & empty state
 * ──────────────────────────────────────────────────────────────────────── */
interface ChartCardProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  height?: number;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  description,
  action,
  loading = false,
  isEmpty = false,
  emptyMessage = 'No data to display',
  height = 280,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="skeleton w-full" style={{ height }} />
        ) : isEmpty ? (
          <div
            className="surface-quiet flex flex-col items-center justify-center gap-2 text-center"
            style={{ height }}
          >
            <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div style={{ width: '100%', height }}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * TrendChart — multi-series line / area chart
 * ──────────────────────────────────────────────────────────────────────── */
export interface TrendSeries {
  key: string;
  name: string;
  color?: string;
  type?: 'line' | 'area';
}

interface TrendChartProps {
  data: any[];
  xKey: string;
  series: TrendSeries[];
  height?: number;
}

export function TrendChart({ data, xKey, series, height = 280 }: TrendChartProps) {
  const colorFor = (s: TrendSeries, i: number) => s.color ?? CHART_COLORS[i % CHART_COLORS.length];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s, i) => {
            const color = colorFor(s, i);
            return (
              <linearGradient key={s.key} id={`trend-grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.28} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey={xKey} {...AXIS_PROPS} dy={6} />
        <YAxis {...AXIS_PROPS} width={44} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID_STROKE }} />
        {series.length > 1 && <Legend wrapperStyle={legendStyle} iconType="circle" />}
        {series.map((s, i) => {
          const color = colorFor(s, i);
          if (s.type === 'area') {
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={color}
                strokeWidth={2}
                fill={`url(#trend-grad-${s.key})`}
                isAnimationActive
                animationDuration={700}
                dot={false}
                activeDot={{ r: 4 }}
              />
            );
          }
          return (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={color}
              strokeWidth={2}
              fill="transparent"
              isAnimationActive
              animationDuration={700}
              dot={false}
              activeDot={{ r: 4 }}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * CategoryBar — single-series bar chart (vertical or horizontal)
 * ──────────────────────────────────────────────────────────────────────── */
interface CategoryBarProps {
  data: any[];
  xKey: string;
  barKey: string;
  color?: string;
  horizontal?: boolean;
  height?: number;
  name?: string;
}

export function CategoryBar({
  data,
  xKey,
  barKey,
  color = CHART_COLORS[1],
  horizontal = false,
  height = 280,
  name,
}: CategoryBarProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={GRID_STROKE}
          vertical={horizontal}
          horizontal={!horizontal}
        />
        {horizontal ? (
          <>
            <XAxis type="number" {...AXIS_PROPS} />
            <YAxis type="category" dataKey={xKey} {...AXIS_PROPS} width={96} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...AXIS_PROPS} dy={6} />
            <YAxis {...AXIS_PROPS} width={44} />
          </>
        )}
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
        <Bar
          dataKey={barKey}
          name={name ?? barKey}
          fill={color}
          radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
          maxBarSize={48}
          isAnimationActive
          animationDuration={700}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Alias so callers can use the more descriptive `BarChartCard` name. */
export const BarChartCard = CategoryBar;

/* ────────────────────────────────────────────────────────────────────────
 * DonutChart — donut with legend, tooltip and optional centre total
 * ──────────────────────────────────────────────────────────────────────── */
export interface DonutDatum {
  name: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: DonutDatum[];
  height?: number;
  centerLabel?: string;
}

export function DonutChart({ data, height = 280, centerLabel }: DonutChartProps) {
  const total = React.useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  return (
    <div className="relative" style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={legendStyle} iconType="circle" />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="58%"
            outerRadius="80%"
            paddingAngle={2}
            stroke="hsl(var(--card))"
            strokeWidth={2}
            isAnimationActive
            animationDuration={700}
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular tracking-tight text-foreground">
          {total.toLocaleString()}
        </span>
        {centerLabel && (
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * FunnelChartCard — horizontal funnel from stacked proportional bars
 * ──────────────────────────────────────────────────────────────────────── */
export interface FunnelDatum {
  name: string;
  value: number;
}

interface FunnelChartCardProps {
  data: FunnelDatum[];
  height?: number;
}

export function FunnelChartCard({ data, height = 280 }: FunnelChartCardProps) {
  const top = data.length > 0 ? data[0].value : 0;

  return (
    <div
      className="flex flex-col justify-center gap-2"
      style={{ width: '100%', minHeight: height }}
    >
      {data.map((d, i) => {
        const widthPct = top > 0 ? Math.max((d.value / top) * 100, 4) : 0;
        const prev = i > 0 ? data[i - 1].value : d.value;
        const conversion = prev > 0 ? (d.value / prev) * 100 : 100;
        const color = CHART_COLORS[i % CHART_COLORS.length];
        return (
          <div key={d.name} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{d.name}</span>
              <span className="tabular text-muted-foreground">
                {d.value.toLocaleString()}
                {i > 0 && (
                  <span className="ml-2 text-2xs font-medium">
                    {conversion.toFixed(0)}%
                  </span>
                )}
              </span>
            </div>
            <div className="h-6 w-full overflow-hidden rounded-md bg-muted">
              <div
                className="flex h-full items-center justify-end rounded-md px-2 text-2xs font-semibold text-white transition-all"
                style={{ width: `${widthPct}%`, backgroundColor: color }}
              >
                {widthPct > 12 ? `${widthPct.toFixed(0)}%` : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
 * Sparkline — tiny inline area chart
 * ──────────────────────────────────────────────────────────────────────── */
interface SparklineProps {
  data: Array<{ value: number } | number>;
  color?: string;
  height?: number;
}

export function Sparkline({ data, color = CHART_COLORS[2], height = 40 }: SparklineProps) {
  const normalised = React.useMemo(
    () => data.map((d) => (typeof d === 'number' ? { value: d } : d)),
    [data],
  );
  const id = React.useId().replace(/:/g, '');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={normalised} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
