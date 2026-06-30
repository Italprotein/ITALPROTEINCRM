'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Star,
  FlaskConical,
  ClipboardCheck,
  Beaker,
  Target,
  MessageSquare,
  Paperclip,
  Phone,
  Send,
  Save,
  X,
  Lock,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import {
  companyService,
  sampleService,
  feedbackService,
} from '@/lib/mock-services';
import { can } from '@/lib/permissions';
import type {
  Company,
  SampleRequest,
  Feedback,
  FeedbackResult,
  FeedbackStatus,
  NextStep,
  ApplicationCategory,
  AttachmentRef,
} from '@/lib/types';
import { APPLICATION_CATEGORIES } from '@/lib/types';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { FadeIn } from '@/components/shared/motion';
import { getLabel } from '@/lib/labels';
import { cn, uid } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ────────────────────────────── Constants ────────────────────────────── */

const RESULT_OPTIONS: FeedbackResult[] = ['positive', 'mixed', 'negative', 'inconclusive'];
const NEXT_STEP_OPTIONS: NextStep[] = [
  'new_sample',
  'technical_call',
  'reformulate',
  'proceed_commercial',
  'awaiting_decision',
  'close',
];

/** Samples that are far enough along to have something to report on. */
const TESTABLE_STATUSES = new Set([
  'delivered',
  'receipt_confirmed',
  'testing',
  'feedback_requested',
  'feedback_received',
  'closed',
]);

/** Sensory dimensions captured as a 1-5 scale + optional note. */
const SENSORY_FIELDS = [
  { key: 'tasteAroma', label: 'Taste & aroma' },
  { key: 'solubility', label: 'Solubility' },
  { key: 'processingBehaviour', label: 'Processing behaviour' },
  { key: 'texture', label: 'Texture' },
  { key: 'appearanceColour', label: 'Appearance & colour' },
  { key: 'aftertaste', label: 'Aftertaste' },
] as const;

type SensoryKey = (typeof SENSORY_FIELDS)[number]['key'];

const SCALE_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Below expectations',
  3: 'Acceptable',
  4: 'Good',
  5: 'Excellent',
};

interface SensoryEntry {
  score?: number;
  note: string;
}

interface MockAttachment {
  id: string;
  name: string;
  sizeKb: number;
}

/* ────────────────────────────── Star picker ────────────────────────────── */

function StarPicker({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = React.useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n === value ? 0 : n)}
            className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <Star
              className={cn(
                'h-7 w-7 transition-colors',
                n <= active
                  ? 'fill-brand-gold text-brand-gold'
                  : 'fill-muted text-muted-foreground/40',
              )}
            />
          </button>
        ))}
      </div>
      <span className="text-sm text-muted-foreground">
        {active ? `${active}/5 · ${SCALE_LABELS[active]}` : 'Tap to rate'}
      </span>
    </div>
  );
}

/* ────────────────────────────── Small scale picker ────────────────────────────── */

function ScalePicker({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n === value ? 0 : n)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md border text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            value === n
              ? 'border-brand-navy bg-brand-navy text-white'
              : 'border-input bg-background text-muted-foreground hover:border-brand-navy/40 hover:text-foreground',
          )}
          aria-label={`${n} of 5`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/* ────────────────────────────── Section card ────────────────────────────── */

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/* ────────────────────────────── Page ────────────────────────────── */

export default function NewFeedbackPage() {
  const { session, ready } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetSample = searchParams.get('sample') ?? '';

  const companyId = session?.companyId;
  const role = session?.role;
  const allowed = role ? can(role, 'portal.submit_feedback') : false;

  const [company, setCompany] = React.useState<Company | null>(null);
  const [samples, setSamples] = React.useState<SampleRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  /* Form state */
  const [sampleId, setSampleId] = React.useState<string>('');
  const [applicationCategory, setApplicationCategory] = React.useState<ApplicationCategory | ''>('');
  const [testDate, setTestDate] = React.useState('');
  const [overallRating, setOverallRating] = React.useState(0);
  const [overallResult, setOverallResult] = React.useState<FeedbackResult | ''>('');
  const [sensory, setSensory] = React.useState<Record<SensoryKey, SensoryEntry>>({
    tasteAroma: { note: '' },
    solubility: { note: '' },
    processingBehaviour: { note: '' },
    texture: { note: '' },
    appearanceColour: { note: '' },
    aftertaste: { note: '' },
  });
  const [sugarReduction, setSugarReduction] = React.useState('');
  const [proteinObjective, setProteinObjective] = React.useState('');
  const [issuesEncountered, setIssuesEncountered] = React.useState('');
  const [questions, setQuestions] = React.useState('');
  const [comments, setComments] = React.useState('');
  const [attachments, setAttachments] = React.useState<MockAttachment[]>([]);
  const [requestCall, setRequestCall] = React.useState(false);
  const [availability, setAvailability] = React.useState('');
  const [nextStep, setNextStep] = React.useState<NextStep | ''>('');

  const [submitting, setSubmitting] = React.useState(false);
  const [showErrors, setShowErrors] = React.useState(false);

  /* Load company + samples */
  React.useEffect(() => {
    if (!ready) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    let active = true;
    Promise.all([companyService.get(companyId), sampleService.byCompany(companyId)]).then(
      ([c, s]) => {
        if (!active) return;
        setCompany(c ?? null);
        setSamples(s);
        setLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [ready, companyId]);

  /* Testable samples (delivered / testing / …) */
  const testableSamples = React.useMemo(
    () => samples.filter((s) => TESTABLE_STATUSES.has(s.status)),
    [samples],
  );

  /* Preselect from ?sample= once samples are loaded */
  React.useEffect(() => {
    if (!presetSample || sampleId) return;
    const match = testableSamples.find((s) => s.id === presetSample);
    if (match) {
      setSampleId(match.id);
      setApplicationCategory(match.applicationCategory);
    }
  }, [presetSample, testableSamples, sampleId]);

  /* When a sample is chosen, default the application category to its own */
  const selectSample = (id: string) => {
    setSampleId(id);
    const match = testableSamples.find((s) => s.id === id);
    if (match && !applicationCategory) setApplicationCategory(match.applicationCategory);
  };

  const setSensoryScore = (key: SensoryKey, score: number) =>
    setSensory((prev) => ({ ...prev, [key]: { ...prev[key], score: score || undefined } }));
  const setSensoryNote = (key: SensoryKey, note: string) =>
    setSensory((prev) => ({ ...prev, [key]: { ...prev[key], note } }));

  const addMockAttachment = () => {
    const n = attachments.length + 1;
    setAttachments((prev) => [
      ...prev,
      { id: uid('att'), name: `test-results-${n}.pdf`, sizeKb: 180 + n * 40 },
    ]);
    toast({
      title: 'File attached',
      description: 'Your document was added to this feedback (preview upload).',
      variant: 'success',
    });
  };
  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));

  /* Validation: required for a real submission */
  const errors = {
    applicationCategory: !applicationCategory,
    testDate: !testDate,
    overall: overallRating === 0 && !overallResult,
  };
  const hasErrors = errors.applicationCategory || errors.testDate || errors.overall;

  /* Compose a sensory string: "4/5 — note" */
  function composeSensory(key: SensoryKey): string | undefined {
    const e = sensory[key];
    const parts: string[] = [];
    if (e.score) parts.push(`${e.score}/5 (${SCALE_LABELS[e.score]})`);
    if (e.note.trim()) parts.push(e.note.trim());
    return parts.length ? parts.join(' — ') : undefined;
  }

  function composeComments(): string {
    const lines: string[] = [];
    if (comments.trim()) lines.push(comments.trim());
    if (sugarReduction.trim()) lines.push(`Sugar-reduction objective: ${sugarReduction.trim()}%`);
    if (proteinObjective.trim()) lines.push(`Protein objective: ${proteinObjective.trim()}`);
    return lines.join('\n');
  }

  async function persist(status: FeedbackStatus, isDraft: boolean) {
    if (!companyId) return;
    setSubmitting(true);
    try {
      // Simulate a network round-trip.
      await new Promise((r) => setTimeout(r, 500));

      const ref = String(Math.floor(1000 + Math.random() * 9000));
      const attachmentRefs: AttachmentRef[] = attachments.map((a) => ({
        id: a.id,
        name: a.name,
        fileType: 'pdf',
        sizeKb: a.sizeKb,
        uploadedAt: new Date().toISOString(),
      }));

      const record: Feedback = {
        id: uid('fb'),
        reference: `FB-2026-${ref}`,
        companyId,
        sampleRequestId: sampleId || undefined,
        applicationCategory: (applicationCategory || 'other') as ApplicationCategory,
        productProjectName:
          testableSamples.find((s) => s.id === sampleId)?.requestedProduct ?? undefined,
        testDate: testDate || undefined,
        overallResult: overallResult || undefined,
        overallRating: overallRating || undefined,
        tasteAroma: composeSensory('tasteAroma'),
        solubility: composeSensory('solubility'),
        processingBehaviour: composeSensory('processingBehaviour'),
        texture: composeSensory('texture'),
        appearanceColour: composeSensory('appearanceColour'),
        comparisonControl: composeSensory('aftertaste'),
        issuesEncountered: issuesEncountered.trim() || undefined,
        questions: questions.trim() || undefined,
        requestedSupport: requestCall ? 'Requested a technical call.' : undefined,
        preferredNextStep: nextStep || (requestCall ? 'technical_call' : undefined),
        availabilityForCall: requestCall ? availability.trim() || undefined : undefined,
        attachments: attachmentRefs.length ? attachmentRefs : undefined,
        priority: 'medium',
        status,
        comments: [],
        createdAt: new Date().toISOString().slice(0, 10),
      };

      await feedbackService.create(record);

      toast({
        title: isDraft ? 'Draft saved' : 'Feedback submitted',
        description: isDraft
          ? `${record.reference} was saved. You can complete and submit it any time.`
          : `Thank you! ${record.reference} is now with our technical team.`,
        variant: 'success',
      });
      router.push('/portal/feedback');
    } finally {
      setSubmitting(false);
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasErrors) {
      setShowErrors(true);
      toast({
        title: 'Please complete the required fields',
        description: 'Application tested, testing date and an overall evaluation are required.',
        variant: 'warning',
      });
      return;
    }
    void persist('received', false);
  };

  const handleSaveDraft = () => {
    void persist('under_review', true);
  };

  /* ── Loading ── */
  if (!ready || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  /* ── No company scope ── */
  if (!companyId || !company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Submit feedback" subtitle="Share how our sample performed." />
        <EmptyState
          icon={ClipboardCheck}
          title="No company selected"
          description="We could not find a company linked to your account. Please contact your Italprotein account manager."
        />
      </div>
    );
  }

  /* ── Permission gate ── */
  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Submit feedback"
          subtitle="Share how our sample performed in your application."
          actions={
            <Button variant="outline" onClick={() => router.push('/portal/feedback')}>
              <ChevronLeft className="h-4 w-4" />
              Back to feedback
            </Button>
          }
        />
        <EmptyState
          icon={Lock}
          title="You do not have permission to submit feedback"
          description="Your role has read-only access to feedback. Please ask your company owner or a technical colleague to submit results, or contact your account manager."
          action={
            <Button variant="outline" onClick={() => router.push('/portal/feedback')}>
              View feedback
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit feedback"
        subtitle={`Tell us how our sample performed for ${company.tradingName ?? company.legalName}.`}
        actions={
          <Button variant="outline" onClick={() => router.push('/portal/feedback')} disabled={submitting}>
            <ChevronLeft className="h-4 w-4" />
            Back to feedback
          </Button>
        }
      />

      <FadeIn>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Test details */}
          <SectionCard
            icon={FlaskConical}
            title="Test details"
            description="Which sample did you test, and in which application?"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sample">Related sample</Label>
                {testableSamples.length === 0 ? (
                  <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    No delivered samples to link yet — you can still submit general feedback.
                  </p>
                ) : (
                  <Select value={sampleId} onValueChange={selectSample} disabled={submitting}>
                    <SelectTrigger id="sample">
                      <SelectValue placeholder="Select a sample (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {testableSamples.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.reference} — {s.requestedProduct}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="application">
                  Application tested <span className="text-danger">*</span>
                </Label>
                <Select
                  value={applicationCategory}
                  onValueChange={(v) => setApplicationCategory(v as ApplicationCategory)}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="application"
                    className={cn(showErrors && errors.applicationCategory && 'border-danger')}
                  >
                    <SelectValue placeholder="Select an application" />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {getLabel('applicationCategory', c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showErrors && errors.applicationCategory && (
                  <p className="text-xs text-danger">Please choose the application you tested.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="testDate">
                  Testing date <span className="text-danger">*</span>
                </Label>
                <Input
                  id="testDate"
                  type="date"
                  value={testDate}
                  max="2026-06-17"
                  onChange={(e) => setTestDate(e.target.value)}
                  disabled={submitting}
                  className={cn(showErrors && errors.testDate && 'border-danger')}
                />
                {showErrors && errors.testDate && (
                  <p className="text-xs text-danger">Please enter when you ran the test.</p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 2. Overall evaluation */}
          <SectionCard
            icon={Star}
            title="Overall evaluation"
            description="Your headline verdict on this sample."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Overall rating <span className="text-danger">*</span>
                </Label>
                <StarPicker value={overallRating} onChange={setOverallRating} disabled={submitting} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="result">
                  Overall result <span className="text-danger">*</span>
                </Label>
                <Select
                  value={overallResult}
                  onValueChange={(v) => setOverallResult(v as FeedbackResult)}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="result"
                    className={cn(showErrors && errors.overall && 'border-danger')}
                  >
                    <SelectValue placeholder="Select a result" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {getLabel('feedbackResult', r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {showErrors && errors.overall && (
              <p className="text-xs text-danger">
                Please give an overall rating or select a result.
              </p>
            )}
          </SectionCard>

          {/* 3. Sensory ratings */}
          <SectionCard
            icon={Beaker}
            title="Sensory & technical ratings"
            description="Rate each dimension and add a short note where helpful."
          >
            <div className="space-y-4">
              {SENSORY_FIELDS.map((field, i) => (
                <React.Fragment key={field.key}>
                  {i > 0 && <Separator />}
                  <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-start">
                    <div className="space-y-2">
                      <Label className="text-sm">{field.label}</Label>
                      <ScalePicker
                        value={sensory[field.key].score}
                        onChange={(v) => setSensoryScore(field.key, v)}
                        disabled={submitting}
                      />
                    </div>
                    <Input
                      value={sensory[field.key].note}
                      onChange={(e) => setSensoryNote(field.key, e.target.value)}
                      placeholder={`Notes on ${field.label.toLowerCase()} (optional)`}
                      disabled={submitting}
                    />
                  </div>
                </React.Fragment>
              ))}
            </div>
          </SectionCard>

          {/* 4. Objectives */}
          <SectionCard
            icon={Target}
            title="Objectives & targets"
            description="How did the sample perform against your formulation goals?"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sugar">Sugar-reduction achieved (%)</Label>
                <Input
                  id="sugar"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={sugarReduction}
                  onChange={(e) => setSugarReduction(e.target.value)}
                  placeholder="e.g. 30"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="protein">Protein objective</Label>
                <Input
                  id="protein"
                  value={proteinObjective}
                  onChange={(e) => setProteinObjective(e.target.value)}
                  placeholder="e.g. 20 g per serving"
                  disabled={submitting}
                />
              </div>
            </div>
          </SectionCard>

          {/* 5. Comments, issues & questions */}
          <SectionCard
            icon={MessageSquare}
            title="Comments & questions"
            description="Anything else our technical team should know."
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="issues">Issues encountered</Label>
                <Textarea
                  id="issues"
                  value={issuesEncountered}
                  onChange={(e) => setIssuesEncountered(e.target.value)}
                  placeholder="Describe any problems you ran into during testing."
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="questions">Questions for our team</Label>
                <Textarea
                  id="questions"
                  value={questions}
                  onChange={(e) => setQuestions(e.target.value)}
                  placeholder="e.g. recommended dosage to avoid haze in clear beverages?"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="comments">General comments</Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Overall impressions, context and any other detail."
                  disabled={submitting}
                />
              </div>

              {/* Attachments (mock) */}
              <div className="space-y-2">
                <Label>Attachments</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMockAttachment}
                    disabled={submitting}
                  >
                    <Paperclip className="h-4 w-4" />
                    Attach test results
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    PDF, images or lab reports.
                  </span>
                </div>
                {attachments.length > 0 && (
                  <ul className="space-y-1.5">
                    {attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{a.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {a.sizeKb} KB
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          disabled={submitting}
                          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                          aria-label={`Remove ${a.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 6. Next step */}
          <SectionCard
            icon={Phone}
            title="Next step"
            description="Tell us how you would like to move forward."
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                <div>
                  <Label htmlFor="call" className="text-sm font-medium">
                    Request a technical call
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A specialist will reach out to discuss your results.
                  </p>
                </div>
                <Switch
                  id="call"
                  checked={requestCall}
                  onCheckedChange={setRequestCall}
                  disabled={submitting}
                />
              </div>

              {requestCall && (
                <div className="space-y-1.5">
                  <Label htmlFor="availability">Your availability for a call</Label>
                  <Input
                    id="availability"
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                    placeholder="e.g. Weekdays 14:00–16:00 CET"
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="nextStep">Next sample / preferred next step</Label>
                <Select
                  value={nextStep}
                  onValueChange={(v) => setNextStep(v as NextStep)}
                  disabled={submitting}
                >
                  <SelectTrigger id="nextStep">
                    <SelectValue placeholder="Select your preferred next step" />
                  </SelectTrigger>
                  <SelectContent>
                    {NEXT_STEP_OPTIONS.map((n) => (
                      <SelectItem key={n} value={n}>
                        {getLabel('nextStep', n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SectionCard>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={submitting}
            >
              <Save className="h-4 w-4" />
              Save as draft
            </Button>
            <Button type="submit" variant="gold" disabled={submitting}>
              <Send className="h-4 w-4" />
              {submitting ? 'Submitting…' : 'Submit feedback'}
            </Button>
          </div>
        </form>
      </FadeIn>
    </div>
  );
}
