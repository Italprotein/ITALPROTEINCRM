'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Handshake,
  Building2,
  TrendingUp,
  FileSignature,
  Globe2,
  MapPin,
  CalendarClock,
  Users,
  FileText,
  Activity as ActivityIcon,
  ListChecks,
  Mail,
  Phone,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import { Link, useRouter } from '@/lib/i18n/navigation';
import {
  agencyService,
  authService,
  companyService,
  contactService,
  documentService,
  activityService,
  ndaService,
  taskService,
  type Agency,
} from '@/lib/mock-services';
import type { Company, Contact, DocumentRecord, Activity, NDA, Task } from '@/lib/types';
import { formatRelative, formatDate, formatNumber, flagEmoji } from '@/lib/formatting';
import { humanize, getLabel } from '@/lib/labels';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';

type AgreementStatus = Agency['meta']['agreementStatus'];

const AGREEMENT_TONE: Record<AgreementStatus, Parameters<typeof Badge>[0]['variant']> = {
  none: 'muted',
  draft: 'warning',
  active: 'success',
  expired: 'danger',
};

const AGREEMENT_LABEL: Record<AgreementStatus, string> = {
  none: 'No agreement',
  draft: 'Draft',
  active: 'Active',
  expired: 'Expired',
};

function ownerName(id?: string): string {
  if (!id) return 'Unassigned';
  const a = authService.getAccount(id);
  return a ? `${a.firstName} ${a.lastName}` : 'Unassigned';
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function AgencyDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [agency, setAgency] = useState<Agency | null | undefined>(undefined);
  const [introduced, setIntroduced] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [ndas, setNdas] = useState<NDA[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    let active = true;
    agencyService.get(params.id).then(async (a) => {
      if (!active) return;
      if (!a) {
        setAgency(null);
        return;
      }
      setAgency(a);
      const [comps, cts, docs, acts, nds, tks] = await Promise.all([
        Promise.all(a.meta.companiesIntroducedIds.map((id) => companyService.get(id))),
        contactService.byCompany(a.id),
        documentService.byCompany(a.id),
        activityService.byCompany(a.id),
        ndaService.byCompany(a.id),
        taskService.byCompany(a.id),
      ]);
      if (!active) return;
      setIntroduced(comps.filter((c): c is Company => !!c));
      setContacts(cts);
      setDocuments(docs);
      setActivities(acts);
      setNdas(nds);
      setTasks(tks);
    });
    return () => {
      active = false;
    };
  }, [params.id]);

  if (agency === undefined) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (agency === null) {
    return (
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <EmptyState
          icon={Handshake}
          title="Partner not found"
          description="This agency or distributor does not exist or has been removed."
          action={
            <Button variant="outline" onClick={() => router.push('/admin/agencies')}>
              <ArrowLeft className="h-4 w-4" />
              Back to partners
            </Button>
          }
        />
      </div>
    );
  }

  const a = agency;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/agencies" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Agencies & Distributors
        </Link>
      </div>

      <PageHeader
        title={a.tradingName ?? a.legalName}
        subtitle={a.legalName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{humanize(a.meta.agencyType)}</Badge>
            <Badge variant={AGREEMENT_TONE[a.meta.agreementStatus]}>{AGREEMENT_LABEL[a.meta.agreementStatus]}</Badge>
            {a.website && (
              <Button variant="outline" size="sm" asChild>
                <a href={a.website} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Website
                </a>
              </Button>
            )}
            <Button
              variant="gold"
              size="sm"
              onClick={() =>
                toast({
                  title: 'Partner updated',
                  description: 'Changes have been saved to the partner record.',
                  variant: 'success',
                })
              }
            >
              <Pencil className="h-4 w-4" />
              Edit partner
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-base">{flagEmoji(a.countryCode)}</span>
          {a.city}, {a.country}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          {a.meta.territory}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          Owner: <span className="font-medium text-foreground">{ownerName(a.accountOwnerId)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4" />
          Last interaction {formatRelative(a.meta.lastInteractionAt)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Companies introduced" value={a.meta.companiesIntroducedIds.length} icon={Building2} tone="info" />
        <StatCard label="Active leads" value={a.meta.activeLeads} icon={Handshake} tone="gold" delay={0.05} />
        <StatCard
          label="Conversion rate"
          value={Math.round(a.meta.conversionRate * 100)}
          icon={TrendingUp}
          tone="warning"
          format={(n) => `${n}%`}
          delay={0.1}
        />
        <StatCard label="NDA status" value={getLabel('ndaStatus', a.ndaStatus)} icon={FileSignature} tone="success" delay={0.15} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="introduced">Introduced ({introduced.length})</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents ({documents.length})</TabsTrigger>
          <TabsTrigger value="activities">Activities ({activities.length})</TabsTrigger>
          <TabsTrigger value="nda">NDA ({ndas.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Partnership profile</CardTitle>
                {a.description && <CardDescription>{a.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Fact icon={MapPin} label="Territory" value={a.meta.territory} />
                  <Fact icon={Handshake} label="Partner type" value={humanize(a.meta.agencyType)} />
                  <Fact
                    icon={Building2}
                    label="Cooperation model"
                    value={a.cooperationModel ? getLabel('cooperationModel', a.cooperationModel) : '—'}
                  />
                  <Fact icon={Users} label="Account owner" value={ownerName(a.accountOwnerId)} />
                  <Fact
                    icon={CalendarClock}
                    label="First contact"
                    value={`${formatDate(a.firstContact.date)} · ${getLabel('firstContactChannel', a.firstContact.channel)}`}
                  />
                  <Fact icon={Building2} label="Company size" value={a.size ? getLabel('companySize', a.size) : '—'} />
                </dl>

                <Separator />

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <Globe2 className="h-4 w-4 text-muted-foreground" />
                    Countries covered
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {a.meta.countriesCovered.map((c) => (
                      <Badge key={c} variant="outline" className="gap-1.5">
                        <span>{flagEmoji(countryCodeFor(c, a))}</span>
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>

                {a.tags && a.tags.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {a.tags.map((t) => (
                        <Badge key={t} variant="muted">
                          {humanize(t)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Partner metrics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MetricBar label="Conversion rate" value={a.meta.conversionRate * 100} display={pct(a.meta.conversionRate)} />
                  <MetricBar
                    label="Lead-to-intro ratio"
                    value={
                      a.meta.activeLeads + a.meta.companiesIntroducedIds.length > 0
                        ? (a.meta.companiesIntroducedIds.length /
                            (a.meta.activeLeads + a.meta.companiesIntroducedIds.length)) *
                          100
                        : 0
                    }
                    display={`${a.meta.companiesIntroducedIds.length} / ${
                      a.meta.activeLeads + a.meta.companiesIntroducedIds.length
                    }`}
                  />
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <MiniStat label="Introduced" value={a.meta.companiesIntroducedIds.length} />
                    <MiniStat label="Active leads" value={a.meta.activeLeads} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Agreement & NDA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Agreement</span>
                    <Badge variant={AGREEMENT_TONE[a.meta.agreementStatus]}>{AGREEMENT_LABEL[a.meta.agreementStatus]}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">NDA</span>
                    <StatusBadge kind="ndaStatus" value={a.ndaStatus} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Relationship</span>
                    <StatusBadge kind="relationshipStage" value={a.relationshipStage} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Priority</span>
                    <PriorityBadge value={a.priority} />
                  </div>
                </CardContent>
              </Card>

              {a.meta.nextAction && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Next action</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-medium">{a.meta.nextAction.label}</p>
                    {a.meta.nextAction.dueDate && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Due {formatDate(a.meta.nextAction.dueDate)} · {formatRelative(a.meta.nextAction.dueDate)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Introduced companies ── */}
        <TabsContent value="introduced">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Companies introduced</CardTitle>
              <CardDescription>Pipeline companies this partner brought to Proamina®.</CardDescription>
            </CardHeader>
            <CardContent>
              {introduced.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title="No companies introduced yet"
                  description="When this partner introduces a company, it will be linked here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>NDA</TableHead>
                      <TableHead className="text-right">Potential</TableHead>
                      <TableHead className="w-px" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {introduced.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => router.push('/admin/companies/' + c.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-2xs font-bold text-white"
                              style={{ backgroundColor: c.accentColor ?? '#0a1628' }}
                            >
                              {c.initials}
                            </span>
                            <span className="font-medium">{c.tradingName ?? c.legalName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span>{flagEmoji(c.countryCode)}</span>
                            {c.country}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="relationshipStage" value={c.relationshipStage} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="ndaStatus" value={c.ndaStatus} />
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {c.estimatedAnnualPotential
                            ? formatNumber(c.estimatedAnnualPotential) + ' ' + c.preferredCurrency
                            : '—'}
                        </TableCell>
                        <TableCell className="w-px text-right">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Contacts ── */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <EmptyState icon={Users} title="No contacts" description="No people are linked to this partner yet." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {contacts.map((c) => (
                    <div key={c.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {c.firstName} {c.lastName}
                          </p>
                          {c.jobTitle && <p className="truncate text-xs text-muted-foreground">{c.jobTitle}</p>}
                        </div>
                        {c.isPrimary && <Badge variant="gold">Primary</Badge>}
                      </div>
                      <div className="mt-3 space-y-1.5 text-sm">
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {c.email}
                        </a>
                        {c.phone && (
                          <p className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {c.phone}
                          </p>
                        )}
                      </div>
                      {c.decisionRole && (
                        <div className="mt-3">
                          <StatusBadge kind="decisionRole" value={c.decisionRole} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <EmptyState icon={FileText} title="No documents" description="No documents have been shared with this partner." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Access</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{d.name}</span>
                            <Badge variant="muted" className="uppercase">
                              {d.fileType}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="documentCategory" value={d.category} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="documentAccessLevel" value={d.accessLevel} />
                        </TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">
                          {d.sizeKb ? `${formatNumber(d.sizeKb)} KB` : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(d.uploadedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Activities ── */}
        <TabsContent value="activities">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <EmptyState icon={ActivityIcon} title="No activity" description="No activity has been logged for this partner yet." />
              ) : (
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {activities.map((act) => (
                    <li key={act.id} className="relative">
                      <span className="absolute -left-[1.625rem] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-card bg-brand-gold" />
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge kind="activityType" value={act.type} />
                        <span className="text-sm font-medium">{act.title}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{formatRelative(act.at)}</span>
                      </div>
                      {act.body && <p className="mt-1 text-sm text-muted-foreground">{act.body}</p>}
                      {act.byUserId && (
                        <p className="mt-1 text-xs text-muted-foreground">by {ownerName(act.byUserId)}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── NDA ── */}
        <TabsContent value="nda">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Non-disclosure agreements</CardTitle>
            </CardHeader>
            <CardContent>
              {ndas.length === 0 ? (
                <EmptyState
                  icon={FileSignature}
                  title="No NDA on record"
                  description="No NDA has been prepared for this partner yet."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Expiry</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ndas.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="font-medium">{n.reference}</TableCell>
                        <TableCell>
                          <StatusBadge kind="ndaType" value={n.type} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="ndaStatus" value={n.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(n.dateSent)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(n.expiryDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tasks ── */}
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <EmptyState icon={ListChecks} title="No tasks" description="No tasks are linked to this partner yet." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Due</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell>
                          <StatusBadge kind="taskType" value={t.type} />
                        </TableCell>
                        <TableCell className="text-sm">{ownerName(t.ownerId)}</TableCell>
                        <TableCell>
                          <PriorityBadge value={t.priority} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge kind="taskStatus" value={t.status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(t.dueDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── small presentational helpers ── */

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{value}</dd>
      </div>
    </div>
  );
}

function MetricBar({ label, value, display }: { label: string; value: number; display: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular">{display}</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <p className="text-lg font-bold tabular">{value}</p>
      <p className="text-2xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Best-effort flag for a covered country name (falls back to the partner HQ code). */
function countryCodeFor(name: string, a: Agency): string {
  if (name === a.country) return a.countryCode;
  const map: Record<string, string> = {
    'United Kingdom': 'GB',
    Ireland: 'IE',
    Spain: 'ES',
    Portugal: 'PT',
    Italy: 'IT',
    France: 'FR',
    Belgium: 'BE',
    Luxembourg: 'LU',
    Netherlands: 'NL',
    Germany: 'DE',
    Austria: 'AT',
    Switzerland: 'CH',
    'United States': 'US',
    Canada: 'CA',
    EU: 'EU',
  };
  return map[name] ?? a.countryCode;
}
