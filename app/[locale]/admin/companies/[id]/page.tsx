'use client';

import * as React from 'react';
import {
  ArrowLeft,
  Building2,
  FileSignature,
  FlaskConical,
  Truck,
  ListTodo,
  FolderOpen,
  TrendingUp,
  CalendarClock,
  Globe,
  Hash,
  User as UserIcon,
  Mail,
  Phone,
  Star,
  Plus,
  PenSquare,
  StickyNote,
  PackagePlus,
  ExternalLink,
  Download,
  Lock,
  Check,
  MessageSquareText,
  Activity as ActivityIcon,
  Handshake,
  PackageSearch,
  FileText,
  Receipt,
  Target,
} from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import {
  companyService,
  contactService,
  opportunityService,
  sampleService,
  shipmentService,
  ndaService,
  documentService,
  activityService,
  taskService,
  feedbackService,
  projectService,
  financeService,
  meetingService,
  deriveShipmentStatus,
  authService,
} from '@/lib/mock-services';
import type {
  Company,
  Contact,
  Opportunity,
  SampleRequest,
  Shipment,
  NDA,
  DocumentRecord,
  Activity,
  Task,
  Feedback,
  ApplicationProject,
  FinanceDocument,
  Meeting,
} from '@/lib/types';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FadeIn } from '@/components/shared/motion';
import { ChartCard, DonutChart, FunnelChartCard, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable } from '@/components/ui/data-table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';
import { getLabel } from '@/lib/labels';
import { cn, sleep } from '@/lib/utils';
import {
  formatCurrency,
  formatDate,
  formatRelative,
  formatQuantity,
  flagEmoji,
  daysUntil,
} from '@/lib/formatting';
import { JourneyTimeline, type JourneyStep } from '@/components/admin/company-profile/journey-timeline';
import { QuickActionDialog, type QuickField } from '@/components/admin/company-profile/quick-action-dialog';

/* ────────────────────────────── data bundle ────────────────────────────── */

interface ProfileData {
  contacts: Contact[];
  opportunities: Opportunity[];
  samples: SampleRequest[];
  shipments: Shipment[];
  ndas: NDA[];
  documents: DocumentRecord[];
  activities: Activity[];
  tasks: Task[];
  feedback: Feedback[];
  projects: ApplicationProject[];
  finance: FinanceDocument[];
  meetings: Meeting[];
}

const ACTIVE_TASK = (t: Task) => t.status !== 'done' && t.status !== 'cancelled';
const ownerName = (id?: string) => {
  if (!id) return 'Unassigned';
  const a = authService.getAccount(id);
  return a ? `${a.firstName} ${a.lastName}` : id;
};

/* ────────────────────────────── small helpers ────────────────────────────── */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children ?? '—'}</dd>
    </div>
  );
}

function Stars({ value }: { value?: number }) {
  const n = Math.round(value ?? 0);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn('h-4 w-4', i < n ? 'fill-brand-gold text-brand-gold' : 'text-muted-foreground/40')}
        />
      ))}
    </span>
  );
}

function TabHeading({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        {title}
        {count !== undefined && <Badge variant="muted">{count}</Badge>}
      </h2>
      {action}
    </div>
  );
}

/* ────────────────────────────── page ────────────────────────────── */

export default function CompanyProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { account } = useSession();
  const id = params.id;

  const [company, setCompany] = React.useState<Company | null>(null);
  const [data, setData] = React.useState<ProfileData | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const load = React.useCallback(async () => {
    const c = await companyService.get(id);
    if (!c) {
      setNotFound(true);
      return;
    }
    setCompany(c);
    const [
      contacts,
      opportunities,
      samples,
      shipments,
      ndas,
      documents,
      activities,
      tasks,
      feedback,
      projects,
      finance,
      meetings,
    ] = await Promise.all([
      contactService.byCompany(id),
      opportunityService.byCompany(id),
      sampleService.byCompany(id),
      shipmentService.byCompany(id),
      ndaService.byCompany(id),
      documentService.byCompany(id),
      activityService.byCompany(id),
      taskService.byCompany(id),
      feedbackService.byCompany(id),
      projectService.byCompany(id),
      financeService.byCompany(id),
      meetingService.byCompany(id),
    ]);
    setData({
      contacts,
      opportunities,
      samples,
      shipments,
      ndas,
      documents,
      activities,
      tasks,
      feedback,
      projects,
      finance,
      meetings,
    });
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* ── quick-action dialog state ── */
  type Action = 'activity' | 'task' | 'note' | 'sample' | 'contact' | null;
  const [action, setAction] = React.useState<Action>(null);

  /* ── NDA + task mutations ── */
  const [ndaConfirm, setNdaConfirm] = React.useState<{ nda: NDA; to: NDA['status']; label: string } | null>(null);

  if (notFound) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <EmptyState
          icon={Building2}
          title="Company not found"
          description="This company may have been removed or the link is incorrect."
          action={
            <Button asChild variant="outline">
              <Link href="/admin/companies">
                <ArrowLeft />
                Back to companies
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const loading = !company || !data;

  /* ── derived summary values (safe defaults while loading) ── */
  const latestSample = data?.samples
    .slice()
    .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime())[0];
  const latestShipment = data?.shipments
    .slice()
    .sort(
      (a, b) =>
        new Date(b.shipmentDate ?? b.createdAt).getTime() - new Date(a.shipmentDate ?? a.createdAt).getTime(),
    )[0];
  const openTasks = data?.tasks.filter(ACTIVE_TASK) ?? [];
  const sharedDocs = data?.documents.filter((d) => d.accessLevel !== 'internal').length ?? 0;
  const ndaSigned = company?.ndaStatus === 'fully_signed';

  /* ── mutations ── */
  const completeTask = async (task: Task) => {
    await sleep(400);
    await taskService.update(task.id, { status: 'done', completedAt: new Date().toISOString() });
    setData((d) => (d ? { ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, status: 'done' } : t)) } : d));
    toast({ title: 'Task completed', description: task.title, variant: 'success' });
  };

  const applyNdaStatus = async () => {
    if (!ndaConfirm) return;
    const { nda, to, label } = ndaConfirm;
    await sleep(400);
    const patch: Partial<NDA> =
      to === 'sent' ? { status: to, dateSent: new Date().toISOString().slice(0, 10) } : { status: to };
    await ndaService.update(nda.id, patch);
    setData((d) => (d ? { ...d, ndas: d.ndas.map((n) => (n.id === nda.id ? { ...n, ...patch } : n)) } : d));
    setNdaConfirm(null);
    toast({ title: `NDA marked ${label}`, description: nda.reference, variant: 'success' });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* back link */}
      <Link
        href="/admin/companies"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All companies
      </Link>

      {/* ── header card ── */}
      {loading || !company ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : (
        <FadeIn>
          <Card className="overflow-hidden">
            <div className="h-1.5 w-full" style={{ backgroundColor: company.accentColor ?? CHART_COLORS[0] }} />
            <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <span
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm"
                  style={{ backgroundColor: company.accentColor ?? CHART_COLORS[0] }}
                >
                  {company.initials}
                </span>
                <div className="min-w-0 space-y-2">
                  <div>
                    <h1 className="font-display text-2xl font-bold tracking-tight">{company.legalName}</h1>
                    {company.tradingName && company.tradingName !== company.legalName && (
                      <p className="text-sm text-muted-foreground">Trading as {company.tradingName}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-base">{flagEmoji(company.countryCode)}</span>
                      {company.city}, {company.country}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge kind="companyType" value={company.type} />
                    <StatusBadge kind="relationshipStage" value={company.relationshipStage} />
                    <PriorityBadge value={company.priority} />
                    {company.size && <StatusBadge kind="companySize" value={company.size} />}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5" />
                      {ownerName(company.accountOwnerId)}
                    </span>
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-info hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        Website
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {company.vatNumber && (
                      <span className="inline-flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" />
                        {company.vatNumber}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* quick actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setAction('activity')}>
                  <ActivityIcon />
                  Log activity
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('task')}>
                  <PenSquare />
                  Create task
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('note')}>
                  <StickyNote />
                  Add note
                </Button>
                <Button variant="gold" size="sm" onClick={() => setAction('sample')}>
                  <PackagePlus />
                  Request sample
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* ── summary cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading || !company ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[104px] rounded-lg" />)
        ) : (
          <>
            <StatCard
              label="NDA status"
              value={getLabel('ndaStatus', company.ndaStatus)}
              icon={FileSignature}
              tone={ndaSigned ? 'success' : 'warning'}
              hint={`${data!.ndas.length} agreement${data!.ndas.length === 1 ? '' : 's'} on file`}
            />
            <StatCard
              label="Latest sample"
              value={latestSample ? getLabel('sampleStatus', latestSample.status) : 'None'}
              icon={FlaskConical}
              tone="info"
              hint={latestSample?.reference}
            />
            <StatCard
              label="Last requested qty"
              value={
                latestSample
                  ? formatQuantity(latestSample.approvedQuantity ?? latestSample.requestedQuantity, latestSample.unit)
                  : '—'
              }
              icon={PackageSearch}
              tone="default"
              hint={latestSample?.requestedProduct}
            />
            <StatCard
              label="Latest shipment"
              value={latestShipment ? getLabel('sampleStatus', deriveShipmentStatus(latestShipment)) : 'None'}
              icon={Truck}
              tone={latestShipment && latestShipment.isDelayed ? 'danger' : 'info'}
              hint={latestShipment?.courier}
            />
            <StatCard
              label="Open tasks"
              value={openTasks.length}
              icon={ListTodo}
              tone={openTasks.some((t) => daysUntil(t.dueDate) != null && daysUntil(t.dueDate)! < 0) ? 'danger' : 'warning'}
              hint={`${data!.tasks.length} total`}
            />
            <StatCard
              label="Documents"
              value={data!.documents.length}
              icon={FolderOpen}
              tone="default"
              hint={`${sharedDocs} shared`}
            />
            <StatCard
              label="Opportunity value"
              value={company.opportunityValue ?? 0}
              icon={TrendingUp}
              tone="gold"
              format={(n) => formatCurrency(n, company.preferredCurrency, 'en', { compact: true })}
              hint={`${data!.opportunities.length} opportunit${data!.opportunities.length === 1 ? 'y' : 'ies'}`}
            />
            <StatCard
              label="Next action"
              value={company.nextAction?.label ?? 'No action set'}
              icon={CalendarClock}
              tone="warning"
              hint={company.nextAction?.dueDate ? `Due ${formatDate(company.nextAction.dueDate)}` : undefined}
            />
          </>
        )}
      </div>

      {/* ── charts ── */}
      {!loading && data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Relationship funnel"
            description="Progress of this company along the engagement journey"
            height={220}
            isEmpty={false}
          >
            <FunnelChartCard data={buildFunnel(company!)} height={220} />
          </ChartCard>
          <ChartCard
            title="Engagement mix"
            description="Records logged against this company"
            height={220}
            isEmpty={
              data.activities.length + data.samples.length + data.tasks.length + data.documents.length === 0
            }
          >
            <DonutChart data={buildEngagementMix(data)} height={220} centerLabel="records" />
          </ChartCard>
        </div>
      )}

      {/* ── tabs ── */}
      {loading || !company || !data ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <Tabs defaultValue="overview" className="w-full">
          <div className="overflow-x-auto pb-1">
            <TabsList className="w-max">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="nda">NDA</TabsTrigger>
              <TabsTrigger value="samples">Samples</TabsTrigger>
              <TabsTrigger value="shipments">Shipments</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="feedback">Feedback</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="commercial">Commercial</TabsTrigger>
              <TabsTrigger value="logistics">Logistics</TabsTrigger>
            </TabsList>
          </div>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">Engagement journey</CardTitle>
                </CardHeader>
                <CardContent>
                  <JourneyTimeline steps={buildJourney(company, data)} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Key facts</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    <Fact label="Markets served">
                      {company.marketsServed?.length ? company.marketsServed.join(', ') : '—'}
                    </Fact>
                    <Fact label="Cooperation model">
                      {company.cooperationModel ? getLabel('cooperationModel', company.cooperationModel) : '—'}
                    </Fact>
                    <div className="col-span-2">
                      <Fact label="Application interests">
                        {company.applicationInterests?.length ? (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {company.applicationInterests.map((a) => (
                              <Badge key={a} variant="secondary">
                                {a}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          '—'
                        )}
                      </Fact>
                    </div>
                    {company.productCategories?.length ? (
                      <div className="col-span-2">
                        <Fact label="Product categories">
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {company.productCategories.map((c) => (
                              <StatusBadge key={c} kind="applicationCategory" value={c} />
                            ))}
                          </div>
                        </Fact>
                      </div>
                    ) : null}
                    <Fact label="Estimated annual potential">
                      {formatCurrency(company.estimatedAnnualPotential, company.preferredCurrency)}
                    </Fact>
                    <Fact label="Lead score">{company.leadScore != null ? `${company.leadScore}/100` : '—'}</Fact>
                    <Fact label="First contact">
                      {formatDate(company.firstContact.date)} ·{' '}
                      {getLabel('firstContactChannel', company.firstContact.channel)}
                    </Fact>
                    <Fact label="Last activity">
                      {company.lastActivityAt ? formatRelative(company.lastActivityAt) : '—'}
                    </Fact>
                    {company.commercialNotes && (
                      <div className="col-span-2">
                        <Fact label="Commercial notes">{company.commercialNotes}</Fact>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── CONTACTS ── */}
          <TabsContent value="contacts">
            <TabHeading
              title="Contacts"
              count={data.contacts.length}
              action={
                <Button size="sm" onClick={() => setAction('contact')}>
                  <Plus />
                  Add contact
                </Button>
              }
            />
            {data.contacts.length === 0 ? (
              <EmptyState icon={UserIcon} title="No contacts yet" description="Add the first contact for this company." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.contacts.map((c) => (
                  <Card key={c.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium">
                            {c.firstName} {c.lastName}
                            {c.isPrimary && <Star className="h-3.5 w-3.5 fill-brand-gold text-brand-gold" />}
                          </p>
                          {c.jobTitle && <p className="truncate text-sm text-muted-foreground">{c.jobTitle}</p>}
                        </div>
                        {c.decisionRole && <StatusBadge kind="decisionRole" value={c.decisionRole} />}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {c.isTechnical && <Badge variant="info">Technical</Badge>}
                        {c.isCommercial && <Badge variant="gold">Commercial</Badge>}
                        {c.isLogistics && <Badge variant="secondary">Logistics</Badge>}
                        {c.isFinance && <Badge variant="muted">Finance</Badge>}
                        {c.isLegal && <Badge variant="outline">Legal</Badge>}
                      </div>
                      <Separator />
                      <div className="space-y-1.5 text-sm">
                        <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-info hover:underline">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </a>
                        {(c.phone || c.mobile) && (
                          <p className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {c.phone ?? c.mobile}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── NDA ── */}
          <TabsContent value="nda">
            <TabHeading title="Non-disclosure agreements" count={data.ndas.length} />
            {data.ndas.length === 0 ? (
              <EmptyState
                icon={FileSignature}
                title="No NDA on record"
                description="No non-disclosure agreement has been prepared for this company yet."
              />
            ) : (
              <div className="space-y-4">
                {data.ndas.map((n) => (
                  <Card key={n.id}>
                    <CardContent className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 font-semibold">
                            {n.reference}
                            <StatusBadge kind="ndaType" value={n.type} />
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Sent {formatDate(n.dateSent)}</span>
                            <span>Effective {formatDate(n.effectiveDate)}</span>
                            <span>Expires {formatDate(n.expiryDate)}</span>
                          </div>
                        </div>
                        <StatusBadge kind="ndaStatus" value={n.status} />
                      </div>

                      {n.versions.length > 0 && (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Versions
                          </p>
                          <ul className="space-y-1 text-sm">
                            {n.versions.map((v) => (
                              <li key={v.version} className="flex items-center justify-between gap-2">
                                <span className="font-medium">v{v.version}</span>
                                <span className="text-muted-foreground">{formatDate(v.date)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={n.status === 'fully_signed'}
                          onClick={() => setNdaConfirm({ nda: n, to: 'sent', label: 'sent' })}
                        >
                          Mark sent
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          disabled={n.status === 'fully_signed'}
                          onClick={() => setNdaConfirm({ nda: n, to: 'fully_signed', label: 'signed' })}
                        >
                          <Check />
                          Mark signed
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── SAMPLES ── */}
          <TabsContent value="samples">
            <TabHeading
              title="Sample requests"
              count={data.samples.length}
              action={
                <Button size="sm" variant="gold" onClick={() => setAction('sample')}>
                  <PackagePlus />
                  Request sample
                </Button>
              }
            />
            <DataTable<SampleRequest>
              data={data.samples}
              getRowId={(s) => s.id}
              onRowClick={(s) => router.push('/admin/samples/' + s.id)}
              searchable
              searchPlaceholder="Search samples…"
              emptyTitle="No samples yet"
              emptyDescription="Sample requests for this company will appear here."
              columns={[
                { key: 'reference', header: 'Reference', sortable: true, cell: (s) => <span className="font-medium">{s.reference}</span> },
                {
                  key: 'product',
                  header: 'Product',
                  cell: (s) => (
                    <div>
                      <p className="truncate">{s.requestedProduct}</p>
                      <p className="text-xs text-muted-foreground">{getLabel('applicationCategory', s.applicationCategory)}</p>
                    </div>
                  ),
                },
                {
                  key: 'qty',
                  header: 'Qty',
                  align: 'right',
                  sortValue: (s) => s.approvedQuantity ?? s.requestedQuantity,
                  cell: (s) => formatQuantity(s.approvedQuantity ?? s.requestedQuantity, s.unit),
                },
                { key: 'status', header: 'Status', cell: (s) => <StatusBadge kind="sampleStatus" value={s.status} /> },
                { key: 'priority', header: 'Priority', cell: (s) => <PriorityBadge value={s.priority} /> },
                {
                  key: 'requestDate',
                  header: 'Requested',
                  sortable: true,
                  sortValue: (s) => s.requestDate,
                  cell: (s) => formatDate(s.requestDate),
                },
              ]}
            />
          </TabsContent>

          {/* ── SHIPMENTS ── */}
          <TabsContent value="shipments">
            <TabHeading title="Shipments" count={data.shipments.length} />
            {data.shipments.length === 0 ? (
              <EmptyState icon={Truck} title="No shipments yet" description="Sample shipments will appear here once dispatched." />
            ) : (
              <div className="space-y-3">
                {data.shipments.map((s) => {
                  const st = deriveShipmentStatus(s);
                  return (
                    <Card key={s.id}>
                      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
                        <div className="min-w-0 space-y-1">
                          <p className="flex items-center gap-2 font-medium">
                            {s.reference}
                            <StatusBadge kind="sampleStatus" value={st} />
                            {s.isDelayed && !s.actualDelivery && <Badge variant="danger">Delayed</Badge>}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {s.courier ?? 'Courier TBD'}
                            {s.service ? ` · ${s.service}` : ''} → {s.address.city}, {s.address.country}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>Shipped {formatDate(s.shipmentDate)}</span>
                            <span>ETA {formatDate(s.estimatedDelivery)}</span>
                            {s.actualDelivery && <span>Delivered {formatDate(s.actualDelivery)}</span>}
                            {s.customsStatus && (
                              <span className="inline-flex items-center gap-1">
                                Customs: <StatusBadge kind="customsStatus" value={s.customsStatus} />
                              </span>
                            )}
                          </div>
                        </div>
                        {s.trackingNumber && (
                          <Button asChild variant="outline" size="sm" disabled={!s.trackingUrl}>
                            {s.trackingUrl ? (
                              <a href={s.trackingUrl} target="_blank" rel="noreferrer">
                                <Truck />
                                Track {s.trackingNumber}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span>
                                <Truck />
                                {s.trackingNumber}
                              </span>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── DOCUMENTS ── */}
          <TabsContent value="documents">
            <TabHeading title="Documents" count={data.documents.length} />
            {!ndaSigned && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/40 bg-warning-subtle/50 p-3 text-sm text-warning-foreground">
                <Lock className="h-4 w-4 shrink-0" />
                Post-NDA documents are locked until the NDA is fully signed.
              </div>
            )}
            {data.documents.length === 0 ? (
              <EmptyState icon={FolderOpen} title="No documents" description="Company-specific documents will appear here." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.documents.map((doc) => {
                  const locked = (doc.accessLevel === 'post_nda' || doc.accessLevel === 'company_specific') && !ndaSigned;
                  return (
                    <Card key={doc.id} className={cn(locked && 'opacity-70')}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            {locked ? <Lock className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </span>
                          <StatusBadge kind="documentAccessLevel" value={doc.accessLevel} />
                        </div>
                        <div>
                          <p className="truncate text-sm font-medium" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {doc.fileType.toUpperCase()}
                            {doc.sizeKb ? ` · ${(doc.sizeKb / 1024).toFixed(1)} MB` : ''} · {formatDate(doc.uploadedAt)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge kind="documentCategory" value={doc.category} />
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={locked}
                            onClick={() =>
                              toast({
                                title: 'Download started',
                                description: doc.name,
                                variant: 'info',
                              })
                            }
                          >
                            <Download />
                            {locked ? 'Locked' : 'Download'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── ACTIVITIES ── */}
          <TabsContent value="activities">
            <TabHeading
              title="Activity timeline"
              count={data.activities.length}
              action={
                <Button size="sm" variant="outline" onClick={() => setAction('activity')}>
                  <Plus />
                  Log activity
                </Button>
              }
            />
            {data.activities.length === 0 ? (
              <EmptyState icon={ActivityIcon} title="No activity logged" description="Calls, emails and notes will appear here." />
            ) : (
              <Card>
                <CardContent className="p-5">
                  <ol className="space-y-0">
                    {data.activities.map((a, i) => (
                      <li key={a.id} className="relative flex gap-4 pb-5 last:pb-0">
                        {i !== data.activities.length - 1 && (
                          <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-1.25rem)] w-px bg-border" />
                        )}
                        <span className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <ActivityIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium">{a.title}</p>
                            <span className="text-xs tabular text-muted-foreground">{formatRelative(a.at)}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <StatusBadge kind="activityType" value={a.type} />
                            <span className="text-xs text-muted-foreground">{ownerName(a.byUserId)}</span>
                          </div>
                          {a.body && <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── TASKS ── */}
          <TabsContent value="tasks">
            <TabHeading
              title="Tasks"
              count={data.tasks.length}
              action={
                <Button size="sm" onClick={() => setAction('task')}>
                  <Plus />
                  Create task
                </Button>
              }
            />
            {data.tasks.length === 0 ? (
              <EmptyState icon={ListTodo} title="No tasks" description="Create a follow-up to keep this relationship moving." />
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {data.tasks.map((t) => {
                    const done = t.status === 'done';
                    const overdue = !done && daysUntil(t.dueDate) != null && daysUntil(t.dueDate)! < 0;
                    return (
                      <div key={t.id} className="flex items-start gap-3 p-4">
                        <Checkbox
                          checked={done}
                          disabled={done}
                          onCheckedChange={() => !done && completeTask(t)}
                          aria-label={`Complete ${t.title}`}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn('font-medium', done && 'text-muted-foreground line-through')}>{t.title}</p>
                          {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <StatusBadge kind="taskType" value={t.type} />
                            <StatusBadge kind="taskStatus" value={t.status} />
                            <PriorityBadge value={t.priority} />
                            {t.dueDate && (
                              <span className={cn('tabular', overdue ? 'font-medium text-danger' : 'text-muted-foreground')}>
                                Due {formatDate(t.dueDate)}
                              </span>
                            )}
                            <span className="text-muted-foreground">· {ownerName(t.ownerId)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── FEEDBACK ── */}
          <TabsContent value="feedback">
            <TabHeading title="Application feedback" count={data.feedback.length} />
            {data.feedback.length === 0 ? (
              <EmptyState icon={MessageSquareText} title="No feedback yet" description="Client testing feedback will appear here." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.feedback.map((f) => (
                  <Card key={f.id}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-2 font-semibold">
                            {f.reference}
                            {f.overallResult && <StatusBadge kind="feedbackResult" value={f.overallResult} />}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getLabel('applicationCategory', f.applicationCategory)}
                            {f.testDate ? ` · tested ${formatDate(f.testDate)}` : ''}
                          </p>
                        </div>
                        <Stars value={f.overallRating} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge kind="feedbackStatus" value={f.status} />
                        {f.preferredNextStep && <StatusBadge kind="nextStep" value={f.preferredNextStep} />}
                      </div>
                      {(f.tasteAroma || f.solubility || f.processingBehaviour) && (
                        <dl className="grid gap-2 text-sm">
                          {f.tasteAroma && <Fact label="Taste / aroma">{f.tasteAroma}</Fact>}
                          {f.solubility && <Fact label="Solubility">{f.solubility}</Fact>}
                          {f.processingBehaviour && <Fact label="Processing behaviour">{f.processingBehaviour}</Fact>}
                        </dl>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── PROJECTS ── */}
          <TabsContent value="projects">
            <TabHeading title="Application projects" count={data.projects.length} />
            {data.projects.length === 0 ? (
              <EmptyState icon={FlaskConical} title="No projects" description="Development projects with this company will appear here." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {data.projects.map((p) => (
                  <Card key={p.id}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getLabel('applicationCategory', p.category)}
                            {p.market ? ` · ${p.market}` : ''}
                          </p>
                        </div>
                        <StatusBadge kind="developmentStage" value={p.developmentStage} />
                      </div>
                      {p.objective && <p className="text-sm text-muted-foreground">{p.objective}</p>}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Development progress</span>
                          <span className="tabular">{stageProgress(p.developmentStage)}%</span>
                        </div>
                        <Progress value={stageProgress(p.developmentStage)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {p.testStage && <StatusBadge kind="testStage" value={p.testStage} />}
                        {p.currentResult && <StatusBadge kind="feedbackResult" value={p.currentResult} />}
                        {p.estimatedLaunch && (
                          <span className="text-muted-foreground">Launch {formatDate(p.estimatedLaunch)}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── COMMERCIAL ── */}
          <TabsContent value="commercial">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Commercial terms</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Fact label="Cooperation model">
                      {company.cooperationModel ? getLabel('cooperationModel', company.cooperationModel) : '—'}
                    </Fact>
                    <Fact label="Payment terms">{company.paymentTerms}</Fact>
                    <Fact label="Estimated potential">
                      {formatCurrency(company.estimatedAnnualPotential, company.preferredCurrency)}
                    </Fact>
                    <Fact label="Opportunity value">
                      {formatCurrency(company.opportunityValue, company.preferredCurrency)}
                    </Fact>
                  </dl>
                </CardContent>
              </Card>

              <div>
                <TabHeading title="Opportunities" count={data.opportunities.length} />
                {data.opportunities.length === 0 ? (
                  <EmptyState icon={Target} title="No opportunities" description="Pipeline opportunities will appear here." />
                ) : (
                  <DataTable<Opportunity>
                    data={data.opportunities}
                    getRowId={(o) => o.id}
                    columns={[
                      { key: 'title', header: 'Title', sortable: true, cell: (o) => <span className="font-medium">{o.title}</span> },
                      { key: 'stage', header: 'Stage', cell: (o) => <StatusBadge kind="pipelineStage" value={o.stage} /> },
                      {
                        key: 'value',
                        header: 'Value',
                        align: 'right',
                        sortValue: (o) => o.expectedValue ?? 0,
                        cell: (o) => formatCurrency(o.expectedValue, o.currency),
                      },
                      {
                        key: 'probability',
                        header: 'Prob.',
                        align: 'right',
                        sortValue: (o) => o.probability ?? 0,
                        cell: (o) => (o.probability != null ? `${o.probability}%` : '—'),
                      },
                      {
                        key: 'close',
                        header: 'Expected close',
                        sortValue: (o) => o.expectedCloseDate ?? '',
                        cell: (o) => formatDate(o.expectedCloseDate),
                      },
                      { key: 'owner', header: 'Owner', cell: (o) => ownerName(o.ownerId) },
                    ]}
                  />
                )}
              </div>

              <div>
                <TabHeading title="Finance documents" count={data.finance.length} />
                {data.finance.length === 0 ? (
                  <EmptyState icon={Receipt} title="No finance documents" description="Quotes, orders and invoices will appear here." />
                ) : (
                  <DataTable<FinanceDocument>
                    data={data.finance}
                    getRowId={(d) => d.id}
                    columns={[
                      { key: 'reference', header: 'Reference', sortable: true, cell: (d) => <span className="font-medium">{d.reference}</span> },
                      { key: 'kind', header: 'Type', cell: (d) => <StatusBadge kind="financeDocKind" value={d.kind} /> },
                      {
                        key: 'total',
                        header: 'Total',
                        align: 'right',
                        sortValue: (d) => d.total,
                        cell: (d) => formatCurrency(d.total, d.currency),
                      },
                      {
                        key: 'outstanding',
                        header: 'Outstanding',
                        align: 'right',
                        sortValue: (d) => d.outstandingAmount ?? 0,
                        cell: (d) =>
                          d.outstandingAmount ? formatCurrency(d.outstandingAmount, d.currency) : '—',
                      },
                      { key: 'status', header: 'Status', cell: (d) => <StatusBadge kind="paymentStatus" value={d.paymentStatus} /> },
                      {
                        key: 'issueDate',
                        header: 'Issued',
                        sortable: true,
                        sortValue: (d) => d.issueDate,
                        cell: (d) => formatDate(d.issueDate),
                      },
                    ]}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── LOGISTICS ── */}
          <TabsContent value="logistics">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Logistics profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Fact label="Preferred courier">{company.preferredCourier}</Fact>
                    <Fact label="Delivery instructions">{company.deliveryInstructions}</Fact>
                    <div className="sm:col-span-2">
                      <Fact label="Customs information">{company.customsInfo}</Fact>
                    </div>
                    {company.logisticsRequirements && (
                      <div className="sm:col-span-2">
                        <Fact label="Logistics requirements">{company.logisticsRequirements}</Fact>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              <div>
                <TabHeading title="Shipping addresses" />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(company.shippingAddresses?.length ? company.shippingAddresses : [company.headquarters]).map(
                    (addr, i) => (
                      <Card key={i}>
                        <CardContent className="space-y-1 p-4 text-sm">
                          <p className="flex items-center gap-1.5 font-medium">
                            <span>{flagEmoji(addr.countryCode)}</span>
                            {addr.label ?? (i === 0 ? 'Primary' : `Address ${i + 1}`)}
                          </p>
                          <p className="text-muted-foreground">{addr.line1}</p>
                          {addr.line2 && <p className="text-muted-foreground">{addr.line2}</p>}
                          <p className="text-muted-foreground">
                            {addr.postalCode} {addr.city}
                            {addr.region ? `, ${addr.region}` : ''}
                          </p>
                          <p className="text-muted-foreground">{addr.country}</p>
                        </CardContent>
                      </Card>
                    ),
                  )}
                </div>
              </div>

              <div>
                <TabHeading title="Recent shipments" count={data.shipments.length} />
                {data.shipments.length === 0 ? (
                  <EmptyState icon={PackageSearch} title="No shipments" description="No shipments dispatched to this company yet." />
                ) : (
                  <div className="space-y-3">
                    {data.shipments.slice(0, 5).map((s) => (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3 text-sm"
                      >
                        <span className="font-medium">{s.reference}</span>
                        <StatusBadge kind="sampleStatus" value={deriveShipmentStatus(s)} />
                        <span className="text-muted-foreground">{s.courier ?? '—'}</span>
                        <span className="text-muted-foreground">{formatDate(s.shipmentDate)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* ── quick action dialogs ── */}
      <QuickActionDialog
        open={action === 'activity'}
        onOpenChange={(o) => !o && setAction(null)}
        title="Log activity"
        description="Record a call, email or interaction with this company."
        fields={ACTIVITY_FIELDS}
        submitLabel="Log activity"
        onSubmit={async (v) => {
          if (!company) return;
          await activityService.create({
            id: `act_${Date.now()}`,
            type: 'note',
            companyId: company.id,
            title: v.title,
            body: v.body || undefined,
            byUserId: account?.id,
            at: new Date().toISOString(),
          });
          await load();
          toast({ title: 'Activity logged', description: v.title, variant: 'success' });
        }}
      />
      <QuickActionDialog
        open={action === 'task'}
        onOpenChange={(o) => !o && setAction(null)}
        title="Create task"
        description="Add a follow-up task for this company."
        fields={TASK_FIELDS}
        submitLabel="Create task"
        onSubmit={async (v) => {
          if (!company) return;
          await taskService.create({
            id: `task_${Date.now()}`,
            title: v.title,
            description: v.description || undefined,
            type: 'follow_up',
            companyId: company.id,
            ownerId: account?.id ?? company.accountOwnerId,
            priority: 'medium',
            dueDate: v.dueDate || undefined,
            status: 'open',
            createdAt: new Date().toISOString(),
          });
          await load();
          toast({ title: 'Task created', description: v.title, variant: 'success' });
        }}
      />
      <QuickActionDialog
        open={action === 'note'}
        onOpenChange={(o) => !o && setAction(null)}
        title="Add note"
        description="Capture an internal note on this company."
        fields={NOTE_FIELDS}
        submitLabel="Add note"
        onSubmit={async (v) => {
          if (!company) return;
          await activityService.create({
            id: `act_${Date.now()}`,
            type: 'note',
            companyId: company.id,
            title: 'Note',
            body: v.body,
            byUserId: account?.id,
            visibility: 'internal',
            at: new Date().toISOString(),
          });
          await load();
          toast({ title: 'Note added', variant: 'success' });
        }}
      />
      <QuickActionDialog
        open={action === 'sample'}
        onOpenChange={(o) => !o && setAction(null)}
        title="Request sample"
        description="Draft a new sample request for this company."
        fields={SAMPLE_FIELDS}
        submitLabel="Create request"
        onSubmit={async (v) => {
          if (!company) return;
          const qty = Number(v.quantity) || 0;
          await sampleService.create({
            id: `sr_${Date.now()}`,
            reference: `SR-DRAFT-${Date.now().toString().slice(-4)}`,
            companyId: company.id,
            applicationCategory: 'other',
            requestedProduct: v.product,
            requestedQuantity: qty,
            unit: 'kg',
            requestDate: new Date().toISOString().slice(0, 10),
            priority: 'medium',
            status: 'draft',
            statusHistory: [{ status: 'draft', at: new Date().toISOString(), byUserId: account?.id }],
            createdAt: new Date().toISOString(),
          });
          await load();
          toast({ title: 'Sample request drafted', description: v.product, variant: 'success' });
        }}
      />
      <QuickActionDialog
        open={action === 'contact'}
        onOpenChange={(o) => !o && setAction(null)}
        title="Add contact"
        description="Add a new contact at this company."
        fields={CONTACT_FIELDS}
        submitLabel="Add contact"
        onSubmit={async (v) => {
          if (!company) return;
          await contactService.create({
            id: `ct_${Date.now()}`,
            companyId: company.id,
            firstName: v.firstName,
            lastName: v.lastName,
            jobTitle: v.jobTitle || undefined,
            email: v.email,
            phone: v.phone || undefined,
            createdAt: new Date().toISOString(),
          });
          await load();
          toast({ title: 'Contact added', description: `${v.firstName} ${v.lastName}`, variant: 'success' });
        }}
      />

      {/* ── NDA status confirm ── */}
      <ConfirmDialog
        open={!!ndaConfirm}
        onOpenChange={(o) => !o && setNdaConfirm(null)}
        title={`Mark NDA ${ndaConfirm?.label ?? ''}?`}
        description={
          ndaConfirm
            ? `This will update ${ndaConfirm.nda.reference} to “${getLabel('ndaStatus', ndaConfirm.to)}”.`
            : undefined
        }
        confirmLabel="Confirm"
        onConfirm={() => void applyNdaStatus()}
      />
    </div>
  );
}

/* ────────────────────────────── derived builders ────────────────────────────── */

function buildJourney(company: Company, data: ProfileData): JourneyStep[] {
  const firstSample = data.samples
    .slice()
    .sort((a, b) => new Date(a.requestDate).getTime() - new Date(b.requestDate).getTime())[0];
  const firstShipment = data.shipments
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
  const nda = data.ndas[0];
  const testing = data.projects.some((p) => p.testStage && p.testStage !== 'not_started') ||
    data.samples.some((s) => ['testing', 'feedback_requested', 'feedback_received'].includes(s.status));
  const fb = data.feedback[0];

  const ndaSigned = company.ndaStatus === 'fully_signed';
  const ndaStarted = !['not_required', 'to_prepare'].includes(company.ndaStatus);

  return [
    {
      key: 'first_contact',
      label: 'First contact',
      icon: Handshake,
      date: company.firstContact.date,
      state: 'done',
      detail: <StatusBadge kind="firstContactChannel" value={company.firstContact.channel} />,
    },
    {
      key: 'nda',
      label: 'NDA',
      icon: FileSignature,
      date: nda?.dateSent ?? nda?.createdAt,
      state: ndaSigned ? 'done' : ndaStarted ? 'active' : 'pending',
      detail: <StatusBadge kind="ndaStatus" value={company.ndaStatus} />,
    },
    {
      key: 'sample',
      label: 'Sample request',
      icon: FlaskConical,
      date: firstSample?.requestDate,
      state: firstSample ? (firstSample.status === 'draft' ? 'active' : 'done') : 'pending',
      detail: firstSample ? <StatusBadge kind="sampleStatus" value={firstSample.status} /> : 'Not requested yet',
    },
    {
      key: 'shipment',
      label: 'Shipment',
      icon: Truck,
      date: firstShipment?.shipmentDate ?? firstShipment?.createdAt,
      state: firstShipment ? (deriveShipmentStatus(firstShipment) === 'delivered' ? 'done' : 'active') : 'pending',
      detail: firstShipment ? (
        <StatusBadge kind="sampleStatus" value={deriveShipmentStatus(firstShipment)} />
      ) : (
        'No shipment yet'
      ),
    },
    {
      key: 'testing',
      label: 'Testing',
      icon: PackageSearch,
      date: undefined,
      state: fb ? 'done' : testing ? 'active' : 'pending',
      detail: testing ? 'In progress' : 'Awaiting samples',
    },
    {
      key: 'feedback',
      label: 'Feedback',
      icon: MessageSquareText,
      date: fb?.testDate ?? fb?.createdAt,
      state: fb ? (fb.status === 'resolved' ? 'done' : 'active') : 'pending',
      detail: fb ? <StatusBadge kind="feedbackResult" value={fb.overallResult} /> : 'Not received',
    },
  ];
}

const STAGE_ORDER = ['concept', 'feasibility', 'prototype', 'pilot', 'pre_industrial', 'industrial', 'launched'];
function stageProgress(stage: string): number {
  if (stage === 'on_hold') return 0;
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0) return 0;
  return Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
}

const FUNNEL_STAGES: { stages: string[]; label: string }[] = [
  { label: 'Lead', stages: ['lead', 'contacted'] },
  { label: 'Interested', stages: ['interested', 'qualified'] },
  { label: 'NDA', stages: ['nda_in_progress', 'nda_signed'] },
  { label: 'Sampling', stages: ['sampling'] },
  { label: 'Testing', stages: ['testing'] },
  { label: 'Commercial', stages: ['commercial_discussion', 'customer', 'repeat_customer'] },
];

function buildFunnel(company: Company): { name: string; value: number }[] {
  // Highlight how far this company has progressed: each reached stage = full bar.
  const reachedIndex = FUNNEL_STAGES.findIndex((g) => g.stages.includes(company.relationshipStage));
  const cutoff = reachedIndex < 0 ? FUNNEL_STAGES.length : reachedIndex + 1;
  return FUNNEL_STAGES.map((g, i) => ({
    name: g.label,
    value: i < cutoff ? Math.max(FUNNEL_STAGES.length - i, 1) : 0,
  }));
}

function buildEngagementMix(data: ProfileData): { name: string; value: number; color?: string }[] {
  return [
    { name: 'Activities', value: data.activities.length, color: CHART_COLORS[0] },
    { name: 'Samples', value: data.samples.length, color: CHART_COLORS[1] },
    { name: 'Tasks', value: data.tasks.length, color: CHART_COLORS[2] },
    { name: 'Documents', value: data.documents.length, color: CHART_COLORS[3] },
    { name: 'Meetings', value: data.meetings.length, color: CHART_COLORS[4] },
    { name: 'Feedback', value: data.feedback.length, color: CHART_COLORS[5] },
  ].filter((d) => d.value > 0);
}

/* ────────────────────────────── form field configs ────────────────────────────── */

const ACTIVITY_FIELDS: QuickField[] = [
  { name: 'title', label: 'Summary', placeholder: 'e.g. Intro call with R&D team', required: true },
  { name: 'body', label: 'Details', type: 'textarea', placeholder: 'What was discussed?' },
];
const TASK_FIELDS: QuickField[] = [
  { name: 'title', label: 'Task', placeholder: 'e.g. Send 1kg follow-up sample', required: true },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'dueDate', label: 'Due date', type: 'date' },
];
const NOTE_FIELDS: QuickField[] = [
  { name: 'body', label: 'Note', type: 'textarea', placeholder: 'Internal note…', required: true },
];
const SAMPLE_FIELDS: QuickField[] = [
  { name: 'product', label: 'Requested product', placeholder: 'e.g. Proamina® WPI 80', required: true },
  { name: 'quantity', label: 'Quantity (kg)', type: 'number', placeholder: '1', required: true },
];
const CONTACT_FIELDS: QuickField[] = [
  { name: 'firstName', label: 'First name', required: true },
  { name: 'lastName', label: 'Last name', required: true },
  { name: 'jobTitle', label: 'Job title' },
  { name: 'email', label: 'Email', required: true },
  { name: 'phone', label: 'Phone' },
];
