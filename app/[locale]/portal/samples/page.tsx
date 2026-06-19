'use client';

import * as React from 'react';
import {
  FlaskConical,
  Plus,
  Truck,
  PackageCheck,
  Loader2,
  MessageSquarePlus,
  XCircle,
  Inbox,
} from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { sampleService, shipmentService } from '@/lib/mock-services';
import type { SampleRequest, Shipment, SampleStatus } from '@/lib/types';
import { can } from '@/lib/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type Column } from '@/components/ui/data-table';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { formatDate, formatQuantity } from '@/lib/formatting';
import { getLabel } from '@/lib/labels';

const NOW = new Date('2026-06-17T12:00:00Z');

/** Buckets a sample status into a coarse lifecycle group for the stat cards. */
const IN_PROGRESS: SampleStatus[] = [
  'submitted',
  'under_review',
  'more_info_required',
  'approved',
  'preparing',
  'ready_to_ship',
  'shipped',
  'in_transit',
  'customs_hold',
  'delivery_attempted',
];
const DELIVERED: SampleStatus[] = ['delivered', 'receipt_confirmed'];
const AWAITING_FEEDBACK: SampleStatus[] = ['testing', 'feedback_requested'];
const CANCELLABLE: SampleStatus[] = ['submitted', 'under_review'];

export default function PortalSamplesPage() {
  const { session, ready } = useSession();
  const router = useRouter();
  const companyId = session?.companyId;
  const role = session?.role;

  const [samples, setSamples] = React.useState<SampleRequest[]>([]);
  const [shipmentBySample, setShipmentBySample] = React.useState<Record<string, Shipment>>({});
  const [loading, setLoading] = React.useState(true);
  const [cancelTarget, setCancelTarget] = React.useState<SampleRequest | null>(null);

  const canRequest = role ? can(role, 'portal.request_sample') : false;

  React.useEffect(() => {
    if (!ready) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      sampleService.byCompany(companyId),
      shipmentService.byCompany(companyId),
    ]).then(([sr, shp]) => {
      if (!active) return;
      const map: Record<string, Shipment> = {};
      for (const s of shp) map[s.sampleRequestId] = s;
      // Newest requests first.
      const ordered = [...sr].sort(
        (a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime(),
      );
      setSamples(ordered);
      setShipmentBySample(map);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [ready, companyId]);

  const stats = React.useMemo(() => {
    const inSet = (set: SampleStatus[]) => samples.filter((s) => set.includes(s.status)).length;
    return {
      total: samples.length,
      inProgress: inSet(IN_PROGRESS),
      delivered: inSet(DELIVERED),
      awaitingFeedback: inSet(AWAITING_FEEDBACK),
    };
  }, [samples]);

  async function handleCancel(sample: SampleRequest) {
    await new Promise((r) => setTimeout(r, 500));
    const at = NOW.toISOString();
    await sampleService.update(sample.id, {
      status: 'cancelled',
      statusHistory: [
        ...sample.statusHistory,
        { status: 'cancelled', at, note: 'Cancelled by the company via the portal.' },
      ],
    });
    setSamples((prev) =>
      prev.map((s) =>
        s.id === sample.id
          ? {
              ...s,
              status: 'cancelled',
              statusHistory: [
                ...s.statusHistory,
                { status: 'cancelled', at, note: 'Cancelled by the company via the portal.' },
              ],
            }
          : s,
      ),
    );
    toast({
      title: 'Request cancelled',
      description: `${sample.reference} has been cancelled.`,
      variant: 'success',
    });
  }

  const columns: Column<SampleRequest>[] = [
    {
      key: 'reference',
      header: 'Reference',
      sortable: true,
      sortValue: (s) => s.reference,
      cell: (s) => <span className="font-medium text-foreground">{s.reference}</span>,
    },
    {
      key: 'product',
      header: 'Product',
      sortValue: (s) => s.requestedProduct,
      cell: (s) => <span className="line-clamp-1 max-w-[18rem]">{s.requestedProduct}</span>,
    },
    {
      key: 'application',
      header: 'Application',
      sortValue: (s) => getLabel('applicationCategory', s.applicationCategory),
      cell: (s) => <StatusBadge kind="applicationCategory" value={s.applicationCategory} />,
    },
    {
      key: 'quantity',
      header: 'Requested qty',
      align: 'right',
      sortValue: (s) => s.requestedQuantity,
      cell: (s) => (
        <span className="tabular">{formatQuantity(s.requestedQuantity, s.unit)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (s) => getLabel('sampleStatus', s.status),
      cell: (s) => <StatusBadge kind="sampleStatus" value={s.status} />,
    },
    {
      key: 'requestDate',
      header: 'Request date',
      align: 'right',
      sortable: true,
      sortValue: (s) => new Date(s.requestDate).getTime(),
      cell: (s) => <span className="tabular text-muted-foreground">{formatDate(s.requestDate)}</span>,
    },
  ];

  const rowActions = (s: SampleRequest) => {
    const shipment = shipmentBySample[s.id];
    return (
      <div className="flex items-center justify-end gap-1">
        {shipment ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            onClick={(e) => e.stopPropagation()}
            title="Track this shipment"
          >
            <Link href={`/portal/samples/${s.id}`}>
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Track</span>
            </Link>
          </Button>
        ) : null}
        {canRequest && CANCELLABLE.includes(s.status) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setCancelTarget(s);
            }}
            className="text-danger hover:text-danger"
            title="Cancel this request"
          >
            <XCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Cancel</span>
          </Button>
        ) : null}
      </div>
    );
  };

  const mobileCard = (s: SampleRequest) => {
    const shipment = shipmentBySample[s.id];
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{s.reference}</p>
              <p className="line-clamp-1 text-sm text-muted-foreground">{s.requestedProduct}</p>
            </div>
            <StatusBadge kind="sampleStatus" value={s.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge kind="applicationCategory" value={s.applicationCategory} />
            <PriorityBadge value={s.priority} />
            <span className="tabular text-muted-foreground">
              {formatQuantity(s.requestedQuantity, s.unit)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(s.requestDate)}</span>
            <div className="flex items-center gap-1">
              {shipment ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link href={`/portal/samples/${s.id}`}>
                    <Truck className="h-4 w-4" />
                    Track
                  </Link>
                </Button>
              ) : null}
              {canRequest && CANCELLABLE.includes(s.status) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCancelTarget(s);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Cancel
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!ready || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sample requests" subtitle="Track every sample we prepare for you." />
        <EmptyState
          icon={FlaskConical}
          title="No company linked to your account"
          description="We could not find a company for your portal account. Please contact your Italprotein account manager."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sample requests"
        subtitle="Track every sample we prepare, ship and test with you."
        actions={
          canRequest ? (
            <Button asChild variant="gold">
              <Link href="/portal/samples/new">
                <Plus className="h-4 w-4" />
                Request a sample
              </Link>
            </Button>
          ) : (
            <Button variant="gold" disabled title="Your role cannot request samples">
              <Plus className="h-4 w-4" />
              Request a sample
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total requests" value={stats.total} icon={FlaskConical} tone="default" delay={0} />
        <StatCard
          label="In progress"
          value={stats.inProgress}
          icon={Loader2}
          tone="info"
          hint="Submitted through shipping"
          delay={0.05}
        />
        <StatCard
          label="Delivered"
          value={stats.delivered}
          icon={PackageCheck}
          tone="success"
          delay={0.1}
        />
        <StatCard
          label="Awaiting your feedback"
          value={stats.awaitingFeedback}
          icon={MessageSquarePlus}
          tone="gold"
          hint="In testing or feedback requested"
          delay={0.15}
        />
      </div>

      {samples.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No sample requests yet"
          description="Request your first Proamina sample and we'll prepare it for your application trials."
          action={
            canRequest ? (
              <Button asChild variant="gold">
                <Link href="/portal/samples/new">
                  <Plus className="h-4 w-4" />
                  Request a sample
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable<SampleRequest>
          data={samples}
          columns={columns}
          getRowId={(s) => s.id}
          searchable
          searchPlaceholder="Search by reference or product…"
          searchValue={(s) =>
            `${s.reference} ${s.requestedProduct} ${getLabel('applicationCategory', s.applicationCategory)} ${getLabel('sampleStatus', s.status)}`
          }
          pageSize={10}
          rowActions={rowActions}
          onRowClick={(s) => router.push(`/portal/samples/${s.id}`)}
          mobileCard={mobileCard}
          exportFilename="sample-requests"
          storageKey="portal-samples"
          emptyTitle="No sample requests"
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        title="Cancel this sample request?"
        description={
          cancelTarget
            ? `Request ${cancelTarget.reference} will be cancelled. This cannot be undone, but you can always submit a new request.`
            : undefined
        }
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        variant="danger"
        onConfirm={() => {
          if (cancelTarget) void handleCancel(cancelTarget);
          setCancelTarget(null);
        }}
      />
    </div>
  );
}
