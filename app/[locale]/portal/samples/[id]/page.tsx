'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FlaskConical,
  Package,
  CalendarDays,
  Gauge,
  Truck,
  ExternalLink,
  MapPin,
  PackageCheck,
  AlertTriangle,
  MessageSquarePlus,
  LifeBuoy,
  Download,
  FileText,
  Clock,
  ClipboardList,
  CheckCircle2,
  Boxes,
  Plane,
  ShieldCheck,
  Home,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import {
  sampleService,
  shipmentService,
  feedbackService,
  documentService,
  companyService,
} from '@/lib/mock-services';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import type {
  SampleRequest,
  Shipment,
  Feedback,
  DocumentRecord,
  Company,
} from '@/lib/types';
import { can } from '@/lib/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/formatting';
import { getLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';

const NOW = new Date();
const NOW_ISO = NOW.toISOString();

/** Visual tracking timeline steps (client-friendly). */
const TRACK_STEPS = [
  { key: 'preparing', label: 'Preparing', icon: ClipboardList },
  { key: 'ready', label: 'Ready', icon: Boxes },
  { key: 'collected', label: 'Collected', icon: Package },
  { key: 'in_transit', label: 'In transit', icon: Plane },
  { key: 'customs', label: 'Customs', icon: ShieldCheck },
  { key: 'out_for_delivery', label: 'Out for delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: Home },
] as const;

type TrackKey = (typeof TRACK_STEPS)[number]['key'];

/** Map sample + shipment state to the active timeline index. */
function activeTrackIndex(sample: SampleRequest, shipment?: Shipment): number {
  const idx = (k: TrackKey) => TRACK_STEPS.findIndex((s) => s.key === k);
  if (shipment?.actualDelivery || sample.status === 'delivered' || sample.status === 'receipt_confirmed' || sample.status === 'testing' || sample.status === 'feedback_requested' || sample.status === 'feedback_received' || sample.status === 'closed') {
    return idx('delivered');
  }
  if (sample.status === 'delivery_attempted') return idx('out_for_delivery');
  if (sample.status === 'customs_hold' || shipment?.customsStatus === 'hold' || shipment?.customsStatus === 'in_clearance') {
    return idx('customs');
  }
  if (sample.status === 'in_transit' || sample.status === 'shipped' || shipment?.shipmentDate) {
    return idx('in_transit');
  }
  if (sample.status === 'ready_to_ship') return idx('ready');
  if (sample.status === 'preparing' || sample.status === 'approved') return idx('preparing');
  return -1; // not yet in fulfilment (submitted / under review)
}

export default function SampleDetailPage() {
  const { session, ready } = useSession();
  const { get: getStaff } = useStaffDirectory();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const companyId = session?.companyId;
  const role = session?.role;

  const [sample, setSample] = React.useState<SampleRequest | null>(null);
  const [shipment, setShipment] = React.useState<Shipment | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback[]>([]);
  const [docs, setDocs] = React.useState<DocumentRecord[]>([]);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [confirmReceipt, setConfirmReceipt] = React.useState(false);
  const [reportProblem, setReportProblem] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!ready) return;
    if (!companyId) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const sr = await sampleService.get(params.id);
      if (!active) return;
      // Scope check: must belong to the signed-in company.
      if (!sr || sr.companyId !== companyId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const company = await companyService.get(companyId);
      const ndaSigned = company?.ndaStatus === 'fully_signed';
      const [shipments, fb, portalDocs] = await Promise.all([
        shipmentService.bySample(sr.id),
        feedbackService.bySample(sr.id),
        documentService.forPortal(companyId, ndaSigned),
      ]);
      if (!active) return;
      setSample(sr);
      setShipment(shipments[0] ?? null);
      setFeedback(fb);
      setCompany(company ?? null);
      // Surface the product datasheets / certificates that help with this sample.
      setDocs(
        portalDocs.filter((d) =>
          ['technical_data_sheet', 'safety_data_sheet', 'certificate', 'application_guide'].includes(
            d.category,
          ),
        ),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [ready, companyId, params.id]);

  async function handleConfirmReceipt() {
    if (!sample) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    const event = { status: 'receipt_confirmed' as const, at: NOW_ISO, note: 'Receipt confirmed by the company.' };
    await sampleService.update(sample.id, {
      status: 'receipt_confirmed',
      statusHistory: [...sample.statusHistory, event],
    });
    setSample((prev) =>
      prev ? { ...prev, status: 'receipt_confirmed', statusHistory: [...prev.statusHistory, event] } : prev,
    );
    setBusy(false);
    toast({
      title: 'Receipt confirmed',
      description: 'Thanks! We\'ve noted that your sample arrived safely.',
      variant: 'success',
    });
  }

  async function handleReportProblem() {
    if (!sample) return;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    setBusy(false);
    toast({
      title: 'Problem reported',
      description: 'Your account manager has been notified and will be in touch shortly.',
      variant: 'success',
    });
  }

  function handleDownload(doc: DocumentRecord) {
    toast({
      title: 'Preparing download',
      description: `${doc.name} will download shortly.`,
    });
  }

  // ── guards ───────────────────────────────────────────────────────────────
  if (!ready || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (notFound || !sample) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sample request" />
        <EmptyState
          icon={FlaskConical}
          title="Sample not found"
          description="This sample request doesn't exist or isn't linked to your company."
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

  const canConfirm = role ? can(role, 'portal.confirm_delivery') : false;
  const canFeedback = role ? can(role, 'portal.submit_feedback') : false;

  const owner = company ? getStaff(company.accountOwnerId) : undefined;

  const deliveredLike = ['delivered', 'receipt_confirmed', 'testing', 'feedback_requested', 'feedback_received', 'closed'].includes(
    sample.status,
  );
  const showConfirmReceipt = canConfirm && (sample.status === 'delivered' || sample.status === 'delivery_attempted');
  const showFeedback = canFeedback && deliveredLike && sample.status !== 'closed';

  const activeIdx = activeTrackIndex(sample, shipment ?? undefined);
  const trackPct =
    activeIdx < 0 ? 0 : ((activeIdx + 1) / TRACK_STEPS.length) * 100;
  const address = shipment?.address ?? sample.deliveryAddress;

  // status history newest-first for display
  const history = [...sample.statusHistory].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={sample.reference}
        subtitle={sample.requestedProduct}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/portal/samples">
                <ArrowLeft className="h-4 w-4" />
                All samples
              </Link>
            </Button>
            <StatusBadge kind="sampleStatus" value={sample.status} className="px-3 py-1.5 text-sm" />
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Requested quantity"
          value={formatQuantity(sample.requestedQuantity, sample.unit)}
          icon={Package}
          tone="default"
          hint={
            sample.approvedQuantity != null
              ? `Approved: ${formatQuantity(sample.approvedQuantity, sample.unit)}`
              : undefined
          }
          delay={0}
        />
        <StatCard
          label="Application"
          value={getLabel('applicationCategory', sample.applicationCategory)}
          icon={FlaskConical}
          tone="info"
          delay={0.05}
        />
        <StatCard
          label="Requested on"
          value={formatDate(sample.requestDate)}
          icon={CalendarDays}
          tone="success"
          hint={
            sample.requestedDeliveryDate ? `Target: ${formatDate(sample.requestedDeliveryDate)}` : undefined
          }
          delay={0.1}
        />
        <StatCard
          label="Priority"
          value={getLabel('priority', sample.priority)}
          icon={Gauge}
          tone="gold"
          delay={0.15}
        />
      </div>

      {sample.testObjective ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test objective</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{sample.testObjective}</p>
            {sample.clientVisibleNotes ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Notes: </span>
                {sample.clientVisibleNotes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Tracking timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Shipment tracking</CardTitle>
          {shipment?.isDelayed ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-2.5 py-1 text-xs font-medium text-warning-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              Delayed
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {activeIdx < 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
              Your request is still being reviewed. Tracking will appear here once we begin
              preparing your sample.
            </div>
          ) : (
            <>
              <Progress value={trackPct} indicatorClassName="bg-brand-navy" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                {TRACK_STEPS.map((s, i) => {
                  const Icon = s.icon;
                  const state = i < activeIdx ? 'done' : i === activeIdx ? 'current' : 'upcoming';
                  return (
                    <div key={s.key} className="flex flex-col items-center gap-2 text-center">
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-full border',
                          state === 'done' && 'border-success bg-success text-success-foreground',
                          state === 'current' && 'border-brand-navy bg-brand-navy text-white shadow-md',
                          state === 'upcoming' && 'border-border bg-muted text-muted-foreground',
                        )}
                      >
                        {state === 'done' ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </motion.span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground',
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {shipment ? (
            <>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem label="Courier" value={shipment.courier ?? '—'} icon={Truck} />
                <DetailItem
                  label="Tracking number"
                  icon={Package}
                  value={
                    shipment.trackingNumber ? (
                      shipment.trackingUrl ? (
                        <a
                          href={shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-brand-navy hover:underline"
                        >
                          {shipment.trackingNumber}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        shipment.trackingNumber
                      )
                    ) : (
                      '—'
                    )
                  }
                />
                <DetailItem
                  label="Estimated delivery"
                  icon={CalendarDays}
                  value={shipment.actualDelivery ? `Delivered ${formatDate(shipment.actualDelivery)}` : formatDate(shipment.estimatedDelivery)}
                />
                <DetailItem
                  label="Ship date"
                  icon={CalendarDays}
                  value={formatDate(shipment.shipmentDate)}
                />
              </div>
            </>
          ) : null}

          {address ? (
            <>
              <Separator />
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
                  <MapPin className="h-4 w-4" />
                </span>
                <div className="text-sm">
                  <p className="font-medium text-foreground">Shipping address</p>
                  <p className="text-muted-foreground">
                    {sample.recipient ? `${sample.recipient} · ` : ''}
                    {[address.line1, address.postalCode, address.city, address.country]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {/* Action buttons */}
          {(showConfirmReceipt || showFeedback) && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-2">
                {showConfirmReceipt ? (
                  <>
                    <Button
                      variant="success"
                      onClick={() => setConfirmReceipt(true)}
                      disabled={busy || sample.status === 'receipt_confirmed'}
                    >
                      <PackageCheck className="h-4 w-4" />
                      Confirm receipt
                    </Button>
                    <Button variant="outline" onClick={() => setReportProblem(true)} disabled={busy}>
                      <AlertTriangle className="h-4 w-4" />
                      Report a problem
                    </Button>
                  </>
                ) : null}
                {showFeedback ? (
                  <Button asChild variant="gold">
                    <Link href={`/portal/feedback/new?sample=${sample.id}`}>
                      <MessageSquarePlus className="h-4 w-4" />
                      Submit feedback
                    </Link>
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Status history */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status history</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-5 border-l border-border pl-6">
              {history.map((event, i) => (
                <li key={`${event.status}-${event.at}-${i}`} className="relative">
                  <span
                    className={cn(
                      'absolute -left-[1.6rem] flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-background',
                      i === 0 ? 'bg-brand-navy' : 'bg-muted-foreground/40',
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="sampleStatus" value={event.status} />
                    <span className="text-xs text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {formatDateTime(event.at)}
                    </span>
                  </div>
                  {event.note ? (
                    <p className="mt-1 text-sm text-muted-foreground">{event.note}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Documents + feedback + support */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Related documents</CardTitle>
            </CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents are available for this sample yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {d.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {getLabel('documentCategory', d.category)}
                            {d.sizeKb ? ` · ${d.sizeKb} KB` : ''}
                          </span>
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDownload(d)}
                        aria-label={`Download ${d.name}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {feedback.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {feedback.map((f) => (
                  <Link
                    key={f.id}
                    href={`/portal/feedback`}
                    className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {f.reference}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {f.testDate ? `Tested ${formatDate(f.testDate)}` : 'Awaiting review'}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {f.overallResult ? (
                        <StatusBadge kind="feedbackResult" value={f.overallResult} />
                      ) : null}
                      <StatusBadge kind="feedbackStatus" value={f.status} />
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium text-foreground">Need help with this sample?</p>
                <p className="text-muted-foreground">
                  {owner
                    ? `${owner.firstName} ${owner.lastName}, ${owner.jobTitle}`
                    : 'Our team is here to help.'}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/portal/requests">
                  <LifeBuoy className="h-4 w-4" />
                  Contact support
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReceipt}
        onOpenChange={setConfirmReceipt}
        title="Confirm you received this sample?"
        description={`We'll mark ${sample.reference} as received and let our R&D team know you're ready to test.`}
        confirmLabel="Yes, it arrived"
        onConfirm={() => void handleConfirmReceipt()}
      />

      <ConfirmDialog
        open={reportProblem}
        onOpenChange={setReportProblem}
        title="Report a problem with this delivery?"
        description="We'll notify your account manager so they can investigate (e.g. damaged, missing, or incorrect sample)."
        confirmLabel="Report problem"
        variant="danger"
        onConfirm={() => void handleReportProblem()}
      />
    </div>
  );
}

function DetailItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: typeof Truck;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
