'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  FlaskConical,
  Building2,
  Package,
  CalendarDays,
  User,
  MapPin,
  Truck,
  CheckCircle2,
  XCircle,
  ChevronRight,
  FileText,
  MessageSquareQuote,
  PackagePlus,
  Star,
} from 'lucide-react';

import { sampleService, companyService, shipmentService, feedbackService, deriveShipmentStatus } from '@/lib/mock-services';
import { authService } from '@/lib/mock-services/authService';
import type {
  SampleRequest,
  SampleStatus,
  Company,
  Shipment,
  Feedback,
  Locale,
} from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, formatQuantity, formatDateTime, flagEmoji } from '@/lib/formatting';
import { initials } from '@/lib/utils';
import { Link, useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { ErrorState } from '@/components/shared/error-state';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Helpers ────────────────────────────── */

function ownerName(id: string | undefined, unassignedLabel: string): string {
  if (!id) return unassignedLabel;
  const a = authService.getAccount(id);
  return a ? `${a.firstName} ${a.lastName}` : unassignedLabel;
}

const ADVANCE_STAGES: SampleStatus[] = [
  'under_review',
  'approved',
  'preparing',
  'ready_to_ship',
  'shipped',
  'delivered',
  'testing',
  'feedback_received',
  'closed',
];

/* ────────────────────────────── Page ────────────────────────────── */

export default function SampleDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('AdminSampleDetail');
  const router = useRouter();

  const [sample, setSample] = React.useState<SampleRequest | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [shipment, setShipment] = React.useState<Shipment | null>(null);
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);
  const [loading, setLoading] = React.useState(true);

  // required documents checklist (mock-checkable)
  const [checkedDocs, setCheckedDocs] = React.useState<Set<string>>(new Set());
  const [rejectOpen, setRejectOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const s = await sampleService.get(params.id);
    if (!s) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setSample(s);
    const [c, shipments, fbs] = await Promise.all([
      companyService.get(s.companyId),
      shipmentService.bySample(s.id),
      feedbackService.bySample(s.id),
    ]);
    setCompany(c ?? null);
    setShipment(shipments[0] ?? null);
    setFeedback(fbs[0] ?? null);
    setLoading(false);
  }, [params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* ── mutations (mock) ── */
  function applyStatus(status: SampleStatus, extra?: Partial<SampleRequest>) {
    if (!sample) return;
    const today = '2026-06-17';
    const next: SampleRequest = {
      ...sample,
      status,
      ...extra,
      statusHistory: [...sample.statusHistory, { status, at: today, byUserId: 'u_giuseppe' }],
    };
    setSample(next);
    void sampleService.update(sample.id, {
      status,
      ...extra,
      statusHistory: next.statusHistory,
    });
  }

  function approve() {
    if (!sample) return;
    applyStatus('approved', { approvedQuantity: sample.requestedQuantity, approvalDate: '2026-06-17' });
    toast({
      variant: 'success',
      title: t('sampleApprovedTitle'),
      description: t('sampleApprovedDescription', {
        reference: sample.reference,
        quantity: formatQuantity(sample.requestedQuantity, sample.unit, locale),
      }),
    });
  }

  function confirmReject() {
    if (!sample) return;
    applyStatus('rejected');
    toast({
      variant: 'warning',
      title: t('sampleRejectedTitle'),
      description: t('sampleRejectedDescription', { reference: sample.reference }),
    });
  }

  function advance(status: SampleStatus) {
    if (!sample) return;
    applyStatus(status);
    toast({
      variant: 'success',
      title: t('statusUpdatedTitle'),
      description: t('statusUpdatedDescription', {
        reference: sample.reference,
        status: getLabel('sampleStatus', status),
      }),
    });
  }

  async function createShipment() {
    if (!sample) return;
    await new Promise((r) => setTimeout(r, 500));
    applyStatus('ready_to_ship');
    toast({
      variant: 'success',
      title: t('shipmentCreatedTitle'),
      description: t('shipmentCreatedDescription', { reference: sample.reference }),
    });
  }

  function toggleDoc(doc: string) {
    setCheckedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(doc)) next.delete(doc);
      else next.add(doc);
      return next;
    });
  }

  /* ── render guards ── */
  if (notFound) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title={t('notFoundTitle')}
          description={t('notFoundDescription')}
          onRetry={() => router.push('/admin/samples')}
        />
      </div>
    );
  }

  if (loading || !sample) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 w-full lg:col-span-2" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  const canApprove =
    sample.status === 'submitted' || sample.status === 'under_review' || sample.status === 'more_info_required';
  const requiredDocs = sample.requiredDocuments ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
        <Link href="/admin/samples">
          <ArrowLeft className="h-4 w-4" />
          {t('backToSamples')}
        </Link>
      </Button>

      <PageHeader
        title={sample.reference}
        subtitle={sample.requestedProduct}
        actions={
          <>
            {canApprove ? (
              <>
                <Button variant="success" onClick={approve}>
                  <CheckCircle2 />
                  {t('approve')}
                </Button>
                <Button variant="outline" onClick={() => setRejectOpen(true)}>
                  <XCircle />
                  {t('reject')}
                </Button>
              </>
            ) : null}
            <Button variant="outline" onClick={createShipment}>
              <PackagePlus />
              {t('createShipment')}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="gold">
                  {t('advanceStatus')}
                  <ChevronRight />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('moveTo')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ADVANCE_STAGES.map((st) => (
                  <DropdownMenuItem key={st} onSelect={() => advance(st)} disabled={st === sample.status}>
                    <StatusBadge kind="sampleStatus" value={st} />
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* status / company strip */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge kind="sampleStatus" value={sample.status} />
        <PriorityBadge value={sample.priority} />
        <StatusBadge kind="applicationCategory" value={sample.applicationCategory} />
        {company ? (
          <Link
            href={'/admin/companies/' + company.id}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
          >
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{flagEmoji(company.countryCode)}</span>
            {company.tradingName || company.legalName}
          </Link>
        ) : null}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          icon={Package}
          label={t('requestedApproved')}
          value={
            <span className="tabular">
              {formatQuantity(sample.requestedQuantity, sample.unit, locale)}
              {sample.approvedQuantity != null ? (
                <span className="text-muted-foreground"> / {formatQuantity(sample.approvedQuantity, sample.unit, locale)}</span>
              ) : (
                <span className="text-muted-foreground"> / —</span>
              )}
            </span>
          }
        />
        <SummaryCard
          icon={FlaskConical}
          label={t('application')}
          value={getLabel('applicationCategory', sample.applicationCategory)}
        />
        <SummaryCard icon={CalendarDays} label={t('requestDate')} value={formatDate(sample.requestDate, locale)} />
        <SummaryCard
          icon={User}
          label={t('accountOwner')}
          value={
            <span className="inline-flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-navy/10 text-2xs font-semibold text-brand-navy">
                {initials(ownerName(sample.accountOwnerId, t('unassigned')))}
              </span>
              {ownerName(sample.accountOwnerId, t('unassigned'))}
            </span>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: timeline + docs */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('statusTimeline')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l border-border pl-6">
                {[...sample.statusHistory].reverse().map((ev, i) => (
                  <li key={`${ev.status}-${ev.at}-${i}`} className="relative">
                    <span
                      className="absolute -left-[1.6875rem] top-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-card bg-brand-teal"
                      aria-hidden
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge kind="sampleStatus" value={ev.status} />
                      <span className="text-xs text-muted-foreground">{formatDate(ev.at, locale)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('timelineBy', { name: ownerName(ev.byUserId, t('unassigned')) })}
                      {ev.note ? <span className="text-foreground"> — {ev.note}</span> : null}
                    </p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Required documents checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('requiredDocuments')}</CardTitle>
            </CardHeader>
            <CardContent>
              {requiredDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noDocumentsRequired')}</p>
              ) : (
                <ul className="space-y-3">
                  {requiredDocs.map((doc) => {
                    const id = `doc-${doc}`;
                    const checked = checkedDocs.has(doc);
                    return (
                      <li key={doc} className="flex items-center gap-3">
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={() => toggleDoc(doc)}
                        />
                        <Label htmlFor={id} className="flex flex-1 items-center gap-2 font-normal">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className={checked ? 'text-muted-foreground line-through' : 'text-foreground'}>{doc}</span>
                        </Label>
                        {checked ? (
                          <Badge variant="success" className="text-2xs">
                            {t('ready')}
                          </Badge>
                        ) : (
                          <Badge variant="muted" className="text-2xs">
                            {t('pending')}
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: destination, shipment, feedback */}
        <div className="space-y-6">
          {/* Destination */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {t('destination')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {sample.recipient ? (
                <DetailRow label={t('recipient')} value={sample.recipient} />
              ) : null}
              {sample.recipientEmail ? <DetailRow label={t('email')} value={sample.recipientEmail} /> : null}
              {sample.deliveryAddress ? (
                <div>
                  <p className="text-xs text-muted-foreground">{t('address')}</p>
                  <p className="mt-0.5 text-foreground">
                    {sample.deliveryAddress.line1}
                    <br />
                    {[sample.deliveryAddress.postalCode, sample.deliveryAddress.city].filter(Boolean).join(' ')}
                    <br />
                    <span className="inline-flex items-center gap-1">
                      {flagEmoji(sample.deliveryAddress.countryCode)} {sample.deliveryAddress.country}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">{t('noDestinationRecorded')}</p>
              )}
              {sample.internalInstructions ? (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">{t('internalInstructions')}</p>
                    <p className="mt-0.5 text-foreground">{sample.internalInstructions}</p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* Linked shipment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4 text-muted-foreground" />
                {t('linkedShipment')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {shipment ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">{shipment.reference}</span>
                    <StatusBadge kind="customsStatus" value={deriveShipmentStatus(shipment)} />
                  </div>
                  {shipment.courier ? <DetailRow label={t('courier')} value={shipment.courier} /> : null}
                  {shipment.trackingNumber ? (
                    <DetailRow
                      label={t('tracking')}
                      value={
                        shipment.trackingUrl ? (
                          <a
                            href={shipment.trackingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-info hover:underline"
                          >
                            {shipment.trackingNumber}
                          </a>
                        ) : (
                          shipment.trackingNumber
                        )
                      }
                    />
                  ) : null}
                  {shipment.shipmentDate ? <DetailRow label={t('shipped')} value={formatDate(shipment.shipmentDate, locale)} /> : null}
                  {shipment.estimatedDelivery ? (
                    <DetailRow label={t('estDelivery')} value={formatDate(shipment.estimatedDelivery, locale)} />
                  ) : null}
                  {shipment.actualDelivery ? (
                    <DetailRow label={t('delivered')} value={formatDate(shipment.actualDelivery, locale)} />
                  ) : null}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-muted-foreground">{t('noShipmentLinked')}</p>
                  <Button variant="outline" size="sm" onClick={createShipment} className="w-full">
                    <PackagePlus className="h-4 w-4" />
                    {t('createShipment')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked feedback */}
          {feedback ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquareQuote className="h-4 w-4 text-muted-foreground" />
                  {t('feedback')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">{feedback.reference}</span>
                  <StatusBadge kind="feedbackStatus" value={feedback.status} />
                </div>
                {feedback.overallResult ? (
                  <DetailRow
                    label={t('result')}
                    value={<StatusBadge kind="feedbackResult" value={feedback.overallResult} />}
                  />
                ) : null}
                {feedback.overallRating != null ? (
                  <DetailRow
                    label={t('rating')}
                    value={
                      <span className="inline-flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={
                              i < (feedback.overallRating ?? 0)
                                ? 'h-3.5 w-3.5 fill-brand-gold text-brand-gold'
                                : 'h-3.5 w-3.5 text-muted-foreground/40'
                            }
                          />
                        ))}
                      </span>
                    }
                  />
                ) : null}
                {feedback.testDate ? <DetailRow label={t('tested')} value={formatDateTime(feedback.testDate, locale)} /> : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t('rejectDialogTitle')}
        description={t('rejectDialogDescription', { reference: sample.reference })}
        confirmLabel={t('rejectLabel')}
        variant="danger"
        onConfirm={confirmReject}
      />
    </div>
  );
}

/* ────────────────────────────── Sub-components ────────────────────────────── */

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <p className="text-xs font-medium">{label}</p>
        </div>
        <div className="mt-1.5 text-sm font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
