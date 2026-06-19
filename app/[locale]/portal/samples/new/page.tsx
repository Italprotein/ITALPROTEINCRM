'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  FlaskConical,
  Package,
  MapPin,
  FileText,
  ClipboardCheck,
  ArrowLeft,
  ArrowRight,
  Check,
  UploadCloud,
  X,
  Lock,
  Send,
} from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { companyService, sampleService } from '@/lib/mock-services';
import type { Company, ApplicationCategory, QuantityUnit, SampleRequest } from '@/lib/types';
import { APPLICATION_CATEGORIES } from '@/lib/types';
import { can } from '@/lib/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { getLabel } from '@/lib/labels';
import { uid, cn } from '@/lib/utils';
import { formatQuantity } from '@/lib/formatting';

const NOW_ISO = '2026-06-17T12:00:00Z';
const NOW_DATE = '2026-06-17';
const DEFAULT_PRODUCT = 'Proamina® 100% Protein Sweetener';

const UNITS: QuantityUnit[] = ['g', 'kg', 'units', 'sachets', 'boxes', 'l', 'ml'];

interface FormState {
  applicationCategory: ApplicationCategory | '';
  requestedProduct: string;
  testObjective: string;
  requestedQuantity: string;
  unit: QuantityUnit;
  packagingType: string;
  recipient: string;
  line1: string;
  city: string;
  postalCode: string;
  country: string;
  recipientPhone: string;
  clientVisibleNotes: string;
}

interface UploadedFile {
  id: string;
  name: string;
  sizeKb: number;
}

const STEPS = [
  { id: 'application', label: 'Application', icon: FlaskConical },
  { id: 'quantity', label: 'Quantity', icon: Package },
  { id: 'destination', label: 'Destination', icon: MapPin },
  { id: 'notes', label: 'Notes & files', icon: FileText },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
] as const;

const EASE = [0.22, 1, 0.36, 1] as const;

export default function NewSampleRequestPage() {
  const { session, ready } = useSession();
  const router = useRouter();
  const companyId = session?.companyId;
  const role = session?.role;
  const canRequest = role ? can(role, 'portal.request_sample') : false;

  const [company, setCompany] = React.useState<Company | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [step, setStep] = React.useState(0);
  const [direction, setDirection] = React.useState(1);
  const [submitting, setSubmitting] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const [files, setFiles] = React.useState<UploadedFile[]>([]);
  const [dragging, setDragging] = React.useState(false);

  const [form, setForm] = React.useState<FormState>({
    applicationCategory: '',
    requestedProduct: DEFAULT_PRODUCT,
    testObjective: '',
    requestedQuantity: '',
    unit: 'g',
    packagingType: '',
    recipient: '',
    line1: '',
    city: '',
    postalCode: '',
    country: '',
    recipientPhone: '',
    clientVisibleNotes: '',
  });

  React.useEffect(() => {
    if (!ready || !companyId) {
      if (ready) setLoading(false);
      return;
    }
    let active = true;
    companyService.get(companyId).then((c) => {
      if (!active) return;
      setCompany(c ?? null);
      // Pre-fill destination from the company's primary shipping/HQ address.
      const addr = c?.shippingAddresses?.[0] ?? c?.headquarters;
      if (c && addr) {
        setForm((prev) => ({
          ...prev,
          country: addr.country ?? prev.country,
          city: addr.city ?? prev.city,
          line1: addr.line1 ?? prev.line1,
          postalCode: addr.postalCode ?? prev.postalCode,
        }));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [ready, companyId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── per-step validation ──────────────────────────────────────────────────
  const stepErrors = React.useMemo<Record<string, string>>(() => {
    const e: Record<string, string> = {};
    if (step === 0) {
      if (!form.applicationCategory) e.applicationCategory = 'Choose an application category.';
      if (!form.requestedProduct.trim()) e.requestedProduct = 'Tell us which product you need.';
    } else if (step === 1) {
      const qty = Number(form.requestedQuantity);
      if (!form.requestedQuantity.trim() || Number.isNaN(qty) || qty <= 0) {
        e.requestedQuantity = 'Enter a quantity greater than zero.';
      }
    } else if (step === 2) {
      if (!form.recipient.trim()) e.recipient = 'Who should receive the sample?';
      if (!form.line1.trim()) e.line1 = 'Address line is required.';
      if (!form.city.trim()) e.city = 'City is required.';
      if (!form.postalCode.trim()) e.postalCode = 'Postal code is required.';
      if (!form.country.trim()) e.country = 'Country is required.';
    }
    return e;
  }, [step, form]);

  const stepValid = Object.keys(stepErrors).length === 0;

  function goNext() {
    setAttempted(true);
    if (!stepValid) return;
    setDirection(1);
    setAttempted(false);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function goBack() {
    setDirection(-1);
    setAttempted(false);
    setStep((s) => Math.max(0, s - 1));
  }

  async function handleSubmit() {
    if (!companyId || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));

    const random4 = String(Math.floor(1000 + Math.random() * 9000));
    const id = uid('sr');
    const record: SampleRequest = {
      id,
      reference: `SR-2026-${random4}`,
      companyId,
      contactId: undefined,
      applicationCategory: form.applicationCategory as ApplicationCategory,
      requestedProduct: form.requestedProduct.trim(),
      testObjective: form.testObjective.trim() || undefined,
      requestedQuantity: Number(form.requestedQuantity),
      unit: form.unit,
      packagingType: form.packagingType.trim() || undefined,
      requestDate: NOW_DATE,
      priority: 'medium',
      clientVisibleNotes: form.clientVisibleNotes.trim() || undefined,
      attachments: files.map((f) => ({
        id: f.id,
        name: f.name,
        fileType: f.name.split('.').pop() ?? 'file',
        sizeKb: f.sizeKb,
        uploadedAt: NOW_ISO,
      })),
      recipient: form.recipient.trim(),
      recipientPhone: form.recipientPhone.trim() || undefined,
      deliveryAddress: {
        line1: form.line1.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
        countryCode: company?.countryCode ?? '',
      },
      status: 'submitted',
      statusHistory: [
        { status: 'submitted', at: NOW_ISO, note: 'Submitted by the company via the portal.' },
      ],
      createdAt: NOW_ISO,
    };

    await sampleService.create(record);
    toast({
      title: 'Sample request submitted',
      description: `${record.reference} is now with our team — we'll review it shortly.`,
      variant: 'success',
    });
    router.push('/portal/samples');
  }

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const next: UploadedFile[] = Array.from(list).map((f) => ({
      id: uid('att'),
      name: f.name,
      sizeKb: Math.max(1, Math.round(f.size / 1024)),
    }));
    setFiles((prev) => [...prev, ...next]);
  }

  // ── guards ───────────────────────────────────────────────────────────────
  if (!ready || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Request a sample" />
        <EmptyState
          icon={FlaskConical}
          title="No company linked to your account"
          description="We could not find a company for your portal account. Please contact your Italprotein account manager."
        />
      </div>
    );
  }

  if (!canRequest) {
    return (
      <div className="space-y-6">
        <PageHeader title="Request a sample" subtitle="Order a Proamina sample for your application trials." />
        <EmptyState
          icon={Lock}
          title="You don't have permission to request samples"
          description="Your portal role can view samples but not create new requests. Ask a company owner to submit the request, or contact your account manager."
          action={
            <Button asChild variant="outline">
              <Link href="/portal/samples">
                <ArrowLeft className="h-4 w-4" />
                Back to samples
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;
  const isReview = step === STEPS.length - 1;
  const showError = (key: string) => attempted && stepErrors[key];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request a sample"
        subtitle="Tell us what you need and where to send it — it takes about a minute."
        actions={
          <Button asChild variant="outline">
            <Link href="/portal/samples">
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </Link>
          </Button>
        }
      />

      {/* Stepper */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const state = i < step ? 'done' : i === step ? 'current' : 'upcoming';
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={i > step}
                  onClick={() => {
                    if (i < step) {
                      setDirection(-1);
                      setAttempted(false);
                      setStep(i);
                    }
                  }}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1.5 text-center transition-opacity',
                    i > step && 'cursor-default',
                    i < step && 'cursor-pointer',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                      state === 'done' && 'border-success bg-success text-success-foreground',
                      state === 'current' && 'border-brand-navy bg-brand-navy text-white',
                      state === 'upcoming' && 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {state === 'done' ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span
                    className={cn(
                      'hidden text-xs font-medium sm:block',
                      state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
          <Progress value={progress} />
          <p className="text-center text-xs text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </p>
        </CardContent>
      </Card>

      {/* Animated step body */}
      <Card>
        <CardContent className="overflow-hidden p-5 sm:p-6">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -32 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              {step === 0 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="application">
                      Application category <span className="text-danger">*</span>
                    </Label>
                    <Select
                      value={form.applicationCategory || undefined}
                      onValueChange={(v) => set('applicationCategory', v as ApplicationCategory)}
                    >
                      <SelectTrigger id="application" className={cn(showError('applicationCategory') && 'border-danger')}>
                        <SelectValue placeholder="What will you make with it?" />
                      </SelectTrigger>
                      <SelectContent>
                        {APPLICATION_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {getLabel('applicationCategory', c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {showError('applicationCategory') && (
                      <p className="text-xs text-danger">{stepErrors.applicationCategory}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product">
                      Product <span className="text-danger">*</span>
                    </Label>
                    <Input
                      id="product"
                      value={form.requestedProduct}
                      onChange={(e) => set('requestedProduct', e.target.value)}
                      placeholder={DEFAULT_PRODUCT}
                      className={cn(showError('requestedProduct') && 'border-danger')}
                    />
                    {showError('requestedProduct') && (
                      <p className="text-xs text-danger">{stepErrors.requestedProduct}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="objective">Test objective</Label>
                    <Textarea
                      id="objective"
                      rows={4}
                      value={form.testObjective}
                      onChange={(e) => set('testObjective', e.target.value)}
                      placeholder="What do you want to evaluate? e.g. sweetness in a reduced-sugar protein bar."
                    />
                    <p className="text-xs text-muted-foreground">
                      Sharing your goal helps our R&amp;D team prepare the most relevant sample.
                    </p>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="quantity">
                        Requested quantity <span className="text-danger">*</span>
                      </Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        value={form.requestedQuantity}
                        onChange={(e) => set('requestedQuantity', e.target.value)}
                        placeholder="e.g. 250"
                        className={cn(showError('requestedQuantity') && 'border-danger')}
                      />
                      {showError('requestedQuantity') && (
                        <p className="text-xs text-danger">{stepErrors.requestedQuantity}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit</Label>
                      <Select value={form.unit} onValueChange={(v) => set('unit', v as QuantityUnit)}>
                        <SelectTrigger id="unit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="packaging">Packaging notes</Label>
                    <Textarea
                      id="packaging"
                      rows={3}
                      value={form.packagingType}
                      onChange={(e) => set('packagingType', e.target.value)}
                      placeholder="Any packaging preferences? e.g. foil pouch, individual sachets, sealed jar."
                    />
                  </div>

                  <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
                    Tip: pilot trials usually need 100–500 g, while pre-industrial runs may need
                    several kilograms. We&apos;ll confirm the exact amount on approval.
                  </p>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="recipient">
                      Recipient name <span className="text-danger">*</span>
                    </Label>
                    <Input
                      id="recipient"
                      value={form.recipient}
                      onChange={(e) => set('recipient', e.target.value)}
                      placeholder="Who will receive the parcel?"
                      className={cn(showError('recipient') && 'border-danger')}
                    />
                    {showError('recipient') && <p className="text-xs text-danger">{stepErrors.recipient}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="line1">
                      Address <span className="text-danger">*</span>
                    </Label>
                    <Input
                      id="line1"
                      value={form.line1}
                      onChange={(e) => set('line1', e.target.value)}
                      placeholder="Street and number"
                      className={cn(showError('line1') && 'border-danger')}
                    />
                    {showError('line1') && <p className="text-xs text-danger">{stepErrors.line1}</p>}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">
                        City <span className="text-danger">*</span>
                      </Label>
                      <Input
                        id="city"
                        value={form.city}
                        onChange={(e) => set('city', e.target.value)}
                        className={cn(showError('city') && 'border-danger')}
                      />
                      {showError('city') && <p className="text-xs text-danger">{stepErrors.city}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">
                        Postal code <span className="text-danger">*</span>
                      </Label>
                      <Input
                        id="postalCode"
                        value={form.postalCode}
                        onChange={(e) => set('postalCode', e.target.value)}
                        className={cn(showError('postalCode') && 'border-danger')}
                      />
                      {showError('postalCode') && <p className="text-xs text-danger">{stepErrors.postalCode}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">
                        Country <span className="text-danger">*</span>
                      </Label>
                      <Input
                        id="country"
                        value={form.country}
                        onChange={(e) => set('country', e.target.value)}
                        className={cn(showError('country') && 'border-danger')}
                      />
                      {showError('country') && <p className="text-xs text-danger">{stepErrors.country}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Recipient phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.recipientPhone}
                      onChange={(e) => set('recipientPhone', e.target.value)}
                      placeholder="For courier delivery questions"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes for our team</Label>
                    <Textarea
                      id="notes"
                      rows={4}
                      value={form.clientVisibleNotes}
                      onChange={(e) => set('clientVisibleNotes', e.target.value)}
                      placeholder="Anything else we should know? Deadlines, delivery instructions, certificates needed…"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Supporting documents</Label>
                    <label
                      htmlFor="file-upload"
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        addFiles(e.dataTransfer.files);
                      }}
                      className={cn(
                        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
                        dragging ? 'border-brand-navy bg-brand-navy/5' : 'border-border hover:border-brand-navy/50 hover:bg-muted/40',
                      )}
                    >
                      <UploadCloud className="h-7 w-7 text-muted-foreground" />
                      <p className="text-sm font-medium text-foreground">
                        Drag &amp; drop files here, or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Specs, briefs or formulation notes (PDF, DOCX, XLSX, images)
                      </p>
                      <input
                        id="file-upload"
                        type="file"
                        multiple
                        className="sr-only"
                        onChange={(e) => addFiles(e.target.files)}
                      />
                    </label>

                    {files.length > 0 && (
                      <ul className="space-y-2">
                        {files.map((f) => (
                          <li
                            key={f.id}
                            className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm"
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <span className="truncate">{f.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {f.sizeKb} KB
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              aria-label={`Remove ${f.name}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {isReview && (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Please review your request before submitting.
                  </p>

                  <ReviewSection title="Application & product">
                    <ReviewRow
                      label="Application"
                      value={
                        form.applicationCategory
                          ? getLabel('applicationCategory', form.applicationCategory)
                          : '—'
                      }
                    />
                    <ReviewRow label="Product" value={form.requestedProduct || '—'} />
                    <ReviewRow label="Test objective" value={form.testObjective || '—'} />
                  </ReviewSection>

                  <Separator />

                  <ReviewSection title="Quantity & packaging">
                    <ReviewRow
                      label="Quantity"
                      value={
                        form.requestedQuantity
                          ? formatQuantity(Number(form.requestedQuantity), form.unit)
                          : '—'
                      }
                    />
                    <ReviewRow label="Packaging notes" value={form.packagingType || '—'} />
                  </ReviewSection>

                  <Separator />

                  <ReviewSection title="Destination">
                    <ReviewRow label="Recipient" value={form.recipient || '—'} />
                    <ReviewRow
                      label="Address"
                      value={
                        [form.line1, form.postalCode, form.city, form.country]
                          .filter(Boolean)
                          .join(', ') || '—'
                      }
                    />
                    <ReviewRow label="Phone" value={form.recipientPhone || '—'} />
                  </ReviewSection>

                  <Separator />

                  <ReviewSection title="Notes & documents">
                    <ReviewRow label="Notes" value={form.clientVisibleNotes || '—'} />
                    <ReviewRow
                      label="Documents"
                      value={files.length ? `${files.length} file(s) attached` : 'None'}
                    />
                  </ReviewSection>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>

            {isReview ? (
              <Button variant="gold" onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Submit request
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={goNext}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
