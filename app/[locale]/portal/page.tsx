'use client';

import * as React from 'react';
import {
  FileSignature,
  FlaskConical,
  Truck,
  FileText,
  MessageSquareHeart,
  BellRing,
  Mail,
  PackageCheck,
  ClipboardCheck,
  ArrowRight,
  CalendarClock,
  LifeBuoy,
  Sparkles,
  ChevronRight,
  Activity as ActivityIcon,
  MessageSquarePlus,
  Headphones,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
} from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import {
  companyService,
  sampleService,
  shipmentService,
  ndaService,
  documentService,
  feedbackService,
  meetingService,
  activityService,
  supportService,
  notificationService,
  contactService,
} from '@/lib/mock-services';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import type {
  Company,
  SampleRequest,
  Shipment,
  NDA,
  DocumentRecord,
  Feedback,
  Meeting,
  Activity,
  SupportRequest,
  AppNotification,
  SampleStatus,
} from '@/lib/types';
import { can } from '@/lib/permissions';
import { getLabel } from '@/lib/labels';
import { formatDate, formatDateTime, formatRelative, formatQuantity } from '@/lib/formatting';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Stagger, StaggerItem } from '@/components/shared/motion';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const NOW = new Date();

/** Sample statuses that are no longer "active" (the request is finished). */
const SAMPLE_CLOSED: SampleStatus[] = ['delivered', 'receipt_confirmed', 'closed', 'cancelled', 'feedback_received', 'rejected'];
/** Sample statuses where the client still needs to act. */
const NEEDS_RECEIPT: SampleStatus[] = ['delivered'];
const NEEDS_FEEDBACK: SampleStatus[] = ['receipt_confirmed', 'testing', 'feedback_requested'];

interface DashboardData {
  company: Company;
  samples: SampleRequest[];
  shipments: Shipment[];
  ndas: NDA[];
  documents: DocumentRecord[];
  feedback: Feedback[];
  meetings: Meeting[];
  activities: Activity[];
  support: SupportRequest[];
  notifications: AppNotification[];
  contactCount: number;
}

export default function PortalDashboard() {
  const { account, session, ready } = useSession();
  const { get: getStaff } = useStaffDirectory();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const companyId = session?.companyId;
  const role = session?.role;

  React.useEffect(() => {
    if (!ready) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    (async () => {
      const company = await companyService.get(companyId);
      if (!company) {
        if (active) {
          setData(null);
          setLoading(false);
        }
        return;
      }
      const ndaSigned = company.ndaStatus === 'fully_signed';
      const [samples, shipments, ndas, documents, feedback, upcomingMeetings, activities, support, notifications, contacts] =
        await Promise.all([
          sampleService.byCompany(companyId),
          shipmentService.byCompany(companyId),
          ndaService.byCompany(companyId),
          documentService.forPortal(companyId, ndaSigned),
          feedbackService.byCompany(companyId),
          meetingService.upcoming(NOW),
          activityService.forPortal(companyId),
          supportService.byCompany(companyId),
          notificationService.forAudience({ workspace: 'external', companyId }),
          contactService.byCompany(companyId),
        ]);

      if (!active) return;
      setData({
        company,
        samples,
        shipments,
        ndas,
        documents,
        feedback,
        meetings: upcomingMeetings.filter((m) => m.companyId === companyId),
        activities,
        support,
        notifications,
        contactCount: contacts.length,
      });
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [ready, companyId]);

  if (!ready || loading) return <DashboardSkeleton />;

  if (!companyId || !data) {
    return (
      <div className="space-y-6">
        <EmptyState
          icon={Sparkles}
          title="No company linked to your account"
          description="Your portal access is not yet connected to a company workspace. Please contact your Italprotein account manager to get set up."
        />
      </div>
    );
  }

  const { company, samples, shipments, documents, feedback, meetings, activities, support } = data;
  const owner = getStaff(company.accountOwnerId);

  /* ── Derived metrics ── */
  const activeSamples = samples.filter((s) => !SAMPLE_CLOSED.includes(s.status));
  const inTransit = shipments.filter((s) => shipmentService.deriveStatus(s) === 'in_transit' || shipmentService.deriveStatus(s) === 'customs');
  const openFeedback = feedback.filter((f) => f.status !== 'resolved');
  const openSupport = support.filter((r) => r.status === 'open' || r.status === 'in_progress' || r.status === 'waiting_on_client');

  /* ── Pending actions ── */
  const pendingActions = buildPendingActions(samples, feedback);

  /* ── Latest shipment ── */
  const latestShipment = [...shipments].sort(
    (a, b) => new Date(b.shipmentDate ?? b.createdAt).getTime() - new Date(a.shipmentDate ?? a.createdAt).getTime(),
  )[0];

  /* ── Profile completion ── */
  const profile = computeProfileCompletion(company, data.contactCount);

  const canEdit = role ? can(role, 'portal.edit_company') : false;
  const canRequestSample = role ? can(role, 'portal.request_sample') : false;
  const canSubmitFeedback = role ? can(role, 'portal.submit_feedback') : false;

  const quickActions = [
    { label: 'Request a sample', icon: FlaskConical, href: '/portal/samples/new', enabled: canRequestSample, tone: 'gold' as const },
    { label: 'Submit feedback', icon: MessageSquarePlus, href: '/portal/feedback/new', enabled: canSubmitFeedback, tone: 'default' as const },
    { label: 'View documents', icon: FileText, href: '/portal/documents', enabled: true, tone: 'default' as const },
    { label: 'Contact support', icon: Headphones, href: '/portal/requests', enabled: true, tone: 'default' as const },
  ];

  return (
    <Stagger className="space-y-6">
      {/* 1 ── Welcome header */}
      <StaggerItem>
        <PageHeader
          title={`Welcome back, ${account?.firstName ?? 'there'}`}
          subtitle={`Here's what's happening with ${company.tradingName ?? company.legalName} and Italprotein.`}
          actions={
            owner ? (
              <a
                href={`mailto:${owner.email}`}
                className="group inline-flex items-center gap-3 rounded-full border bg-card py-1.5 pl-1.5 pr-4 shadow-sm transition-colors hover:border-brand-gold/60"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-navy/5 text-sm font-semibold text-brand-navy">
                  {owner.firstName.charAt(0)}
                  {owner.lastName.charAt(0)}
                </span>
                <span className="flex flex-col text-left leading-tight">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Your contact</span>
                  <span className="text-sm font-semibold">{owner.firstName} {owner.lastName}</span>
                </span>
                <Mail className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-brand-goldDark" />
              </a>
            ) : undefined
          }
        />
      </StaggerItem>

      {/* 2 ── Stat cards */}
      <StaggerItem>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="NDA status"
            value={getLabel('ndaStatus', company.ndaStatus)}
            icon={FileSignature}
            tone={company.ndaStatus === 'fully_signed' ? 'success' : 'warning'}
            hint={company.ndaStatus === 'fully_signed' ? 'Full document access unlocked' : 'Limited document access'}
            delay={0}
          />
          <StatCard
            label="Active sample requests"
            value={activeSamples.length}
            icon={FlaskConical}
            tone="info"
            hint={`${samples.length} total to date`}
            href="/portal/samples"
            delay={0.04}
          />
          <StatCard
            label="Shipments in transit"
            value={inTransit.length}
            icon={Truck}
            tone="gold"
            hint={`${shipments.length} shipments overall`}
            href="/portal/samples"
            delay={0.08}
          />
          <StatCard
            label="Documents available"
            value={documents.length}
            icon={FileText}
            tone="default"
            hint="Shared with your company"
            href="/portal/documents"
            delay={0.12}
          />
          <StatCard
            label="Open feedback"
            value={openFeedback.length}
            icon={MessageSquareHeart}
            tone="info"
            hint={`${feedback.length} reports submitted`}
            href="/portal/feedback"
            delay={0.16}
          />
          <StatCard
            label="Pending actions"
            value={pendingActions.length}
            icon={BellRing}
            tone={pendingActions.length > 0 ? 'warning' : 'success'}
            hint={pendingActions.length > 0 ? 'Items waiting on you' : 'You are all caught up'}
            delay={0.2}
          />
          <StatCard
            label="Open requests"
            value={openSupport.length}
            icon={LifeBuoy}
            tone={openSupport.length > 0 ? 'warning' : 'success'}
            hint="Support conversations"
            href="/portal/requests"
            delay={0.24}
          />
          <StatCard
            label="Upcoming calls"
            value={meetings.length}
            icon={CalendarClock}
            tone="info"
            hint={meetings[0] ? `Next ${formatRelative(meetings[0].start, 'en', NOW)}` : 'None scheduled'}
            delay={0.28}
          />
        </div>
      </StaggerItem>

      {/* 3 + 4 ── Profile completion & Pending actions */}
      <StaggerItem>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Profile completion */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Profile completion</CardTitle>
                  <CardDescription>A complete profile helps us serve you faster.</CardDescription>
                </div>
                <span className="text-2xl font-bold tabular text-brand-goldDark">{profile.percent}%</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={profile.percent} />
              <ul className="grid gap-2 sm:grid-cols-2">
                {profile.items.map((item) => (
                  <li key={item.label} className="flex items-center gap-2 text-sm">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={item.done ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant={profile.percent === 100 ? 'outline' : 'gold'} className="w-full sm:w-auto">
                <Link href="/portal/profile">
                  {profile.percent === 100 ? 'Review your profile' : 'Complete your profile'}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              {!canEdit && (
                <p className="text-xs text-muted-foreground">
                  You have read-only access to the company profile. Ask a company owner to make changes.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pending actions */}
          <Card>
            <CardHeader>
              <CardTitle>Pending actions</CardTitle>
              <CardDescription>Items that need your attention right now.</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingActions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-subtle text-success">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium">You are all caught up</p>
                  <p className="text-xs text-muted-foreground">No actions are waiting on your team.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {pendingActions.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={a.href}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-brand-gold/60 hover:bg-accent/50"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${a.iconClass}`}>
                          <a.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{a.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{a.subtitle}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </StaggerItem>

      {/* 5 ── Active samples & Latest shipment */}
      <StaggerItem>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Active sample requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Active sample requests</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/portal/samples">View all <ArrowRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {activeSamples.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No active sample requests"
                  description="Request a sample to start evaluating Proamina in your application."
                  action={
                    canRequestSample ? (
                      <Button asChild variant="gold" size="sm">
                        <Link href="/portal/samples/new">Request a sample</Link>
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {activeSamples.slice(0, 4).map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/portal/samples/${s.id}`}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-brand-gold/60 hover:bg-accent/50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{s.requestedProduct}</span>
                            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{s.reference}</Badge>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {getLabel('applicationCategory', s.applicationCategory)} ·{' '}
                            {formatQuantity(s.approvedQuantity ?? s.requestedQuantity, getLabel('quantityUnit', s.unit))}
                          </span>
                        </span>
                        <StatusBadge kind="sampleStatus" value={s.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Latest shipment tracking */}
          <Card>
            <CardHeader>
              <CardTitle>Latest shipment tracking</CardTitle>
              <CardDescription>Follow your most recent delivery.</CardDescription>
            </CardHeader>
            <CardContent>
              {latestShipment ? (
                <ShipmentTracker shipment={latestShipment} />
              ) : (
                <EmptyState
                  icon={Truck}
                  title="No shipments yet"
                  description="Once a sample is dispatched, you'll be able to track it here in real time."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </StaggerItem>

      {/* 6 ── Activity, Meetings, Documents, Support */}
      <StaggerItem>
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Recent activity */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>The latest updates on your account.</CardDescription>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <EmptyState icon={ActivityIcon} title="No activity yet" description="Updates on samples, shipments and feedback will appear here." />
              ) : (
                <ol className="relative space-y-5 pl-6">
                  <span className="absolute left-[7px] top-1 bottom-1 w-px bg-border" aria-hidden />
                  {activities.slice(0, 6).map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-6 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-card bg-brand-gold" aria-hidden />
                      <p className="text-sm font-medium leading-tight">{a.title}</p>
                      {a.body && <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>}
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {getLabel('activityType', a.type)} · {formatRelative(a.at, 'en', NOW)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Right column: meetings + support */}
          <div className="space-y-4">
            {/* Upcoming calls / meetings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarClock className="h-4 w-4 text-info" /> Upcoming calls
                </CardTitle>
              </CardHeader>
              <CardContent>
                {meetings.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No calls scheduled. Your account manager will reach out to arrange the next one.</p>
                ) : (
                  <ul className="space-y-3">
                    {meetings.slice(0, 3).map((m) => (
                      <li key={m.id} className="flex gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-info-subtle text-info">
                          <CalendarClock className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{m.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {formatDateTime(m.start)} · {getLabel('meetingType', m.type)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Support */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <LifeBuoy className="h-4 w-4 text-brand-goldDark" /> Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {openSupport.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open requests. Need a hand? We&apos;re here to help.</p>
                ) : (
                  <ul className="space-y-2">
                    {openSupport.slice(0, 3).map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{r.subject}</span>
                          <span className="block text-xs text-muted-foreground">{r.reference}</span>
                        </span>
                        <StatusBadge kind="supportStatus" value={r.status} />
                      </li>
                    ))}
                  </ul>
                )}
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/portal/requests">
                    <MessageSquarePlus className="h-4 w-4" /> Contact us
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </StaggerItem>

      {/* Documents quick list */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>The newest files shared with your company.</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/portal/documents">All documents <ArrowRight className="h-4 w-4" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents available yet"
                description={
                  company.ndaStatus === 'fully_signed'
                    ? 'New technical and commercial files will appear here as they are shared.'
                    : 'Once your NDA is fully signed, technical and commercial documents will unlock here.'
                }
              />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {[...documents]
                  .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
                  .slice(0, 4)
                  .map((d) => (
                    <li key={d.id}>
                      <Link
                        href="/portal/documents"
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-brand-gold/60 hover:bg-accent/50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{d.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {getLabel('documentCategory', d.category)} · {d.fileType.toUpperCase()} · {formatDate(d.uploadedAt)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {/* Quick-action buttons row */}
      <StaggerItem>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((a) =>
              a.enabled ? (
                <Button
                  key={a.label}
                  asChild
                  variant={a.tone === 'gold' ? 'gold' : 'outline'}
                  className="h-auto justify-start gap-3 py-3"
                >
                  <Link href={a.href}>
                    <a.icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{a.label}</span>
                  </Link>
                </Button>
              ) : (
                <Button
                  key={a.label}
                  variant="outline"
                  disabled
                  title="Your role does not have permission for this action"
                  className="h-auto justify-start gap-3 py-3"
                >
                  <a.icon className="h-4 w-4" />
                  <span className="text-sm font-medium">{a.label}</span>
                </Button>
              ),
            )}
          </CardContent>
        </Card>
      </StaggerItem>
    </Stagger>
  );
}

/* ────────────────────────────── Helpers ────────────────────────────── */

interface PendingAction {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  icon: typeof PackageCheck;
  iconClass: string;
}

function buildPendingActions(samples: SampleRequest[], feedback: Feedback[]): PendingAction[] {
  const actions: PendingAction[] = [];

  for (const s of samples) {
    if (NEEDS_RECEIPT.includes(s.status)) {
      actions.push({
        id: `receipt-${s.id}`,
        title: `Confirm receipt of ${s.requestedProduct}`,
        subtitle: `${s.reference} · marked delivered`,
        href: `/portal/samples/${s.id}`,
        icon: PackageCheck,
        iconClass: 'bg-success-subtle text-success',
      });
    } else if (NEEDS_FEEDBACK.includes(s.status)) {
      actions.push({
        id: `feedback-${s.id}`,
        title: `Submit feedback for ${s.requestedProduct}`,
        subtitle: `${s.reference} · ${getLabel('sampleStatus', s.status)}`,
        href: '/portal/feedback/new',
        icon: ClipboardCheck,
        iconClass: 'bg-warning-subtle text-warning-foreground',
      });
    }
  }

  for (const f of feedback) {
    if (f.status === 'additional_info_requested') {
      actions.push({
        id: `fb-info-${f.id}`,
        title: 'Additional information requested',
        subtitle: `${f.reference} · our technical team has a question`,
        href: '/portal/feedback',
        icon: MessageSquareHeart,
        iconClass: 'bg-info-subtle text-info',
      });
    }
  }

  return actions;
}

interface ProfileItem {
  label: string;
  done: boolean;
}

function computeProfileCompletion(company: Company, contactCount: number): { percent: number; items: ProfileItem[] } {
  const items: ProfileItem[] = [
    { label: 'Website', done: !!company.website },
    { label: 'VAT number', done: !!company.vatNumber },
    { label: 'Billing address', done: !!company.billingAddress },
    { label: 'Shipping address', done: !!(company.shippingAddresses && company.shippingAddresses.length > 0) },
    { label: 'Application interests', done: !!(company.applicationInterests && company.applicationInterests.length > 0) },
    { label: 'Team contacts', done: contactCount > 0 },
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}

/* ── Shipment mini timeline ── */
const SHIPMENT_STEPS: { key: ReturnType<typeof shipmentService.deriveStatus>; label: string }[] = [
  { key: 'preparing', label: 'Preparing' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'customs', label: 'Customs' },
  { key: 'delivered', label: 'Delivered' },
];

function ShipmentTracker({ shipment }: { shipment: Shipment }) {
  const status = shipmentService.deriveStatus(shipment);
  const activeIndex = SHIPMENT_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-goldDark">
            <Package className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">{shipment.reference}</p>
            <p className="text-xs text-muted-foreground">{shipment.courier ?? 'Courier to be confirmed'}</p>
          </div>
        </div>
        {shipment.isDelayed && !shipment.actualDelivery ? (
          <Badge variant="warning">Delayed</Badge>
        ) : (
          <Badge variant="info">{SHIPMENT_STEPS[activeIndex]?.label ?? 'Preparing'}</Badge>
        )}
      </div>

      {/* Progress timeline */}
      <div className="flex items-center">
        {SHIPMENT_STEPS.map((step, i) => {
          const reached = i <= activeIndex;
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
                    reached ? 'border-brand-gold bg-brand-gold text-brand-navy' : 'border-border bg-muted text-muted-foreground'
                  }`}
                >
                  {i < activeIndex || (status === 'delivered' && i === activeIndex) ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={`text-[10px] ${reached ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
              </div>
              {i < SHIPMENT_STEPS.length - 1 && (
                <span className={`mx-1 h-0.5 flex-1 rounded-full ${i < activeIndex ? 'bg-brand-gold' : 'bg-border'}`} aria-hidden />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <Separator />

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Destination</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {shipment.address.city}, {shipment.address.country}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{shipment.actualDelivery ? 'Delivered' : 'Estimated delivery'}</dt>
          <dd className="font-medium">{formatDate(shipment.actualDelivery ?? shipment.estimatedDelivery)}</dd>
        </div>
      </dl>

      {shipment.trackingUrl && shipment.trackingNumber ? (
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer">
            <Truck className="h-4 w-4" /> Track {shipment.trackingNumber}
          </a>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">A tracking link will appear here once the parcel is dispatched.</p>
      )}
    </div>
  );
}

/* ── Loading skeleton ── */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-12 w-48 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
