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
import { useLocale, useTranslations } from 'next-intl';
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
  Locale,
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

type T = ReturnType<typeof useTranslations<'AdminCompanyDetail'>>;

const ACTIVE_TASK = (t: Task) => t.status !== 'done' && t.status !== 'cancelled';
const ownerName = (id: string | undefined, t: T) => {
  if (!id) return t('unassigned');
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

function Stars({ value, t }: { value?: number; t: T }) {
  const n = Math.round(value ?? 0);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={t('starsAriaLabel', { n })}>
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
  const t = useTranslations('AdminCompanyDetail');
  const locale = useLocale() as Locale;
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
          title={t('companyNotFoundTitle')}
          description={t('companyNotFoundDescription')}
          action={
            <Button asChild variant="outline">
              <Link href="/admin/companies">
                <ArrowLeft />
                {t('backToCompanies')}
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
    toast({ title: t('toastTaskCompleted'), description: task.title, variant: 'success' });
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
    toast({ title: t('toastNdaMarked', { label }), description: nda.reference, variant: 'success' });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* back link */}
      <Link
        href="/admin/companies"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('allCompanies')}
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
                      <p className="text-sm text-muted-foreground">{t('tradingAs', { name: company.tradingName })}</p>
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
                      {ownerName(company.accountOwnerId, t)}
                    </span>
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-info hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {t('website')}
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
                  {t('logActivity')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('task')}>
                  <PenSquare />
                  {t('createTask')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction('note')}>
                  <StickyNote />
                  {t('addNote')}
                </Button>
                <Button variant="gold" size="sm" onClick={() => setAction('sample')}>
                  <PackagePlus />
                  {t('requestSample')}
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
              label={t('statNdaStatus')}
              value={getLabel('ndaStatus', company.ndaStatus)}
              icon={FileSignature}
              tone={ndaSigned ? 'success' : 'warning'}
              hint={t('agreementsOnFile', { count: data!.ndas.length })}
            />
            <StatCard
              label={t('statLatestSample')}
              value={latestSample ? getLabel('sampleStatus', latestSample.status) : t('none')}
              icon={FlaskConical}
              tone="info"
              hint={latestSample?.reference}
            />
            <StatCard
              label={t('statLastRequestedQty')}
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
              label={t('statLatestShipment')}
              value={latestShipment ? getLabel('sampleStatus', deriveShipmentStatus(latestShipment)) : t('none')}
              icon={Truck}
              tone={latestShipment && latestShipment.isDelayed ? 'danger' : 'info'}
              hint={latestShipment?.courier}
            />
            <StatCard
              label={t('statOpenTasks')}
              value={openTasks.length}
              icon={ListTodo}
              tone={openTasks.some((t) => daysUntil(t.dueDate) != null && daysUntil(t.dueDate)! < 0) ? 'danger' : 'warning'}
              hint={t('tasksTotal', { count: data!.tasks.length })}
            />
            <StatCard
              label={t('statDocuments')}
              value={data!.documents.length}
              icon={FolderOpen}
              tone="default"
              hint={t('documentsShared', { count: sharedDocs })}
            />
            <StatCard
              label={t('statOpportunityValue')}
              value={company.opportunityValue ?? 0}
              icon={TrendingUp}
              tone="gold"
              format={(n) => formatCurrency(n, company.preferredCurrency, locale, { compact: true })}
              hint={t('opportunitiesCount', { count: data!.opportunities.length })}
            />
            <StatCard
              label={t('statNextAction')}
              value={company.nextAction?.label ?? t('noActionSet')}
              icon={CalendarClock}
              tone="warning"
              hint={company.nextAction?.dueDate ? t('dueDate', { date: formatDate(company.nextAction.dueDate) }) : undefined}
            />
          </>
        )}
      </div>

      {/* ── charts ── */}
      {!loading && data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title={t('relationshipFunnel')}
            description={t('relationshipFunnelDescription')}
            height={220}
            isEmpty={false}
          >
            <FunnelChartCard data={buildFunnel(company!, t)} height={220} />
          </ChartCard>
          <ChartCard
            title={t('engagementMix')}
            description={t('engagementMixDescription')}
            height={220}
            isEmpty={
              data.activities.length + data.samples.length + data.tasks.length + data.documents.length === 0
            }
          >
            <DonutChart data={buildEngagementMix(data, t)} height={220} centerLabel={t('records')} />
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
              <TabsTrigger value="overview">{t('tabOverview')}</TabsTrigger>
              <TabsTrigger value="contacts">{t('tabContacts')}</TabsTrigger>
              <TabsTrigger value="nda">{t('tabNda')}</TabsTrigger>
              <TabsTrigger value="samples">{t('tabSamples')}</TabsTrigger>
              <TabsTrigger value="shipments">{t('tabShipments')}</TabsTrigger>
              <TabsTrigger value="documents">{t('tabDocuments')}</TabsTrigger>
              <TabsTrigger value="activities">{t('tabActivities')}</TabsTrigger>
              <TabsTrigger value="tasks">{t('tabTasks')}</TabsTrigger>
              <TabsTrigger value="feedback">{t('tabFeedback')}</TabsTrigger>
              <TabsTrigger value="projects">{t('tabProjects')}</TabsTrigger>
              <TabsTrigger value="commercial">{t('tabCommercial')}</TabsTrigger>
              <TabsTrigger value="logistics">{t('tabLogistics')}</TabsTrigger>
            </TabsList>
          </div>

          {/* ── OVERVIEW ── */}
          <TabsContent value="overview">
            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">{t('engagementJourney')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <JourneyTimeline steps={buildJourney(company, data, t)} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">{t('keyFacts')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    <Fact label={t('marketsServed')}>
                      {company.marketsServed?.length ? company.marketsServed.join(', ') : '—'}
                    </Fact>
                    <Fact label={t('cooperationModel')}>
                      {company.cooperationModel ? getLabel('cooperationModel', company.cooperationModel) : '—'}
                    </Fact>
                    <div className="col-span-2">
                      <Fact label={t('applicationInterests')}>
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
                        <Fact label={t('productCategories')}>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {company.productCategories.map((c) => (
                              <StatusBadge key={c} kind="applicationCategory" value={c} />
                            ))}
                          </div>
                        </Fact>
                      </div>
                    ) : null}
                    <Fact label={t('estimatedAnnualPotential')}>
                      {formatCurrency(company.estimatedAnnualPotential, company.preferredCurrency)}
                    </Fact>
                    <Fact label={t('leadScore')}>{company.leadScore != null ? `${company.leadScore}/100` : '—'}</Fact>
                    <Fact label={t('firstContact')}>
                      {formatDate(company.firstContact.date)} ·{' '}
                      {getLabel('firstContactChannel', company.firstContact.channel)}
                    </Fact>
                    <Fact label={t('lastActivity')}>
                      {company.lastActivityAt ? formatRelative(company.lastActivityAt) : '—'}
                    </Fact>
                    {company.commercialNotes && (
                      <div className="col-span-2">
                        <Fact label={t('commercialNotes')}>{company.commercialNotes}</Fact>
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
              title={t('tabContacts')}
              count={data.contacts.length}
              action={
                <Button size="sm" onClick={() => setAction('contact')}>
                  <Plus />
                  {t('addContact')}
                </Button>
              }
            />
            {data.contacts.length === 0 ? (
              <EmptyState icon={UserIcon} title={t('noContactsTitle')} description={t('noContactsDescription')} />
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
                        {c.isTechnical && <Badge variant="info">{t('roleTechnical')}</Badge>}
                        {c.isCommercial && <Badge variant="gold">{t('roleCommercial')}</Badge>}
                        {c.isLogistics && <Badge variant="secondary">{t('roleLogistics')}</Badge>}
                        {c.isFinance && <Badge variant="muted">{t('roleFinance')}</Badge>}
                        {c.isLegal && <Badge variant="outline">{t('roleLegal')}</Badge>}
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
            <TabHeading title={t('ndaTabTitle')} count={data.ndas.length} />
            {data.ndas.length === 0 ? (
              <EmptyState
                icon={FileSignature}
                title={t('noNdaTitle')}
                description={t('noNdaDescription')}
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
                            <span>{t('sentDate', { date: formatDate(n.dateSent) })}</span>
                            <span>{t('effectiveDate', { date: formatDate(n.effectiveDate) })}</span>
                            <span>{t('expiresDate', { date: formatDate(n.expiryDate) })}</span>
                          </div>
                        </div>
                        <StatusBadge kind="ndaStatus" value={n.status} />
                      </div>

                      {n.versions.length > 0 && (
                        <div className="rounded-md border bg-muted/30 p-3">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {t('versions')}
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
                          onClick={() => setNdaConfirm({ nda: n, to: 'sent', label: t('ndaLabelSent') })}
                        >
                          {t('markSent')}
                        </Button>
                        <Button
                          variant="success"
                          size="sm"
                          disabled={n.status === 'fully_signed'}
                          onClick={() => setNdaConfirm({ nda: n, to: 'fully_signed', label: t('ndaLabelSigned') })}
                        >
                          <Check />
                          {t('markSigned')}
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
              title={t('sampleRequestsTitle')}
              count={data.samples.length}
              action={
                <Button size="sm" variant="gold" onClick={() => setAction('sample')}>
                  <PackagePlus />
                  {t('requestSample')}
                </Button>
              }
            />
            <DataTable<SampleRequest>
              data={data.samples}
              getRowId={(s) => s.id}
              onRowClick={(s) => router.push('/admin/samples/' + s.id)}
              searchable
              searchPlaceholder={t('searchSamplesPlaceholder')}
              emptyTitle={t('noSamplesTitle')}
              emptyDescription={t('noSamplesTableDescription')}
              columns={[
                { key: 'reference', header: t('colReference'), sortable: true, cell: (s) => <span className="font-medium">{s.reference}</span> },
                {
                  key: 'product',
                  header: t('colProduct'),
                  cell: (s) => (
                    <div>
                      <p className="truncate">{s.requestedProduct}</p>
                      <p className="text-xs text-muted-foreground">{getLabel('applicationCategory', s.applicationCategory)}</p>
                    </div>
                  ),
                },
                {
                  key: 'qty',
                  header: t('colQty'),
                  align: 'right',
                  sortValue: (s) => s.approvedQuantity ?? s.requestedQuantity,
                  cell: (s) => formatQuantity(s.approvedQuantity ?? s.requestedQuantity, s.unit),
                },
                { key: 'status', header: t('colStatus'), cell: (s) => <StatusBadge kind="sampleStatus" value={s.status} /> },
                { key: 'priority', header: t('colPriority'), cell: (s) => <PriorityBadge value={s.priority} /> },
                {
                  key: 'requestDate',
                  header: t('colRequested'),
                  sortable: true,
                  sortValue: (s) => s.requestDate,
                  cell: (s) => formatDate(s.requestDate),
                },
              ]}
            />
          </TabsContent>

          {/* ── SHIPMENTS ── */}
          <TabsContent value="shipments">
            <TabHeading title={t('tabShipments')} count={data.shipments.length} />
            {data.shipments.length === 0 ? (
              <EmptyState icon={Truck} title={t('noShipmentsYetTitle')} description={t('noShipmentsYetDescription')} />
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
                            {s.isDelayed && !s.actualDelivery && <Badge variant="danger">{t('delayed')}</Badge>}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {s.courier ?? t('courierTbd')}
                            {s.service ? ` · ${s.service}` : ''} → {s.address.city}, {s.address.country}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{t('shippedDate', { date: formatDate(s.shipmentDate) })}</span>
                            <span>{t('etaDate', { date: formatDate(s.estimatedDelivery) })}</span>
                            {s.actualDelivery && <span>{t('deliveredDate', { date: formatDate(s.actualDelivery) })}</span>}
                            {s.customsStatus && (
                              <span className="inline-flex items-center gap-1">
                                {t('customsLabel')} <StatusBadge kind="customsStatus" value={s.customsStatus} />
                              </span>
                            )}
                          </div>
                        </div>
                        {s.trackingNumber && (
                          <Button asChild variant="outline" size="sm" disabled={!s.trackingUrl}>
                            {s.trackingUrl ? (
                              <a href={s.trackingUrl} target="_blank" rel="noreferrer">
                                <Truck />
                                {t('track', { number: s.trackingNumber })}
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
            <TabHeading title={t('tabDocuments')} count={data.documents.length} />
            {!ndaSigned && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/40 bg-warning-subtle/50 p-3 text-sm text-warning-foreground">
                <Lock className="h-4 w-4 shrink-0" />
                {t('postNdaLocked')}
              </div>
            )}
            {data.documents.length === 0 ? (
              <EmptyState icon={FolderOpen} title={t('noDocumentsTitle')} description={t('noDocumentsDescription')} />
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
                                title: t('toastDownloadStarted'),
                                description: doc.name,
                                variant: 'info',
                              })
                            }
                          >
                            <Download />
                            {locked ? t('locked') : t('download')}
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
              title={t('activityTimelineTitle')}
              count={data.activities.length}
              action={
                <Button size="sm" variant="outline" onClick={() => setAction('activity')}>
                  <Plus />
                  {t('logActivity')}
                </Button>
              }
            />
            {data.activities.length === 0 ? (
              <EmptyState icon={ActivityIcon} title={t('noActivityTitle')} description={t('noActivityDescription')} />
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
                            <span className="text-xs text-muted-foreground">{ownerName(a.byUserId, t)}</span>
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
              title={t('tabTasks')}
              count={data.tasks.length}
              action={
                <Button size="sm" onClick={() => setAction('task')}>
                  <Plus />
                  {t('createTask')}
                </Button>
              }
            />
            {data.tasks.length === 0 ? (
              <EmptyState icon={ListTodo} title={t('noTasksTitle')} description={t('noTasksDescription')} />
            ) : (
              <Card>
                <CardContent className="divide-y p-0">
                  {data.tasks.map((task) => {
                    const done = task.status === 'done';
                    const overdue = !done && daysUntil(task.dueDate) != null && daysUntil(task.dueDate)! < 0;
                    return (
                      <div key={task.id} className="flex items-start gap-3 p-4">
                        <Checkbox
                          checked={done}
                          disabled={done}
                          onCheckedChange={() => !done && completeTask(task)}
                          aria-label={t('completeTaskAria', { title: task.title })}
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn('font-medium', done && 'text-muted-foreground line-through')}>{task.title}</p>
                          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <StatusBadge kind="taskType" value={task.type} />
                            <StatusBadge kind="taskStatus" value={task.status} />
                            <PriorityBadge value={task.priority} />
                            {task.dueDate && (
                              <span className={cn('tabular', overdue ? 'font-medium text-danger' : 'text-muted-foreground')}>
                                {t('dueDate', { date: formatDate(task.dueDate) })}
                              </span>
                            )}
                            <span className="text-muted-foreground">· {ownerName(task.ownerId, t)}</span>
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
            <TabHeading title={t('applicationFeedbackTitle')} count={data.feedback.length} />
            {data.feedback.length === 0 ? (
              <EmptyState icon={MessageSquareText} title={t('noFeedbackTitle')} description={t('noFeedbackDescription')} />
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
                            {f.testDate ? ` · ${t('testedDate', { date: formatDate(f.testDate) })}` : ''}
                          </p>
                        </div>
                        <Stars value={f.overallRating} t={t} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge kind="feedbackStatus" value={f.status} />
                        {f.preferredNextStep && <StatusBadge kind="nextStep" value={f.preferredNextStep} />}
                      </div>
                      {(f.tasteAroma || f.solubility || f.processingBehaviour) && (
                        <dl className="grid gap-2 text-sm">
                          {f.tasteAroma && <Fact label={t('tasteAroma')}>{f.tasteAroma}</Fact>}
                          {f.solubility && <Fact label={t('solubility')}>{f.solubility}</Fact>}
                          {f.processingBehaviour && <Fact label={t('processingBehaviour')}>{f.processingBehaviour}</Fact>}
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
            <TabHeading title={t('applicationProjectsTitle')} count={data.projects.length} />
            {data.projects.length === 0 ? (
              <EmptyState icon={FlaskConical} title={t('noProjectsTitle')} description={t('noProjectsDescription')} />
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
                          <span>{t('developmentProgress')}</span>
                          <span className="tabular">{stageProgress(p.developmentStage)}%</span>
                        </div>
                        <Progress value={stageProgress(p.developmentStage)} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {p.testStage && <StatusBadge kind="testStage" value={p.testStage} />}
                        {p.currentResult && <StatusBadge kind="feedbackResult" value={p.currentResult} />}
                        {p.estimatedLaunch && (
                          <span className="text-muted-foreground">{t('launchDate', { date: formatDate(p.estimatedLaunch) })}</span>
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
                  <CardTitle className="text-base">{t('commercialTerms')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Fact label={t('cooperationModel')}>
                      {company.cooperationModel ? getLabel('cooperationModel', company.cooperationModel) : '—'}
                    </Fact>
                    <Fact label={t('paymentTerms')}>{company.paymentTerms}</Fact>
                    <Fact label={t('estimatedPotential')}>
                      {formatCurrency(company.estimatedAnnualPotential, company.preferredCurrency)}
                    </Fact>
                    <Fact label={t('opportunityValue')}>
                      {formatCurrency(company.opportunityValue, company.preferredCurrency)}
                    </Fact>
                  </dl>
                </CardContent>
              </Card>

              <div>
                <TabHeading title={t('tabOpportunities')} count={data.opportunities.length} />
                {data.opportunities.length === 0 ? (
                  <EmptyState icon={Target} title={t('noOpportunitiesTitle')} description={t('noOpportunitiesDescription')} />
                ) : (
                  <DataTable<Opportunity>
                    data={data.opportunities}
                    getRowId={(o) => o.id}
                    columns={[
                      { key: 'title', header: t('colTitle'), sortable: true, cell: (o) => <span className="font-medium">{o.title}</span> },
                      { key: 'stage', header: t('colStage'), cell: (o) => <StatusBadge kind="pipelineStage" value={o.stage} /> },
                      {
                        key: 'value',
                        header: t('colValue'),
                        align: 'right',
                        sortValue: (o) => o.expectedValue ?? 0,
                        cell: (o) => formatCurrency(o.expectedValue, o.currency),
                      },
                      {
                        key: 'probability',
                        header: t('colProbability'),
                        align: 'right',
                        sortValue: (o) => o.probability ?? 0,
                        cell: (o) => (o.probability != null ? `${o.probability}%` : '—'),
                      },
                      {
                        key: 'close',
                        header: t('colExpectedClose'),
                        sortValue: (o) => o.expectedCloseDate ?? '',
                        cell: (o) => formatDate(o.expectedCloseDate),
                      },
                      { key: 'owner', header: t('colOwner'), cell: (o) => ownerName(o.ownerId, t) },
                    ]}
                  />
                )}
              </div>

              <div>
                <TabHeading title={t('financeDocumentsTitle')} count={data.finance.length} />
                {data.finance.length === 0 ? (
                  <EmptyState icon={Receipt} title={t('noFinanceTitle')} description={t('noFinanceDescription')} />
                ) : (
                  <DataTable<FinanceDocument>
                    data={data.finance}
                    getRowId={(d) => d.id}
                    columns={[
                      { key: 'reference', header: t('colReference'), sortable: true, cell: (d) => <span className="font-medium">{d.reference}</span> },
                      { key: 'kind', header: t('colType'), cell: (d) => <StatusBadge kind="financeDocKind" value={d.kind} /> },
                      {
                        key: 'total',
                        header: t('colTotal'),
                        align: 'right',
                        sortValue: (d) => d.total,
                        cell: (d) => formatCurrency(d.total, d.currency),
                      },
                      {
                        key: 'outstanding',
                        header: t('colOutstanding'),
                        align: 'right',
                        sortValue: (d) => d.outstandingAmount ?? 0,
                        cell: (d) =>
                          d.outstandingAmount ? formatCurrency(d.outstandingAmount, d.currency) : '—',
                      },
                      { key: 'status', header: t('colStatus'), cell: (d) => <StatusBadge kind="paymentStatus" value={d.paymentStatus} /> },
                      {
                        key: 'issueDate',
                        header: t('colIssued'),
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
                  <CardTitle className="text-base">{t('logisticsProfile')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Fact label={t('preferredCourier')}>{company.preferredCourier}</Fact>
                    <Fact label={t('deliveryInstructions')}>{company.deliveryInstructions}</Fact>
                    <div className="sm:col-span-2">
                      <Fact label={t('customsInformation')}>{company.customsInfo}</Fact>
                    </div>
                    {company.logisticsRequirements && (
                      <div className="sm:col-span-2">
                        <Fact label={t('logisticsRequirements')}>{company.logisticsRequirements}</Fact>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              <div>
                <TabHeading title={t('shippingAddresses')} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(company.shippingAddresses?.length ? company.shippingAddresses : [company.headquarters]).map(
                    (addr, i) => (
                      <Card key={i}>
                        <CardContent className="space-y-1 p-4 text-sm">
                          <p className="flex items-center gap-1.5 font-medium">
                            <span>{flagEmoji(addr.countryCode)}</span>
                            {addr.label ?? (i === 0 ? t('primaryAddress') : t('addressN', { n: i + 1 }))}
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
                <TabHeading title={t('recentShipments')} count={data.shipments.length} />
                {data.shipments.length === 0 ? (
                  <EmptyState icon={PackageSearch} title={t('noShipmentsTitle')} description={t('noShipmentsLogisticsDescription')} />
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
        title={t('logActivity')}
        description={t('logActivityDescription')}
        fields={ACTIVITY_FIELDS(t)}
        submitLabel={t('logActivity')}
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
          toast({ title: t('toastActivityLogged'), description: v.title, variant: 'success' });
        }}
      />
      <QuickActionDialog
        open={action === 'task'}
        onOpenChange={(o) => !o && setAction(null)}
        title={t('createTask')}
        description={t('createTaskDescription')}
        fields={TASK_FIELDS(t)}
        submitLabel={t('createTask')}
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
          toast({ title: t('toastTaskCreated'), description: v.title, variant: 'success' });
        }}
      />
      <QuickActionDialog
        open={action === 'note'}
        onOpenChange={(o) => !o && setAction(null)}
        title={t('addNote')}
        description={t('addNoteDescription')}
        fields={NOTE_FIELDS(t)}
        submitLabel={t('addNote')}
        onSubmit={async (v) => {
          if (!company) return;
          await activityService.create({
            id: `act_${Date.now()}`,
            type: 'note',
            companyId: company.id,
            title: t('noteTitle'),
            body: v.body,
            byUserId: account?.id,
            visibility: 'internal',
            at: new Date().toISOString(),
          });
          await load();
          toast({ title: t('toastNoteAdded'), variant: 'success' });
        }}
      />
      <QuickActionDialog
        open={action === 'sample'}
        onOpenChange={(o) => !o && setAction(null)}
        title={t('requestSample')}
        description={t('requestSampleDescription')}
        fields={SAMPLE_FIELDS(t)}
        submitLabel={t('createRequest')}
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
          toast({ title: t('toastSampleDrafted'), description: v.product, variant: 'success' });
        }}
      />
      <QuickActionDialog
        open={action === 'contact'}
        onOpenChange={(o) => !o && setAction(null)}
        title={t('addContact')}
        description={t('addContactDescription')}
        fields={CONTACT_FIELDS(t)}
        submitLabel={t('addContact')}
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
          toast({ title: t('toastContactAdded'), description: `${v.firstName} ${v.lastName}`, variant: 'success' });
        }}
      />

      {/* ── NDA status confirm ── */}
      <ConfirmDialog
        open={!!ndaConfirm}
        onOpenChange={(o) => !o && setNdaConfirm(null)}
        title={t('confirmNdaTitle', { label: ndaConfirm?.label ?? '' })}
        description={
          ndaConfirm
            ? t('confirmNdaDescription', {
                reference: ndaConfirm.nda.reference,
                status: getLabel('ndaStatus', ndaConfirm.to),
              })
            : undefined
        }
        confirmLabel={t('confirmLabel')}
        onConfirm={() => void applyNdaStatus()}
      />
    </div>
  );
}

/* ────────────────────────────── derived builders ────────────────────────────── */

function buildJourney(company: Company, data: ProfileData, t: T): JourneyStep[] {
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
      label: t('journeyFirstContact'),
      icon: Handshake,
      date: company.firstContact.date,
      state: 'done',
      detail: <StatusBadge kind="firstContactChannel" value={company.firstContact.channel} />,
    },
    {
      key: 'nda',
      label: t('journeyNda'),
      icon: FileSignature,
      date: nda?.dateSent ?? nda?.createdAt,
      state: ndaSigned ? 'done' : ndaStarted ? 'active' : 'pending',
      detail: <StatusBadge kind="ndaStatus" value={company.ndaStatus} />,
    },
    {
      key: 'sample',
      label: t('journeySampleRequest'),
      icon: FlaskConical,
      date: firstSample?.requestDate,
      state: firstSample ? (firstSample.status === 'draft' ? 'active' : 'done') : 'pending',
      detail: firstSample ? <StatusBadge kind="sampleStatus" value={firstSample.status} /> : t('journeyNotRequestedYet'),
    },
    {
      key: 'shipment',
      label: t('journeyShipment'),
      icon: Truck,
      date: firstShipment?.shipmentDate ?? firstShipment?.createdAt,
      state: firstShipment ? (deriveShipmentStatus(firstShipment) === 'delivered' ? 'done' : 'active') : 'pending',
      detail: firstShipment ? (
        <StatusBadge kind="sampleStatus" value={deriveShipmentStatus(firstShipment)} />
      ) : (
        t('journeyNoShipmentYet')
      ),
    },
    {
      key: 'testing',
      label: t('journeyTesting'),
      icon: PackageSearch,
      date: undefined,
      state: fb ? 'done' : testing ? 'active' : 'pending',
      detail: testing ? t('journeyInProgress') : t('journeyAwaitingSamples'),
    },
    {
      key: 'feedback',
      label: t('journeyFeedback'),
      icon: MessageSquareText,
      date: fb?.testDate ?? fb?.createdAt,
      state: fb ? (fb.status === 'resolved' ? 'done' : 'active') : 'pending',
      detail: fb ? <StatusBadge kind="feedbackResult" value={fb.overallResult} /> : t('journeyNotReceived'),
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

const FUNNEL_STAGES = (t: T): { stages: string[]; label: string }[] => [
  { label: t('funnelLead'), stages: ['lead', 'contacted'] },
  { label: t('funnelInterested'), stages: ['interested', 'qualified'] },
  { label: t('funnelNda'), stages: ['nda_in_progress', 'nda_signed'] },
  { label: t('funnelSampling'), stages: ['sampling'] },
  { label: t('funnelTesting'), stages: ['testing'] },
  { label: t('funnelCommercial'), stages: ['commercial_discussion', 'customer', 'repeat_customer'] },
];

function buildFunnel(company: Company, t: T): { name: string; value: number }[] {
  // Highlight how far this company has progressed: each reached stage = full bar.
  const stages = FUNNEL_STAGES(t);
  const reachedIndex = stages.findIndex((g) => g.stages.includes(company.relationshipStage));
  const cutoff = reachedIndex < 0 ? stages.length : reachedIndex + 1;
  return stages.map((g, i) => ({
    name: g.label,
    value: i < cutoff ? Math.max(stages.length - i, 1) : 0,
  }));
}

function buildEngagementMix(data: ProfileData, t: T): { name: string; value: number; color?: string }[] {
  return [
    { name: t('mixActivities'), value: data.activities.length, color: CHART_COLORS[0] },
    { name: t('mixSamples'), value: data.samples.length, color: CHART_COLORS[1] },
    { name: t('mixTasks'), value: data.tasks.length, color: CHART_COLORS[2] },
    { name: t('mixDocuments'), value: data.documents.length, color: CHART_COLORS[3] },
    { name: t('mixMeetings'), value: data.meetings.length, color: CHART_COLORS[4] },
    { name: t('mixFeedback'), value: data.feedback.length, color: CHART_COLORS[5] },
  ].filter((d) => d.value > 0);
}

/* ────────────────────────────── form field configs ────────────────────────────── */

const ACTIVITY_FIELDS = (t: T): QuickField[] => [
  { name: 'title', label: t('fieldSummary'), placeholder: t('fieldSummaryPlaceholder'), required: true },
  { name: 'body', label: t('fieldDetails'), type: 'textarea', placeholder: t('fieldDetailsPlaceholder') },
];
const TASK_FIELDS = (t: T): QuickField[] => [
  { name: 'title', label: t('fieldTask'), placeholder: t('fieldTaskPlaceholder'), required: true },
  { name: 'description', label: t('fieldDescription'), type: 'textarea' },
  { name: 'dueDate', label: t('fieldDueDate'), type: 'date' },
];
const NOTE_FIELDS = (t: T): QuickField[] => [
  { name: 'body', label: t('fieldNote'), type: 'textarea', placeholder: t('fieldNotePlaceholder'), required: true },
];
const SAMPLE_FIELDS = (t: T): QuickField[] => [
  { name: 'product', label: t('fieldRequestedProduct'), placeholder: t('fieldRequestedProductPlaceholder'), required: true },
  { name: 'quantity', label: t('fieldQuantityKg'), type: 'number', placeholder: t('fieldQuantityPlaceholder'), required: true },
];
const CONTACT_FIELDS = (t: T): QuickField[] => [
  { name: 'firstName', label: t('fieldFirstName'), required: true },
  { name: 'lastName', label: t('fieldLastName'), required: true },
  { name: 'jobTitle', label: t('fieldJobTitle') },
  { name: 'email', label: t('fieldEmail'), required: true },
  { name: 'phone', label: t('fieldPhone') },
];
