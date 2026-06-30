'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Users,
  Star,
  FlaskConical,
  Briefcase,
  Plus,
  Mail,
  Phone,
  Building2,
  CheckSquare,
  ExternalLink,
  MoreHorizontal,
  Truck,
  Banknote,
  Scale,
  ClipboardList,
  Smartphone,
  Linkedin,
  StickyNote,
} from 'lucide-react';
import { contactService, companyService, authService } from '@/lib/mock-services';
import type { Contact, Company, DecisionRole } from '@/lib/types';
import { Link, useRouter } from '@/lib/i18n/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard, DonutChart, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { formatRelative, formatDate } from '@/lib/formatting';
import { getLabel } from '@/lib/labels';
import { cn, initials, uid } from '@/lib/utils';

/* ────────────────────────────── helpers ────────────────────────────── */

const DECISION_ROLES: DecisionRole[] = [
  'decision_maker',
  'influencer',
  'gatekeeper',
  'champion',
  'user',
  'unknown',
];

const AVATAR_TONES = [
  'bg-brand-navy/10 text-brand-navy',
  'bg-brand-gold/15 text-brand-goldDark',
  'bg-info-subtle text-info',
  'bg-success-subtle text-success',
  'bg-warning-subtle text-warning-foreground',
  'bg-danger-subtle text-danger',
];

function avatarTone(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

const fullName = (c: Contact) => `${c.firstName} ${c.lastName}`.trim();

type RoleFlag = 'all' | 'primary' | 'technical' | 'commercial' | 'logistics' | 'finance' | 'legal';

const ROLE_FLAG_VALUES: RoleFlag[] = [
  'all',
  'primary',
  'technical',
  'commercial',
  'logistics',
  'finance',
  'legal',
];

const ROLE_FLAG_LABEL_KEYS: Record<RoleFlag, string> = {
  all: 'roleAll',
  primary: 'rolePrimary',
  technical: 'roleTechnical',
  commercial: 'roleCommercial',
  logistics: 'roleLogistics',
  finance: 'roleFinance',
  legal: 'roleLegal',
};

function matchesFlag(c: Contact, flag: RoleFlag): boolean {
  switch (flag) {
    case 'primary':
      return !!c.isPrimary;
    case 'technical':
      return !!c.isTechnical;
    case 'commercial':
      return !!c.isCommercial;
    case 'logistics':
      return !!c.isLogistics;
    case 'finance':
      return !!c.isFinance;
    case 'legal':
      return !!c.isLegal;
    default:
      return true;
  }
}

/** Small inline flag chips (primary star / technical / logistics / finance / legal). */
function FlagChips({ c, className }: { c: Contact; className?: string }) {
  const t = useTranslations('AdminContacts');
  const chips: { key: string; label: string; tone: string; icon: React.ReactNode }[] = [];
  if (c.isPrimary)
    chips.push({
      key: 'primary',
      label: t('rolePrimary'),
      tone: 'bg-brand-gold/15 text-brand-goldDark',
      icon: <Star className="h-3 w-3 fill-current" />,
    });
  if (c.isTechnical)
    chips.push({
      key: 'tech',
      label: t('roleTechnical'),
      tone: 'bg-info-subtle text-info',
      icon: <FlaskConical className="h-3 w-3" />,
    });
  if (c.isCommercial)
    chips.push({
      key: 'comm',
      label: t('roleCommercial'),
      tone: 'bg-success-subtle text-success',
      icon: <Briefcase className="h-3 w-3" />,
    });
  if (c.isLogistics)
    chips.push({
      key: 'logi',
      label: t('roleLogistics'),
      tone: 'bg-warning-subtle text-warning-foreground',
      icon: <Truck className="h-3 w-3" />,
    });
  if (c.isFinance)
    chips.push({
      key: 'fin',
      label: t('roleFinance'),
      tone: 'bg-brand-navy/10 text-brand-navy',
      icon: <Banknote className="h-3 w-3" />,
    });
  if (c.isLegal)
    chips.push({
      key: 'legal',
      label: t('roleLegal'),
      tone: 'bg-danger-subtle text-danger',
      icon: <Scale className="h-3 w-3" />,
    });

  if (chips.length === 0)
    return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {chips.map((chip) => (
        <span
          key={chip.key}
          title={chip.label}
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-semibold',
            chip.tone,
          )}
        >
          {chip.icon}
          <span className="hidden sm:inline">{chip.label}</span>
        </span>
      ))}
    </div>
  );
}

function ContactAvatar({ c, size = 'h-9 w-9' }: { c: Contact; size?: string }) {
  return (
    <Avatar className={size}>
      <AvatarFallback className={cn('font-semibold', avatarTone(c.id))}>
        {initials(fullName(c))}
      </AvatarFallback>
    </Avatar>
  );
}

/* ────────────────────────────── page ────────────────────────────── */

export default function ContactsPage({ params }: { params: { locale: string } }) {
  const locale = params.locale as 'en' | 'it';
  const router = useRouter();
  const t = useTranslations('AdminContacts');

  const [contacts, setContacts] = React.useState<Contact[] | null>(null);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [stats, setStats] = React.useState<{
    total: number;
    primary: number;
    technical: number;
    commercial: number;
  } | null>(null);

  // filters
  const [companyFilter, setCompanyFilter] = React.useState<string>('all');
  const [roleFilter, setRoleFilter] = React.useState<RoleFlag>('all');

  // drawer
  const [active, setActive] = React.useState<Contact | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // add dialog
  const [addOpen, setAddOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    firstName: '',
    lastName: '',
    companyId: '',
    jobTitle: '',
    department: '',
    email: '',
    phone: '',
    decisionRole: 'unknown' as DecisionRole,
  });

  const load = React.useCallback(() => {
    Promise.all([contactService.list(), companyService.list(), contactService.getStatistics()]).then(
      ([cts, cos, st]) => {
        setContacts(cts);
        setCompanies(cos);
        setStats(st);
      },
    );
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const companyMap = React.useMemo(() => {
    const m = new Map<string, Company>();
    for (const co of companies) m.set(co.id, co);
    return m;
  }, [companies]);

  const companyName = React.useCallback(
    (id: string) => {
      const co = companyMap.get(id);
      return co ? co.tradingName ?? co.legalName : t('unknownCompany');
    },
    [companyMap, t],
  );

  const ownerName = React.useCallback((id?: string) => {
    if (!id) return null;
    const a = authService.getAccount(id);
    return a ? `${a.firstName} ${a.lastName}` : null;
  }, []);

  // companies that actually have contacts, sorted by name (for the filter dropdown)
  const companyOptions = React.useMemo(() => {
    if (!contacts) return [];
    const ids = new Set(contacts.map((c) => c.companyId));
    return Array.from(ids)
      .map((id) => ({ id, name: companyName(id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [contacts, companyName]);

  // donut: contacts by decision role
  const roleDistribution = React.useMemo(() => {
    if (!contacts) return [];
    const counts = new Map<string, number>();
    for (const c of contacts) {
      const key = c.decisionRole ?? 'unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return DECISION_ROLES.filter((r) => counts.has(r)).map((r, i) => ({
      name: getLabel('decisionRole', r),
      value: counts.get(r) ?? 0,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [contacts]);

  // apply filters
  const filtered = React.useMemo(() => {
    if (!contacts) return [];
    return contacts.filter(
      (c) =>
        (companyFilter === 'all' || c.companyId === companyFilter) &&
        matchesFlag(c, roleFilter),
    );
  }, [contacts, companyFilter, roleFilter]);

  /* ── actions ── */

  function openContact(c: Contact) {
    setActive(c);
    setDrawerOpen(true);
  }

  function emailContact(c: Contact) {
    window.location.href = `mailto:${c.email}`;
    toast({
      title: t('toastEmailTitle'),
      description: t('toastEmailDescription', { name: fullName(c) }),
      variant: 'info',
    });
  }

  async function createTaskFor(c: Contact) {
    await new Promise((r) => setTimeout(r, 500));
    toast({
      title: t('toastTaskTitle'),
      description: t('toastTaskDescription', {
        name: fullName(c),
        company: companyName(c.companyId),
      }),
      variant: 'success',
    });
  }

  function openCompany(c: Contact) {
    router.push(`/admin/companies/${c.companyId}`);
  }

  async function logActivity(c: Contact) {
    await new Promise((r) => setTimeout(r, 500));
    toast({
      title: t('toastActivityTitle'),
      description: t('toastActivityDescription', { name: fullName(c) }),
      variant: 'success',
    });
  }

  const canSubmit =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.email.trim() &&
    form.companyId;

  async function submitContact() {
    if (!canSubmit) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    const now = new Date().toISOString();
    const newContact: Contact = {
      id: uid('contact'),
      companyId: form.companyId,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      jobTitle: form.jobTitle.trim() || undefined,
      department: form.department.trim() || undefined,
      decisionRole: form.decisionRole,
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      isPrimary: false,
      lastContactAt: now,
      createdAt: now,
    };
    await contactService.create(newContact);
    setSaving(false);
    setAddOpen(false);
    setForm({
      firstName: '',
      lastName: '',
      companyId: '',
      jobTitle: '',
      department: '',
      email: '',
      phone: '',
      decisionRole: 'unknown',
    });
    load();
    toast({
      title: t('toastContactAddedTitle'),
      description: t('toastContactAddedDescription', {
        name: `${newContact.firstName} ${newContact.lastName}`,
        company: companyName(newContact.companyId),
      }),
      variant: 'success',
    });
  }

  /* ── table columns ── */

  const columns: Column<Contact>[] = [
    {
      key: 'name',
      header: t('colName'),
      sortable: true,
      sortValue: (c) => fullName(c).toLowerCase(),
      cell: (c) => (
        <div className="flex items-center gap-3">
          <ContactAvatar c={c} />
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{fullName(c)}</div>
            <div className="mt-0.5">
              <StatusBadge kind="decisionRole" value={c.decisionRole ?? 'unknown'} />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      header: t('colCompany'),
      sortable: true,
      sortValue: (c) => companyName(c.companyId).toLowerCase(),
      cell: (c) => (
        <Link
          href={`/admin/companies/${c.companyId}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-[180px] items-center gap-1.5 truncate font-medium text-brand-navy underline-offset-2 hover:underline dark:text-info"
        >
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{companyName(c.companyId)}</span>
        </Link>
      ),
    },
    {
      key: 'jobTitle',
      header: t('colJobTitle'),
      sortable: true,
      sortValue: (c) => c.jobTitle ?? '',
      cell: (c) => <span className="text-sm">{c.jobTitle ?? '—'}</span>,
    },
    {
      key: 'department',
      header: t('colDepartment'),
      hideable: true,
      sortValue: (c) => c.department ?? '',
      cell: (c) => <span className="text-sm text-muted-foreground">{c.department ?? '—'}</span>,
    },
    {
      key: 'email',
      header: t('colEmail'),
      sortValue: (c) => c.email,
      cell: (c) => (
        <a
          href={`mailto:${c.email}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-[200px] items-center gap-1.5 truncate text-sm text-brand-navy underline-offset-2 hover:underline dark:text-info"
        >
          <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{c.email}</span>
        </a>
      ),
    },
    {
      key: 'phone',
      header: t('colPhone'),
      hideable: true,
      sortValue: (c) => c.phone ?? '',
      cell: (c) =>
        c.phone ? (
          <a
            href={`tel:${c.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-sm text-foreground underline-offset-2 hover:underline"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="tabular">{c.phone}</span>
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: 'flags',
      header: t('colFlags'),
      cell: (c) => <FlagChips c={c} />,
    },
    {
      key: 'lastContact',
      header: t('colLastContact'),
      align: 'right',
      sortable: true,
      sortValue: (c) => (c.lastContactAt ? new Date(c.lastContactAt).getTime() : 0),
      cell: (c) => (
        <span className="text-sm text-muted-foreground">
          {c.lastContactAt ? formatRelative(c.lastContactAt, locale) : '—'}
        </span>
      ),
    },
  ];

  const rowActions = (c: Contact) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('rowActions')}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{fullName(c)}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => emailContact(c)}>
          <Mail className="h-4 w-4" /> {t('email')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => createTaskFor(c)}>
          <CheckSquare className="h-4 w-4" /> {t('createTask')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openCompany(c)}>
          <ExternalLink className="h-4 w-4" /> {t('openCompany')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const mobileCard = (c: Contact) => (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <ContactAvatar c={c} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{fullName(c)}</div>
              <div className="truncate text-xs text-muted-foreground">{c.jobTitle ?? '—'}</div>
            </div>
            <StatusBadge kind="decisionRole" value={c.decisionRole ?? 'unknown'} />
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{companyName(c.companyId)}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{c.email}</span>
          </div>
          <div className="mt-2">
            <FlagChips c={c} />
          </div>
          <div className="mt-2 text-2xs text-muted-foreground">
            {t('lastContactLabel')} {c.lastContactAt ? formatRelative(c.lastContactAt, locale) : '—'}
          </div>
        </div>
      </div>
    </div>
  );

  const tableToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={companyFilter} onValueChange={setCompanyFilter}>
        <SelectTrigger className="h-9 w-[200px]">
          <SelectValue placeholder={t('companyPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('allCompanies')}</SelectItem>
          {companyOptions.map((co) => (
            <SelectItem key={co.id} value={co.id}>
              {co.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFlag)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder={t('rolePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {ROLE_FLAG_VALUES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(ROLE_FLAG_LABEL_KEYS[value])}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        actions={
          <Button variant="gold" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> {t('addContact')}
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t('statTotalLabel')}
          value={stats?.total ?? 0}
          icon={Users}
          tone="gold"
          hint={t('statTotalHint')}
        />
        <StatCard
          label={t('rolePrimary')}
          value={stats?.primary ?? 0}
          icon={Star}
          tone="info"
          hint={t('statPrimaryHint')}
          delay={0.05}
        />
        <StatCard
          label={t('roleTechnical')}
          value={stats?.technical ?? 0}
          icon={FlaskConical}
          tone="success"
          hint={t('statTechnicalHint')}
          delay={0.1}
        />
        <StatCard
          label={t('roleCommercial')}
          value={stats?.commercial ?? 0}
          icon={Briefcase}
          tone="warning"
          hint={t('statCommercialHint')}
          delay={0.15}
        />
      </div>

      {/* Chart */}
      <ChartCard
        title={t('chartTitle')}
        description={t('chartDescription')}
        loading={contacts === null}
        isEmpty={roleDistribution.length === 0}
        height={260}
      >
        <DonutChart data={roleDistribution} centerLabel={t('chartCenterLabel')} height={260} />
      </ChartCard>

      {/* Table */}
      <DataTable<Contact>
        data={filtered}
        columns={columns}
        getRowId={(c) => c.id}
        loading={contacts === null}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchValue={(c) =>
          `${fullName(c)} ${c.email} ${c.jobTitle ?? ''} ${c.department ?? ''} ${companyName(
            c.companyId,
          )}`
        }
        toolbar={tableToolbar}
        rowActions={rowActions}
        onRowClick={openContact}
        mobileCard={mobileCard}
        enableColumnVisibility
        enableDensityToggle
        exportFilename="contacts"
        storageKey="contacts"
        pageSize={10}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
      />

      {/* ── Detail drawer ── */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="max-w-md overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <ContactAvatar c={active} size="h-12 w-12" />
                  <div className="min-w-0">
                    <SheetTitle className="truncate">{fullName(active)}</SheetTitle>
                    <SheetDescription className="truncate">
                      {active.jobTitle ?? t('contact')} · {companyName(active.companyId)}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge kind="decisionRole" value={active.decisionRole ?? 'unknown'} />
                <FlagChips c={active} />
              </div>

              <Separator />

              <div className="space-y-4 text-sm">
                <DetailRow icon={Building2} label={t('detailCompany')}>
                  <Link
                    href={`/admin/companies/${active.companyId}`}
                    className="font-medium text-brand-navy underline-offset-2 hover:underline dark:text-info"
                  >
                    {companyName(active.companyId)}
                  </Link>
                </DetailRow>

                <DetailRow icon={Mail} label={t('detailEmail')}>
                  <a
                    href={`mailto:${active.email}`}
                    className="break-all text-brand-navy underline-offset-2 hover:underline dark:text-info"
                  >
                    {active.email}
                  </a>
                </DetailRow>

                {active.secondaryEmail && (
                  <DetailRow icon={Mail} label={t('detailSecondaryEmail')}>
                    <a
                      href={`mailto:${active.secondaryEmail}`}
                      className="break-all text-brand-navy underline-offset-2 hover:underline dark:text-info"
                    >
                      {active.secondaryEmail}
                    </a>
                  </DetailRow>
                )}

                {active.phone && (
                  <DetailRow icon={Phone} label={t('detailPhone')}>
                    <a href={`tel:${active.phone}`} className="tabular hover:underline">
                      {active.phone}
                    </a>
                  </DetailRow>
                )}

                {active.mobile && (
                  <DetailRow icon={Smartphone} label={t('detailMobile')}>
                    <a href={`tel:${active.mobile}`} className="tabular hover:underline">
                      {active.mobile}
                    </a>
                  </DetailRow>
                )}

                {active.department && (
                  <DetailRow icon={ClipboardList} label={t('detailDepartment')}>
                    {active.department}
                  </DetailRow>
                )}

                {active.businessRole && (
                  <DetailRow icon={Briefcase} label={t('detailBusinessRole')}>
                    {active.businessRole}
                  </DetailRow>
                )}

                {active.linkedin && (
                  <DetailRow icon={Linkedin} label={t('detailLinkedin')}>
                    <a
                      href={active.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-brand-navy underline-offset-2 hover:underline dark:text-info"
                    >
                      {t('viewProfile')}
                    </a>
                  </DetailRow>
                )}

                {ownerName(active.ownerId) && (
                  <DetailRow icon={Users} label={t('detailOwner')}>
                    {ownerName(active.ownerId)}
                  </DetailRow>
                )}

                {active.preferredLanguage && (
                  <DetailRow icon={ClipboardList} label={t('detailPreferredLanguage')}>
                    {active.preferredLanguage === 'it' ? t('languageItalian') : t('languageEnglish')}
                  </DetailRow>
                )}

                <DetailRow icon={ClipboardList} label={t('detailLastContact')}>
                  {active.lastContactAt
                    ? `${formatDate(active.lastContactAt, locale)} (${formatRelative(
                        active.lastContactAt,
                        locale,
                      )})`
                    : '—'}
                </DetailRow>

                {active.nextAction && (
                  <DetailRow icon={CheckSquare} label={t('detailNextAction')}>
                    {active.nextAction.label}
                    {active.nextAction.dueDate
                      ? ` · ${t('dueDate', { date: formatDate(active.nextAction.dueDate, locale) })}`
                      : ''}
                  </DetailRow>
                )}

                {active.notes && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <StickyNote className="h-3.5 w-3.5" /> {t('notes')}
                    </div>
                    <p className="text-sm text-foreground">{active.notes}</p>
                  </div>
                )}

                <DetailRow icon={ClipboardList} label={t('detailCreated')}>
                  {formatDate(active.createdAt, locale)}
                </DetailRow>
              </div>

              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => active && emailContact(active)}
                  className="flex-1"
                >
                  <Mail className="h-4 w-4" /> {t('email')}
                </Button>
                <Button
                  variant="gold"
                  onClick={() => active && logActivity(active)}
                  className="flex-1"
                >
                  <ClipboardList className="h-4 w-4" /> {t('logActivity')}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add contact dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('addContact')}</DialogTitle>
            <DialogDescription>{t('addContactDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-first">{t('firstNameLabel')}</Label>
                <Input
                  id="c-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  placeholder={t('firstNamePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-last">{t('lastNameLabel')}</Label>
                <Input
                  id="c-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  placeholder={t('lastNamePlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t('companyLabel')}</Label>
              <Select
                value={form.companyId}
                onValueChange={(v) => setForm((f) => ({ ...f, companyId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectCompanyPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {[...companies]
                    .sort((a, b) =>
                      (a.tradingName ?? a.legalName).localeCompare(b.tradingName ?? b.legalName),
                    )
                    .map((co) => (
                      <SelectItem key={co.id} value={co.id}>
                        {co.tradingName ?? co.legalName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="c-email">{t('emailLabel')}</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t('emailPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-job">{t('jobTitleLabel')}</Label>
                <Input
                  id="c-job"
                  value={form.jobTitle}
                  onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
                  placeholder={t('jobTitlePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-dept">{t('departmentLabel')}</Label>
                <Input
                  id="c-dept"
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  placeholder={t('departmentPlaceholder')}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">{t('phoneLabel')}</Label>
                <Input
                  id="c-phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder={t('phonePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('decisionRoleLabel')}</Label>
                <Select
                  value={form.decisionRole}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, decisionRole: v as DecisionRole }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECISION_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {getLabel('decisionRole', r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              {t('cancel')}
            </Button>
            <Button variant="gold" onClick={submitContact} disabled={!canSubmit || saving}>
              {saving ? t('saving') : t('addContact')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ────────────────────────────── small bits ────────────────────────────── */

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 break-words text-foreground">{children}</div>
      </div>
    </div>
  );
}
