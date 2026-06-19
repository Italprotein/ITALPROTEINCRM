'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import {
  MessageSquareQuote,
  CircleDot,
  CheckCircle2,
  ThumbsUp,
  Star,
  MoreHorizontal,
  Eye,
  Send,
  HelpCircle,
  CalendarClock,
  X,
  FlaskConical,
  Beaker,
  Building2,
  User2,
} from 'lucide-react';

import {
  feedbackService,
  companyService,
  sampleService,
  analyticsService,
  authService,
} from '@/lib/mock-services';
import type {
  Feedback,
  Company,
  SampleRequest,
  Locale,
  FeedbackStatus,
  FeedbackResult,
  FeedbackComment,
} from '@/lib/types';
import { FEEDBACK_STATUS_FLOW, APPLICATION_CATEGORIES } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, formatRelative } from '@/lib/formatting';
import { cn, uid, initials } from '@/lib/utils';
import { useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { ChartCard, DonutChart, CategoryBar, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/lib/i18n/navigation';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Constants ────────────────────────────── */

const ALL = '__all__';

const RESULTS: FeedbackResult[] = ['positive', 'mixed', 'negative', 'inconclusive'];

const RESULT_COLOR: Record<FeedbackResult, string> = {
  positive: CHART_COLORS[3] ?? '#16a34a',
  mixed: CHART_COLORS[1] ?? '#f59e0b',
  negative: CHART_COLORS[5] ?? '#dc2626',
  inconclusive: CHART_COLORS[6] ?? '#64748b',
};

function ownerName(id?: string): string {
  if (!id) return 'Unassigned';
  const acc = authService.getAccount(id);
  return acc ? `${acc.firstName} ${acc.lastName}` : id;
}

/* ────────────────────────────── Star rating ────────────────────────────── */

function StarRating({ value, size = 'sm' }: { value?: number; size?: 'sm' | 'md' }) {
  if (!value) return <span className="text-sm text-muted-foreground">—</span>;
  const dim = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            dim,
            i <= value ? 'fill-brand-gold text-brand-gold' : 'fill-transparent text-muted-foreground/40',
          )}
        />
      ))}
    </span>
  );
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function FeedbackPage() {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [rows, setRows] = React.useState<Feedback[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [sampleMap, setSampleMap] = React.useState<Map<string, SampleRequest>>(new Map());
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof feedbackService.getStatistics>> | null>(null);
  const [resultBreakdown, setResultBreakdown] = React.useState<{ name: string; value: number }[]>([]);

  // filters
  const [fStatus, setFStatus] = React.useState<string>(ALL);
  const [fResult, setFResult] = React.useState<string>(ALL);
  const [fApplication, setFApplication] = React.useState<string>(ALL);

  // review sheet
  const [reviewId, setReviewId] = React.useState<string | null>(null);
  // request-more-info dialog reuse via sheet? we use sheet for review; small dialogs handled inline

  React.useEffect(() => {
    feedbackService.list().then(setRows);
    feedbackService.getStatistics().then(setStats);
    analyticsService.feedbackResults().then(setResultBreakdown);
    companyService.list().then((list) => setCompanyMap(new Map(list.map((c) => [c.id, c]))));
    sampleService.list().then((list) => setSampleMap(new Map(list.map((s) => [s.id, s]))));
  }, []);

  /* ── filtered data ── */
  const filtered = React.useMemo(() => {
    let data = rows ?? [];
    if (fStatus !== ALL) data = data.filter((f) => f.status === fStatus);
    if (fResult !== ALL) data = data.filter((f) => f.overallResult === fResult);
    if (fApplication !== ALL) data = data.filter((f) => f.applicationCategory === fApplication);
    return data;
  }, [rows, fStatus, fResult, fApplication]);

  const activeFilterCount =
    (fStatus !== ALL ? 1 : 0) + (fResult !== ALL ? 1 : 0) + (fApplication !== ALL ? 1 : 0);
  const resetFilters = () => {
    setFStatus(ALL);
    setFResult(ALL);
    setFApplication(ALL);
  };

  /* ── chart data ── */
  const donutData = React.useMemo(
    () =>
      resultBreakdown.map((d) => ({
        name: getLabel('feedbackResult', d.name),
        value: d.value,
        color: RESULT_COLOR[d.name as FeedbackResult] ?? CHART_COLORS[0],
      })),
    [resultBreakdown],
  );

  const applicationChart = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const f of rows ?? []) {
      const key = getLabel('applicationCategory', f.applicationCategory);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  /* ── application options present in data ── */
  const applicationOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const f of rows ?? []) set.add(f.applicationCategory);
    return APPLICATION_CATEGORIES.filter((c) => set.has(c));
  }, [rows]);

  /* ── mutations (mock) ── */
  function applyPatch(id: string, patch: Partial<Feedback>) {
    setRows((prev) => (prev ? prev.map((f) => (f.id === id ? { ...f, ...patch } : f)) : prev));
    void feedbackService.update(id, patch);
  }

  function addComment(id: string, body: string, visibility: 'internal' | 'client') {
    const comment: FeedbackComment = {
      id: uid('cm'),
      byUserId: 'u_admin',
      visibility,
      body,
      at: new Date().toISOString(),
    };
    setRows((prev) =>
      prev ? prev.map((f) => (f.id === id ? { ...f, comments: [...f.comments, comment] } : f)) : prev,
    );
    const target = rows?.find((f) => f.id === id);
    if (target) void feedbackService.update(id, { comments: [...target.comments, comment] });
    return comment;
  }

  async function sendTechnicalReply(f: Feedback) {
    await new Promise((r) => setTimeout(r, 500));
    applyPatch(f.id, { status: 'technical_reply_sent' });
    toast({
      variant: 'success',
      title: 'Technical reply sent',
      description: `Reply delivered to ${companyMap.get(f.companyId)?.tradingName ?? 'client'} for ${f.reference}.`,
    });
  }

  async function requestMoreInfo(f: Feedback) {
    await new Promise((r) => setTimeout(r, 500));
    applyPatch(f.id, { status: 'additional_info_requested' });
    toast({
      variant: 'info',
      title: 'More info requested',
      description: `Information request sent for ${f.reference}.`,
    });
  }

  async function markResolved(f: Feedback) {
    await new Promise((r) => setTimeout(r, 500));
    applyPatch(f.id, { status: 'resolved' });
    setStats((prev) => (prev ? { ...prev, open: Math.max(0, prev.open - 1) } : prev));
    toast({
      variant: 'success',
      title: 'Feedback resolved',
      description: `${f.reference} marked as resolved.`,
    });
  }

  async function scheduleTechnicalCall(f: Feedback) {
    await new Promise((r) => setTimeout(r, 500));
    applyPatch(f.id, { status: 'technical_call_needed' });
    toast({
      variant: 'info',
      title: 'Technical call scheduled',
      description: `A technical call has been flagged for ${f.reference}.`,
    });
  }

  const reviewItem = React.useMemo(
    () => (reviewId ? (rows ?? []).find((f) => f.id === reviewId) ?? null : null),
    [reviewId, rows],
  );

  /* ── table columns ── */
  const columns: Column<Feedback>[] = [
    {
      key: 'reference',
      header: 'Reference',
      sortValue: (f) => f.reference,
      cell: (f) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground">{f.reference}</p>
          {f.productProjectName ? (
            <p className="truncate text-xs text-muted-foreground">{f.productProjectName}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Company',
      sortValue: (f) => companyMap.get(f.companyId)?.legalName ?? '',
      cell: (f) => {
        const c = companyMap.get(f.companyId);
        if (!c) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Link
            href={'/admin/companies/' + c.id}
            className="text-sm font-medium text-foreground hover:text-brand-teal hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.tradingName || c.legalName}
          </Link>
        );
      },
      hideable: true,
    },
    {
      key: 'application',
      header: 'Application',
      sortValue: (f) => getLabel('applicationCategory', f.applicationCategory),
      cell: (f) => <StatusBadge kind="applicationCategory" value={f.applicationCategory} />,
      hideable: true,
    },
    {
      key: 'sample',
      header: 'Related sample',
      sortValue: (f) => (f.sampleRequestId ? sampleMap.get(f.sampleRequestId)?.reference ?? '' : ''),
      cell: (f) => {
        const sample = f.sampleRequestId ? sampleMap.get(f.sampleRequestId) : undefined;
        if (!sample) return <span className="text-sm text-muted-foreground">—</span>;
        return (
          <Link
            href={'/admin/samples/' + sample.id}
            className="text-sm text-brand-teal hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {sample.reference}
          </Link>
        );
      },
      hideable: true,
    },
    {
      key: 'result',
      header: 'Result',
      sortValue: (f) => f.overallResult ?? '',
      cell: (f) =>
        f.overallResult ? (
          <StatusBadge kind="feedbackResult" value={f.overallResult} />
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: 'rating',
      header: 'Rating',
      sortable: true,
      sortValue: (f) => f.overallRating ?? 0,
      cell: (f) => <StarRating value={f.overallRating} />,
      hideable: true,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (f) => f.status,
      cell: (f) => <StatusBadge kind="feedbackStatus" value={f.status} />,
    },
    {
      key: 'testDate',
      header: 'Test date',
      align: 'right',
      sortable: true,
      sortValue: (f) => (f.testDate ? new Date(f.testDate).getTime() : 0),
      cell: (f) => <span className="whitespace-nowrap text-sm">{formatDate(f.testDate, locale)}</span>,
      hideable: true,
    },
    {
      key: 'owner',
      header: 'Technical owner',
      sortValue: (f) => ownerName(f.technicalOwnerId),
      cell: (f) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {ownerName(f.technicalOwnerId)}
        </span>
      ),
      hideable: true,
      defaultHidden: true,
    },
  ];

  /* ── toolbar ── */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fStatus} onValueChange={setFStatus}>
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {FEEDBACK_STATUS_FLOW.map((s) => (
            <SelectItem key={s} value={s}>
              {getLabel('feedbackStatus', s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fResult} onValueChange={setFResult}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Result" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All results</SelectItem>
          {RESULTS.map((r) => (
            <SelectItem key={r} value={r}>
              {getLabel('feedbackResult', r)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={fApplication} onValueChange={setFApplication}>
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Application" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All applications</SelectItem>
          {applicationOptions.map((c) => (
            <SelectItem key={c} value={c}>
              {getLabel('applicationCategory', c)}
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

  /* ── row actions ── */
  function rowActions(f: Feedback) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Row actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setReviewId(f.id)}>
            <Eye />
            Review
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void sendTechnicalReply(f)}>
            <Send />
            Send technical reply
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void requestMoreInfo(f)}>
            <HelpCircle />
            Request more info
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void scheduleTechnicalCall(f)}>
            <CalendarClock />
            Schedule technical call
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={f.status === 'resolved'}
            onSelect={() => void markResolved(f)}
          >
            <CheckCircle2 />
            Mark resolved
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  /* ── mobile card ── */
  function mobileCard(f: Feedback) {
    const c = companyMap.get(f.companyId);
    return (
      <Card className="p-3" onClick={() => setReviewId(f.id)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{f.reference}</p>
            <p className="truncate text-xs text-muted-foreground">{c?.tradingName || c?.legalName}</p>
          </div>
          <StatusBadge kind="feedbackStatus" value={f.status} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <StatusBadge kind="applicationCategory" value={f.applicationCategory} />
          <StarRating value={f.overallRating} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
          {f.overallResult ? (
            <StatusBadge kind="feedbackResult" value={f.overallResult} />
          ) : (
            <span>No result</span>
          )}
          <span>{formatDate(f.testDate, locale)}</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Feedback & R&D"
        subtitle="Sensory and application test feedback from clients — triage, reply and close the loop."
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total feedback" value={stats?.total ?? 0} icon={MessageSquareQuote} tone="gold" />
        <StatCard label="Open" value={stats?.open ?? 0} icon={CircleDot} tone="warning" delay={0.05} />
        <StatCard
          label="Resolved"
          value={(stats?.total ?? 0) - (stats?.open ?? 0)}
          icon={CheckCircle2}
          tone="success"
          delay={0.1}
        />
        <StatCard
          label="Positive results"
          value={stats?.positive ?? 0}
          icon={ThumbsUp}
          tone="success"
          delay={0.15}
        />
        <StatCard
          label="Avg rating"
          value={stats ? `${stats.avgRating.toFixed(1)} / 5` : '—'}
          icon={Star}
          tone="info"
          hint="across rated tests"
          delay={0.2}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Result distribution"
          description="Outcome of every test cycle"
          loading={rows === null}
          isEmpty={donutData.length === 0}
        >
          <DonutChart data={donutData} centerLabel="results" />
        </ChartCard>

        <ChartCard
          title="Feedback by application"
          description="Where testing activity concentrates"
          loading={rows === null}
          isEmpty={applicationChart.length === 0}
        >
          <CategoryBar
            data={applicationChart}
            xKey="label"
            barKey="count"
            horizontal
            color={CHART_COLORS[2]}
            name="Feedback"
          />
        </ChartCard>
      </div>

      {/* Table */}
      <DataTable<Feedback>
        data={filtered}
        columns={columns}
        getRowId={(f) => f.id}
        loading={rows === null}
        searchable
        searchPlaceholder="Search reference, company, application, project…"
        searchValue={(f) =>
          [
            f.reference,
            f.productProjectName,
            getLabel('applicationCategory', f.applicationCategory),
            companyMap.get(f.companyId)?.legalName,
            companyMap.get(f.companyId)?.tradingName,
            f.sampleRequestId ? sampleMap.get(f.sampleRequestId)?.reference : '',
            ownerName(f.technicalOwnerId),
          ]
            .filter(Boolean)
            .join(' ')
        }
        pageSize={12}
        rowActions={rowActions}
        onRowClick={(f) => setReviewId(f.id)}
        toolbar={toolbar}
        enableColumnVisibility
        enableDensityToggle
        mobileCard={mobileCard}
        emptyTitle="No feedback matches"
        emptyDescription="Adjust the filters to see more results."
        exportFilename="feedback"
        storageKey="feedback-table"
      />

      <ReviewSheet
        feedback={reviewItem}
        company={reviewItem ? companyMap.get(reviewItem.companyId) ?? null : null}
        sample={
          reviewItem?.sampleRequestId ? sampleMap.get(reviewItem.sampleRequestId) ?? null : null
        }
        locale={locale}
        onOpenChange={(o) => !o && setReviewId(null)}
        onAddComment={addComment}
        onSendReply={sendTechnicalReply}
        onRequestInfo={requestMoreInfo}
        onResolve={markResolved}
        onScheduleCall={scheduleTechnicalCall}
        onOpenSample={(id) => {
          setReviewId(null);
          router.push('/admin/samples/' + id);
        }}
      />
    </div>
  );
}

/* ────────────────────────────── Review sheet ────────────────────────────── */

function SensoryField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

function ReviewSheet({
  feedback,
  company,
  sample,
  locale,
  onOpenChange,
  onAddComment,
  onSendReply,
  onRequestInfo,
  onResolve,
  onScheduleCall,
  onOpenSample,
}: {
  feedback: Feedback | null;
  company: Company | null;
  sample: SampleRequest | null;
  locale: Locale;
  onOpenChange: (open: boolean) => void;
  onAddComment: (id: string, body: string, visibility: 'internal' | 'client') => FeedbackComment;
  onSendReply: (f: Feedback) => Promise<void>;
  onRequestInfo: (f: Feedback) => Promise<void>;
  onResolve: (f: Feedback) => Promise<void>;
  onScheduleCall: (f: Feedback) => Promise<void>;
  onOpenSample: (id: string) => void;
}) {
  const [reply, setReply] = React.useState('');
  const [visibility, setVisibility] = React.useState<'internal' | 'client'>('client');
  const [posting, setPosting] = React.useState(false);

  React.useEffect(() => {
    if (feedback) {
      setReply('');
      setVisibility('client');
    }
  }, [feedback]);

  async function postReply() {
    if (!reply.trim() || posting || !feedback) return;
    setPosting(true);
    await new Promise((r) => setTimeout(r, 500));
    onAddComment(feedback.id, reply.trim(), visibility);
    setPosting(false);
    setReply('');
    toast({
      variant: 'success',
      title: visibility === 'client' ? 'Reply sent to client' : 'Internal note added',
      description: `Posted to ${feedback.reference}.`,
    });
  }

  const hasSensory =
    feedback &&
    (feedback.tasteAroma ||
      feedback.solubility ||
      feedback.processingBehaviour ||
      feedback.texture ||
      feedback.appearanceColour ||
      feedback.comparisonControl ||
      feedback.issuesEncountered ||
      feedback.questions);

  return (
    <Sheet open={!!feedback} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg sm:max-w-lg">
        {feedback ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
                  <FlaskConical className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <SheetTitle>{feedback.reference}</SheetTitle>
                  <SheetDescription className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5" />
                    {company ? company.tradingName || company.legalName : 'Unknown company'}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="-mx-6 flex-1 overflow-y-auto px-6">
              {/* Summary */}
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge kind="feedbackStatus" value={feedback.status} />
                {feedback.overallResult ? (
                  <StatusBadge kind="feedbackResult" value={feedback.overallResult} />
                ) : null}
                <StatusBadge kind="applicationCategory" value={feedback.applicationCategory} />
                <PriorityBadge value={feedback.priority} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Overall rating</p>
                  <StarRating value={feedback.overallRating} size="md" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Test date</p>
                  <p className="font-medium text-foreground">{formatDate(feedback.testDate, locale)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Technical owner</p>
                  <p className="font-medium text-foreground">{ownerName(feedback.technicalOwnerId)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">Related sample</p>
                  {sample ? (
                    <button
                      type="button"
                      onClick={() => onOpenSample(sample.id)}
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:underline"
                    >
                      <Beaker className="h-3.5 w-3.5" />
                      {sample.reference}
                    </button>
                  ) : (
                    <p className="font-medium text-muted-foreground">—</p>
                  )}
                </div>
                {feedback.preferredNextStep ? (
                  <div className="col-span-2 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Preferred next step</p>
                    <StatusBadge kind="nextStep" value={feedback.preferredNextStep} />
                  </div>
                ) : null}
              </div>

              {/* Sensory & technical detail */}
              {hasSensory ? (
                <>
                  <Separator className="my-4" />
                  <h3 className="mb-3 text-sm font-semibold text-foreground">Sensory & technical evaluation</h3>
                  <div className="space-y-3">
                    <SensoryField label="Taste & aroma" value={feedback.tasteAroma} />
                    <SensoryField label="Solubility" value={feedback.solubility} />
                    <SensoryField label="Processing behaviour" value={feedback.processingBehaviour} />
                    <SensoryField label="Texture" value={feedback.texture} />
                    <SensoryField label="Appearance & colour" value={feedback.appearanceColour} />
                    <SensoryField label="Comparison vs control" value={feedback.comparisonControl} />
                    <SensoryField label="Issues encountered" value={feedback.issuesEncountered} />
                    <SensoryField label="Open questions" value={feedback.questions} />
                    <SensoryField label="Requested support" value={feedback.requestedSupport} />
                  </div>
                </>
              ) : null}

              {/* Comments thread */}
              <Separator className="my-4" />
              <h3 className="mb-3 text-sm font-semibold text-foreground">
                Discussion ({feedback.comments.length})
              </h3>
              {feedback.comments.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  No comments yet. Start the conversation below.
                </p>
              ) : (
                <ul className="space-y-3">
                  {feedback.comments.map((c) => {
                    const isClient = !!c.byContactId;
                    const author = isClient
                      ? company?.tradingName || company?.legalName || 'Client'
                      : ownerName(c.byUserId);
                    return (
                      <li key={c.id} className="flex gap-3">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-[10px]">
                            {isClient ? initials(author) : initials(author)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{author}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelative(c.at, locale)}
                            </span>
                            <span
                              className={cn(
                                'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                                c.visibility === 'client'
                                  ? 'bg-info-subtle text-info'
                                  : 'bg-muted text-muted-foreground',
                              )}
                            >
                              {c.visibility === 'client' ? 'Client-visible' : 'Internal'}
                            </span>
                          </div>
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* Reply box */}
              <div className="mt-4 space-y-2 rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="reply" className="text-sm font-medium">
                    Add a reply
                  </Label>
                  <Select
                    value={visibility}
                    onValueChange={(v) => setVisibility(v as 'internal' | 'client')}
                  >
                    <SelectTrigger className="h-8 w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client-visible</SelectItem>
                      <SelectItem value="internal">Internal note</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  id="reply"
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Share a technical recommendation, ask a clarifying question…"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={postReply} disabled={!reply.trim() || posting}>
                    <Send />
                    {posting ? 'Posting…' : 'Post reply'}
                  </Button>
                </div>
              </div>
            </div>

            <SheetFooter className="flex-row flex-wrap gap-2 sm:justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onRequestInfo(feedback)}
              >
                <HelpCircle />
                Request info
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onScheduleCall(feedback)}
              >
                <CalendarClock />
                Technical call
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onSendReply(feedback)}
              >
                <Send />
                Send reply
              </Button>
              <Button
                variant="success"
                size="sm"
                disabled={feedback.status === 'resolved'}
                onClick={() => void onResolve(feedback)}
              >
                <CheckCircle2 />
                Resolve
              </Button>
            </SheetFooter>
          </>
        ) : (
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User2 className="h-4 w-4" />
              Feedback
            </SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}
