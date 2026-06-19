'use client';

import * as React from 'react';
import {
  MessageSquarePlus,
  Inbox,
  Clock,
  CheckCircle2,
  Star,
  FlaskConical,
  Calendar,
  MessageCircle,
  ArrowRight,
  Beaker,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { feedbackService, sampleService } from '@/lib/mock-services';
import type { Feedback, SampleRequest } from '@/lib/types';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FadeIn, Stagger, StaggerItem } from '@/components/shared/motion';
import { getLabel } from '@/lib/labels';
import { formatDate } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

/* ────────────────────────────── Rating stars ────────────────────────────── */

function RatingStars({ value, size = 'sm' }: { value?: number; size?: 'sm' | 'md' }) {
  if (!value) return <span className="text-xs text-muted-foreground">Not rated</span>;
  const dim = size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            dim,
            i < value ? 'fill-brand-gold text-brand-gold' : 'fill-muted text-muted-foreground/40',
          )}
        />
      ))}
    </span>
  );
}

/* ────────────────────────────── Detail rows ────────────────────────────── */

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  );
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function PortalFeedbackPage() {
  const { session, ready } = useSession();
  const router = useRouter();

  const [feedback, setFeedback] = React.useState<Feedback[]>([]);
  const [sampleMap, setSampleMap] = React.useState<Record<string, SampleRequest>>({});
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Feedback | null>(null);

  const companyId = session?.companyId;

  React.useEffect(() => {
    if (!ready) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([feedbackService.byCompany(companyId), sampleService.byCompany(companyId)]).then(
      ([fb, samples]) => {
        if (!active) return;
        const map: Record<string, SampleRequest> = {};
        for (const s of samples) map[s.id] = s;
        // Newest first.
        const sorted = [...fb].sort(
          (a, b) =>
            new Date(b.testDate ?? b.createdAt).getTime() -
            new Date(a.testDate ?? a.createdAt).getTime(),
        );
        setFeedback(sorted);
        setSampleMap(map);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [ready, companyId]);

  /* Loading */
  if (!ready || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  /* No company scope */
  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Feedback & results" subtitle="Share how our samples performed in your tests." />
        <EmptyState
          icon={MessageSquarePlus}
          title="No company selected"
          description="We could not find a company linked to your account. Please contact your Italprotein account manager."
        />
      </div>
    );
  }

  /* Stats */
  const total = feedback.length;
  const underReview = feedback.filter(
    (f) =>
      f.status === 'received' ||
      f.status === 'under_review' ||
      f.status === 'additional_info_requested' ||
      f.status === 'technical_call_needed',
  ).length;
  const resolved = feedback.filter(
    (f) => f.status === 'resolved' || f.status === 'technical_reply_sent',
  ).length;
  const rated = feedback.filter((f) => typeof f.overallRating === 'number');
  const avgRating = rated.length
    ? Math.round((rated.reduce((s, f) => s + (f.overallRating ?? 0), 0) / rated.length) * 10) / 10
    : 0;

  const goToNew = () => router.push('/portal/feedback/new');

  const clientComments = selected
    ? selected.comments.filter((c) => c.visibility === 'client')
    : [];
  const selectedSample = selected?.sampleRequestId ? sampleMap[selected.sampleRequestId] : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback & results"
        subtitle="Share how our samples performed in your applications and follow each review."
        actions={
          <Button variant="gold" onClick={goToNew}>
            <MessageSquarePlus className="h-4 w-4" />
            Submit feedback
          </Button>
        }
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total submitted" value={total} icon={Inbox} tone="info" delay={0} />
        <StatCard
          label="Under review"
          value={underReview}
          icon={Clock}
          tone="warning"
          hint="Awaiting our technical team"
          delay={0.05}
        />
        <StatCard
          label="Resolved"
          value={resolved}
          icon={CheckCircle2}
          tone="success"
          hint="Replied or closed"
          delay={0.1}
        />
        <StatCard
          label="Average rating"
          value={avgRating ? `${avgRating.toFixed(1)} / 5` : '—'}
          icon={Star}
          tone="gold"
          hint={rated.length ? `Across ${rated.length} rated tests` : 'No ratings yet'}
          delay={0.15}
        />
      </div>

      {/* List */}
      {feedback.length === 0 ? (
        <EmptyState
          icon={MessageSquarePlus}
          title="No feedback yet"
          description="Once you have tested a delivered sample, share your results so our technical team can support your next step."
          action={
            <Button variant="gold" onClick={goToNew}>
              <MessageSquarePlus className="h-4 w-4" />
              Submit feedback
            </Button>
          }
        />
      ) : (
        <Stagger className="space-y-3">
          {feedback.map((f) => {
            const sample = f.sampleRequestId ? sampleMap[f.sampleRequestId] : undefined;
            const clientReplies = f.comments.filter((c) => c.visibility === 'client').length;
            return (
              <StaggerItem key={f.id}>
                <button
                  type="button"
                  onClick={() => setSelected(f)}
                  className="group w-full rounded-lg border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {f.reference}
                        </span>
                        <StatusBadge kind="applicationCategory" value={f.applicationCategory} />
                        {f.overallResult && (
                          <StatusBadge kind="feedbackResult" value={f.overallResult} />
                        )}
                      </div>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {f.productProjectName ?? getLabel('applicationCategory', f.applicationCategory)}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <FlaskConical className="h-3.5 w-3.5" />
                          {sample ? `${sample.reference} · ${sample.requestedProduct}` : 'No linked sample'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Tested {formatDate(f.testDate ?? f.createdAt)}
                        </span>
                        {clientReplies > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <MessageCircle className="h-3.5 w-3.5" />
                            {clientReplies} {clientReplies === 1 ? 'reply' : 'replies'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <StatusBadge kind="feedbackStatus" value={f.status} />
                      <RatingStars value={f.overallRating} />
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy opacity-0 transition-opacity group-hover:opacity-100">
                        View details <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </button>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    {selected.reference}
                  </span>
                  <StatusBadge kind="feedbackStatus" value={selected.status} />
                </div>
                <SheetTitle>
                  {selected.productProjectName ??
                    getLabel('applicationCategory', selected.applicationCategory)}
                </SheetTitle>
                <SheetDescription>
                  {selectedSample
                    ? `Test feedback for ${selectedSample.reference} · ${selectedSample.requestedProduct}`
                    : 'Application test feedback'}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5">
                {/* Overview chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge kind="applicationCategory" value={selected.applicationCategory} />
                  {selected.overallResult && (
                    <StatusBadge kind="feedbackResult" value={selected.overallResult} />
                  )}
                  {selected.preferredNextStep && (
                    <StatusBadge kind="nextStep" value={selected.preferredNextStep} />
                  )}
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Overall rating
                    </p>
                    <div className="mt-1">
                      <RatingStars value={selected.overallRating} size="md" />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Test date
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatDate(selected.testDate ?? selected.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Sensory & technical detail */}
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-foreground">Sensory & technical notes</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailRow label="Taste & aroma" value={selected.tasteAroma} />
                    <DetailRow label="Solubility" value={selected.solubility} />
                    <DetailRow label="Processing behaviour" value={selected.processingBehaviour} />
                    <DetailRow label="Texture" value={selected.texture} />
                    <DetailRow label="Appearance & colour" value={selected.appearanceColour} />
                    <DetailRow label="Comparison vs control" value={selected.comparisonControl} />
                  </div>
                </div>

                {(selected.issuesEncountered ||
                  selected.questions ||
                  selected.requestedSupport ||
                  selected.availabilityForCall ||
                  selected.lotBatch) && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <DetailRow label="Issues encountered" value={selected.issuesEncountered} />
                      <DetailRow label="Questions for our team" value={selected.questions} />
                      <DetailRow label="Support requested" value={selected.requestedSupport} />
                      <DetailRow label="Availability for a call" value={selected.availabilityForCall} />
                      <DetailRow label="Lot / batch" value={selected.lotBatch} />
                    </div>
                  </>
                )}

                {/* Technical replies (client-visible only) */}
                <Separator />
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Beaker className="h-4 w-4 text-brand-teal" />
                    Conversation
                  </p>
                  {clientComments.length === 0 ? (
                    <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                      No replies yet. Our technical team will respond here once they have reviewed
                      your feedback.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {clientComments.map((c) => {
                        const fromUs = !!c.byUserId;
                        return (
                          <li
                            key={c.id}
                            className={cn(
                              'rounded-lg border p-3 text-sm',
                              fromUs
                                ? 'border-brand-teal/30 bg-brand-teal/5'
                                : 'bg-muted/30',
                            )}
                          >
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">
                                {fromUs ? 'Italprotein technical team' : 'Your team'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(c.at)}
                              </span>
                            </div>
                            <p className="text-foreground">{c.body}</p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {feedback.length > 0 && (
        <FadeIn delay={0.2}>
          <p className="text-center text-xs text-muted-foreground">
            Detailed, honest feedback helps our technical team fine-tune the next sample for you.
          </p>
        </FadeIn>
      )}
    </div>
  );
}
