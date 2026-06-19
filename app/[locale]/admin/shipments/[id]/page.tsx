'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import {
  ArrowLeft,
  Truck,
  Send,
  CheckCircle2,
  Flag,
  MapPin,
  ExternalLink,
  AlertTriangle,
  Package,
  Boxes,
  Weight,
  FileText,
  ClipboardList,
  Building2,
  Phone,
  Mail,
  PackageCheck,
  Warehouse,
  ShieldAlert,
  PlaneTakeoff,
  Truck as TruckIcon,
} from 'lucide-react';

import { shipmentService, companyService, sampleService } from '@/lib/mock-services';
import type { Shipment, Company, SampleRequest, Locale } from '@/lib/types';
import type { DerivedShipmentStatus } from '@/lib/mock-services';
import { getLabel } from '@/lib/labels';
import { formatDate, formatQuantity, flagEmoji } from '@/lib/formatting';
import { cn } from '@/lib/utils';
import { Link, useRouter } from '@/lib/i18n/navigation';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { ErrorState } from '@/components/shared/error-state';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

/* ────────────────────────────── Timeline ────────────────────────────── */

type TimelineStep = {
  key: string;
  label: string;
  icon: typeof Truck;
};

const TIMELINE: TimelineStep[] = [
  { key: 'preparing', label: 'Preparing', icon: Package },
  { key: 'collected', label: 'Collected', icon: Warehouse },
  { key: 'in_transit', label: 'In transit', icon: PlaneTakeoff },
  { key: 'customs', label: 'Customs', icon: ShieldAlert },
  { key: 'out_for_delivery', label: 'Out for delivery', icon: TruckIcon },
  { key: 'delivered', label: 'Delivered', icon: PackageCheck },
];

/** Map a shipment to the current index in the visual timeline. */
function currentStepIndex(s: Shipment): number {
  if (s.actualDelivery) return 5; // delivered
  if (s.customsStatus === 'hold' || s.customsStatus === 'in_clearance') return 3; // customs
  if (s.shipmentDate) {
    // dispatched: if customs cleared / not required and near ETA, treat as in transit
    return 2; // in transit
  }
  return 0; // preparing
}

const STATUS_META: Record<DerivedShipmentStatus, { label: string; variant: 'success' | 'info' | 'warning' | 'muted' }> = {
  delivered: { label: 'Delivered', variant: 'success' },
  in_transit: { label: 'In transit', variant: 'info' },
  customs: { label: 'At customs', variant: 'warning' },
  preparing: { label: 'Preparing', variant: 'muted' },
};

/* ────────────────────────────── Document checklist ────────────────────────────── */

const CHECKLIST_ITEMS = [
  'Commercial invoice',
  'Packing list',
  'Customs declaration (CN23)',
  'Certificate of analysis',
  'Safety data sheet',
  'Proof of delivery',
];

/* ────────────────────────────── Page ────────────────────────────── */

export default function ShipmentDetailPage({ params }: { params: { id: string } }) {
  const locale = useLocale() as Locale;
  const router = useRouter();

  const [shipment, setShipment] = React.useState<Shipment | null>(null);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [sample, setSample] = React.useState<SampleRequest | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  const [checked, setChecked] = React.useState<Record<string, boolean>>({});

  const [issueOpen, setIssueOpen] = React.useState(false);
  const [trackingOpen, setTrackingOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    const s = await shipmentService.getById(params.id);
    if (!s) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setShipment(s);
    const [c, sr] = await Promise.all([
      companyService.getById(s.companyId),
      sampleService.getById(s.sampleRequestId),
    ]);
    setCompany(c ?? null);
    setSample(sr ?? null);
    // pre-tick checklist items based on available data
    setChecked({
      'Commercial invoice': true,
      'Packing list': true,
      'Customs declaration (CN23)': !!s.customsStatus && s.customsStatus !== 'not_required',
      'Proof of delivery': !!s.proofOfDelivery || !!s.actualDelivery,
    });
    setLoading(false);
  }, [params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  function applyPatch(patch: Partial<Shipment>) {
    setShipment((prev) => (prev ? { ...prev, ...patch } : prev));
    void shipmentService.update(params.id, patch);
  }

  async function markDispatched() {
    if (!shipment) return;
    await new Promise((r) => setTimeout(r, 500));
    const today = new Date().toISOString().slice(0, 10);
    applyPatch({ shipmentDate: shipment.shipmentDate ?? today });
    toast({ variant: 'success', title: 'Shipment dispatched', description: `${shipment.reference} is on its way.` });
  }

  async function markDelivered() {
    if (!shipment) return;
    await new Promise((r) => setTimeout(r, 500));
    const today = new Date().toISOString().slice(0, 10);
    applyPatch({ actualDelivery: today, isDelayed: false, customsStatus: 'cleared' });
    toast({ variant: 'success', title: 'Delivery confirmed', description: `${shipment.reference} delivered.` });
  }

  /* ── loading / error ── */
  if (loading) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (notFound || !shipment) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Button variant="ghost" size="sm" onClick={() => router.push('/admin/shipments')}>
          <ArrowLeft />
          Back to shipments
        </Button>
        <ErrorState
          title="Shipment not found"
          description="This shipment may have been removed. Return to the shipments list."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const status = shipmentService.deriveStatus(shipment);
  const stepIdx = currentStepIndex(shipment);
  const progressPct = Math.round((stepIdx / (TIMELINE.length - 1)) * 100);
  const meta = STATUS_META[status];
  const delayed = !!shipment.isDelayed && !shipment.actualDelivery;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => router.push('/admin/shipments')}>
        <ArrowLeft />
        Back to shipments
      </Button>

      <PageHeader
        title={shipment.reference}
        subtitle={`${company?.tradingName || company?.legalName || 'Unknown company'} • ${shipment.address.city}, ${shipment.address.country}`}
        actions={
          <>
            {status === 'preparing' ? (
              <Button variant="outline" onClick={() => void markDispatched()}>
                <Send />
                Mark dispatched
              </Button>
            ) : null}
            {status !== 'delivered' ? (
              <Button variant="success" onClick={() => void markDelivered()}>
                <CheckCircle2 />
                Mark delivered
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setTrackingOpen(true)}>
              <MapPin />
              Add tracking update
            </Button>
            <Button variant="destructive" onClick={() => setIssueOpen(true)}>
              <Flag />
              Report issue
            </Button>
          </>
        }
      />

      {/* Delay alert banner */}
      {delayed ? (
        <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger-subtle/50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="text-sm font-semibold text-danger">Shipment delayed</p>
            <p className="text-sm text-muted-foreground">
              {shipment.deliveryIssue || 'This shipment is running behind its estimated delivery date. Follow up with the courier.'}
            </p>
          </div>
        </div>
      ) : null}

      {/* Tracking timeline */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Tracking timeline</CardTitle>
          <Badge variant={delayed ? 'danger' : meta.variant}>{delayed ? 'Delayed' : meta.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-5">
          <Progress
            value={progressPct}
            indicatorClassName={cn(delayed ? 'bg-danger' : status === 'delivered' ? 'bg-success' : 'bg-brand-teal')}
          />

          {/* steps */}
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {TIMELINE.map((step, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex flex-col items-center gap-2 text-center">
                  <span
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                      done && 'border-success bg-success-subtle text-success',
                      active && !delayed && 'border-brand-teal bg-brand-teal/10 text-brand-teal',
                      active && delayed && 'border-danger bg-danger-subtle text-danger',
                      !done && !active && 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className={cn(
                      'text-2xs font-medium leading-tight sm:text-xs',
                      active ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* key dates */}
          <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
            <Stat label="Dispatched" value={formatDate(shipment.shipmentDate, locale)} />
            <Stat label="Estimated delivery" value={formatDate(shipment.estimatedDelivery, locale)} />
            <Stat
              label="Delivered"
              value={formatDate(shipment.actualDelivery, locale)}
              valueClass={shipment.actualDelivery ? 'text-success' : undefined}
            />
            <Stat label="Sender" value={shipment.senderLocation} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Courier & tracking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Courier &amp; tracking</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field icon={Truck} label="Courier" value={shipment.courier ?? '—'} />
              <Field icon={Truck} label="Service" value={shipment.service ?? '—'} />
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  Tracking number
                </p>
                {shipment.trackingNumber ? (
                  shipment.trackingUrl ? (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-teal hover:underline"
                    >
                      {shipment.trackingNumber}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <p className="text-sm font-medium tabular text-foreground">{shipment.trackingNumber}</p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">Not yet assigned</p>
                )}
              </div>
              <Field
                icon={ShieldAlert}
                label="Customs status"
                valueNode={
                  shipment.customsStatus ? (
                    <StatusBadge kind="customsStatus" value={shipment.customsStatus} />
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )
                }
              />
            </CardContent>
          </Card>

          {/* Package details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Package details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field icon={Boxes} label="Packages" value={shipment.packageCount != null ? String(shipment.packageCount) : '—'} />
              <Field icon={Weight} label="Weight" value={shipment.weightKg != null ? `${shipment.weightKg} kg` : '—'} />
              <Field icon={Package} label="Dimensions" value={shipment.dimensions ?? '—'} />
              <Field
                icon={FileText}
                label="Incoterm"
                valueNode={shipment.incoterm ? <Badge variant="info">{getLabel('incoterm', shipment.incoterm)}</Badge> : <span className="text-sm text-muted-foreground">—</span>}
              />
              <Field
                icon={ShieldAlert}
                label="Customs"
                valueNode={shipment.customsStatus ? <StatusBadge kind="customsStatus" value={shipment.customsStatus} /> : <span className="text-sm text-muted-foreground">—</span>}
              />
              <Field icon={MapPin} label="EORI / import" value={shipment.eoriImportInfo ?? '—'} />
            </CardContent>
          </Card>

          {/* Document checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                Document checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {CHECKLIST_ITEMS.map((item) => {
                const id = `chk-${item}`;
                return (
                  <div key={item} className="flex items-center gap-3">
                    <Checkbox
                      id={id}
                      checked={!!checked[item]}
                      onCheckedChange={(v) => {
                        const next = v === true;
                        setChecked((prev) => ({ ...prev, [item]: next }));
                        toast({
                          variant: next ? 'success' : 'info',
                          title: next ? 'Document checked' : 'Document unchecked',
                          description: item,
                        });
                      }}
                    />
                    <Label
                      htmlFor={id}
                      className={cn('cursor-pointer text-sm', checked[item] ? 'text-foreground' : 'text-muted-foreground')}
                    >
                      {item}
                    </Label>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Recipient & address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recipient &amp; address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium text-foreground">{shipment.recipient}</p>
              <div className="space-y-0.5 text-muted-foreground">
                {shipment.address.line1 && shipment.address.line1 !== '—' ? <p>{shipment.address.line1}</p> : null}
                {shipment.address.line2 ? <p>{shipment.address.line2}</p> : null}
                <p>
                  {[shipment.address.postalCode, shipment.address.city].filter(Boolean).join(' ')}
                </p>
                <p className="flex items-center gap-1.5 text-foreground">
                  <span className="text-base leading-none">{flagEmoji(shipment.address.countryCode)}</span>
                  {shipment.address.country}
                </p>
              </div>
              <Separator />
              {shipment.phone ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {shipment.phone}
                </p>
              ) : null}
              {shipment.email ? (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {shipment.email}
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* Company card */}
          {company ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href={'/admin/companies/' + company.id}
                  className="flex items-center gap-3 rounded-md p-1 -m-1 hover:bg-muted/60"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: company.accentColor || '#0a1628' }}
                  >
                    {company.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{company.tradingName || company.legalName}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />
                      {getLabel('companyType', company.type)}
                    </p>
                  </div>
                  <ExternalLink className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {/* Related sample */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Related sample</CardTitle>
            </CardHeader>
            <CardContent>
              {sample ? (
                <Link
                  href={'/admin/samples/' + sample.id}
                  className="block space-y-2 rounded-md border p-3 transition-colors hover:border-brand-teal/50 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-brand-teal">{sample.reference}</p>
                    <StatusBadge kind="sampleStatus" value={sample.status} />
                  </div>
                  <p className="text-sm text-foreground">{sample.requestedProduct}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{getLabel('applicationCategory', sample.applicationCategory)}</span>
                    <span>
                      {formatQuantity(sample.approvedQuantity ?? sample.requestedQuantity, getLabel('quantityUnit', sample.unit))}
                    </span>
                  </div>
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">No linked sample request.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <IssueDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        reference={shipment.reference}
        currentIssue={shipment.deliveryIssue}
        onReported={(issue) => applyPatch({ deliveryIssue: issue, isDelayed: true })}
      />

      <TrackingDialog open={trackingOpen} onOpenChange={setTrackingOpen} reference={shipment.reference} />
    </div>
  );
}

/* ────────────────────────────── Small presentational helpers ────────────────────────────── */

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-sm font-medium text-foreground', valueClass)}>{value}</p>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  valueNode,
}: {
  icon: typeof Truck;
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      {valueNode ?? <p className="text-sm font-medium text-foreground">{value}</p>}
    </div>
  );
}

/* ────────────────────────────── Issue dialog ────────────────────────────── */

function IssueDialog({
  open,
  onOpenChange,
  reference,
  currentIssue,
  onReported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
  currentIssue?: string;
  onReported: (issue: string) => void;
}) {
  const [issue, setIssue] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) setIssue(currentIssue ?? '');
  }, [open, currentIssue]);

  async function submit() {
    if (!issue.trim() || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    onReported(issue.trim());
    setSubmitting(false);
    toast({ variant: 'warning', title: 'Issue reported', description: `Logged against ${reference}.` });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report issue</DialogTitle>
          <DialogDescription>{reference}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="detailIssue">Describe the issue</Label>
          <Textarea
            id="detailIssue"
            rows={4}
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Held at customs, missing CN23 declaration…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={!issue.trim() || submitting}>
            {submitting ? 'Reporting…' : 'Report issue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Tracking dialog ────────────────────────────── */

function TrackingDialog({
  open,
  onOpenChange,
  reference,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reference: string;
}) {
  const [note, setNote] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) setNote('');
  }, [open]);

  async function submit() {
    if (!note.trim() || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 400));
    setSubmitting(false);
    toast({ variant: 'info', title: 'Tracking updated', description: `Update posted to ${reference}.` });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add tracking update</DialogTitle>
          <DialogDescription>{reference}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="detailTrack">Update</Label>
          <Textarea
            id="detailTrack"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Arrived at sorting hub, Paris CDG…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!note.trim() || submitting}>
            {submitting ? 'Posting…' : 'Post update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
