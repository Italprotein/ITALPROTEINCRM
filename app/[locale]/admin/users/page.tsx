'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { UserCog, UserCheck, MailPlus, Briefcase, MoreHorizontal, Shield, Ban, RefreshCw, Plus } from 'lucide-react';
import { userService, companyService } from '@/lib/mock-services';
import type { Company, InternalRole } from '@/lib/types';
import type { StaffMember } from '@/fixtures/staff';
import { getLabel } from '@/lib/labels';
import { PERMISSIONS, INTERNAL_SECTIONS, type InternalSection } from '@/lib/permissions';
import { formatRelative } from '@/lib/formatting';
import { initials } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ChartCard, DonutChart, CHART_COLORS } from '@/components/charts/chart-kit';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';

const ROLES: InternalRole[] = ['super_admin', 'crm_admin', 'business_dev', 'rnd_technical', 'logistics', 'finance', 'management_readonly'];
const statusBadge: Record<StaffMember['status'], 'success' | 'info' | 'muted'> = { active: 'success', invited: 'info', suspended: 'muted' };

export default function UsersPage() {
  const t = useTranslations('AdminUsers');
  const [rows, setRows] = React.useState<StaffMember[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof userService.getStatistics>> | null>(null);
  const [permRole, setPermRole] = React.useState<StaffMember | null>(null);

  React.useEffect(() => {
    userService.list().then(setRows);
    userService.getStatistics().then(setStats);
    companyService.list().then((l) => setCompanyMap(new Map(l.map((c) => [c.id, c]))));
  }, []);

  const roleDonut = React.useMemo(() => {
    if (!stats) return [];
    return (Object.entries(stats.byRole) as [InternalRole, number][])
      .filter(([, v]) => v > 0)
      .map(([k, v], i) => ({ name: getLabel('role', k), value: v, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [stats]);

  function setStatus(u: StaffMember, status: StaffMember['status']) {
    setRows((prev) => prev ? prev.map((x) => x.id === u.id ? { ...x, status } : x) : prev);
    void userService.update(u.id, { status });
    toast({ variant: status === 'suspended' ? 'warning' : 'success', title: status === 'suspended' ? t('userSuspendedTitle') : t('userActivatedTitle'), description: `${u.firstName} ${u.lastName}` });
  }
  function setRole(u: StaffMember, role: InternalRole) {
    setRows((prev) => prev ? prev.map((x) => x.id === u.id ? { ...x, role } : x) : prev);
    void userService.update(u.id, { role });
    toast({ variant: 'success', title: t('roleUpdatedTitle'), description: `${u.firstName} ${u.lastName} → ${getLabel('role', role)}` });
  }

  const columns: Column<StaffMember>[] = [
    {
      key: 'name', header: t('colName'), sortValue: (u) => u.lastName,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9"><AvatarFallback style={{ backgroundColor: u.avatarColor, color: '#fff' }} className="text-2xs">{initials(`${u.firstName} ${u.lastName}`)}</AvatarFallback></Avatar>
          <div className="min-w-0"><p className="truncate font-medium text-foreground">{u.firstName} {u.lastName}</p><p className="truncate text-xs text-muted-foreground">{u.email}</p></div>
        </div>
      ),
    },
    { key: 'role', header: t('colRole'), sortValue: (u) => u.role, cell: (u) => <StatusBadge kind="role" value={u.role} /> },
    { key: 'jobTitle', header: t('colJobTitle'), sortValue: (u) => u.jobTitle, cell: (u) => <span className="text-sm">{u.jobTitle}</span>, hideable: true },
    { key: 'status', header: t('colStatus'), sortValue: (u) => u.status, cell: (u) => <Badge variant={statusBadge[u.status]}>{u.status[0].toUpperCase() + u.status.slice(1)}</Badge> },
    { key: 'lastActive', header: t('colLastActive'), align: 'right', sortable: true, sortValue: (u) => new Date(u.lastActiveAt).getTime(), cell: (u) => <span className="whitespace-nowrap text-sm text-muted-foreground">{formatRelative(u.lastActiveAt)}</span>, hideable: true },
    {
      key: 'companies', header: t('colCompanies'), align: 'right', sortValue: (u) => u.assignedCompanyIds.length,
      cell: (u) => u.assignedCompanyIds.length === 0 ? <span className="text-sm text-muted-foreground">—</span> : (
        <Popover>
          <PopoverTrigger asChild><Button variant="ghost" size="sm" className="tabular" onClick={(e) => e.stopPropagation()}>{u.assignedCompanyIds.length}</Button></PopoverTrigger>
          <PopoverContent align="end" className="w-56">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">{t('assignedCompanies')}</p>
            <ul className="space-y-0.5 text-sm">{u.assignedCompanyIds.map((id) => <li key={id} className="truncate">{companyMap.get(id)?.tradingName ?? companyMap.get(id)?.legalName ?? id}</li>)}</ul>
          </PopoverContent>
        </Popover>
      ),
      hideable: true,
    },
  ];

  function rowActions(u: StaffMember) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t('actionsLabel')}><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setPermRole(u)}><Shield /> {t('viewPermissions')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          {u.status !== 'suspended'
            ? <DropdownMenuItem onSelect={() => setStatus(u, 'suspended')} className="text-danger focus:text-danger"><Ban /> {t('suspend')}</DropdownMenuItem>
            : <DropdownMenuItem onSelect={() => setStatus(u, 'active')}><RefreshCw /> {t('activate')}</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function mobileCard(u: StaffMember) {
    return (
      <Card className="p-3" onClick={() => setPermRole(u)}>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9"><AvatarFallback style={{ backgroundColor: u.avatarColor, color: '#fff' }} className="text-2xs">{initials(`${u.firstName} ${u.lastName}`)}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{u.firstName} {u.lastName}</p><p className="truncate text-xs text-muted-foreground">{u.jobTitle}</p></div>
          <Badge variant={statusBadge[u.status]}>{u.status}</Badge>
        </div>
        <div className="mt-2 flex items-center justify-between"><StatusBadge kind="role" value={u.role} /><span className="text-xs text-muted-foreground">{formatRelative(u.lastActiveAt)}</span></div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={<Button variant="gold" onClick={() => toast({ title: t('inviteSentTitle'), description: t('inviteSentDescription'), variant: 'success' })}><Plus /> {t('inviteUser')}</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('statTotalStaff')} value={stats?.total ?? 0} icon={UserCog} tone="gold" />
        <StatCard label={t('statActive')} value={stats?.active ?? 0} icon={UserCheck} tone="success" delay={0.05} />
        <StatCard label={t('statInvited')} value={stats?.invited ?? 0} icon={MailPlus} tone="info" delay={0.1} />
        <StatCard label={t('statBusinessDevelopers')} value={stats?.byRole?.business_dev ?? 0} icon={Briefcase} tone="warning" delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={t('staffByRole')} description={t('teamComposition')} loading={rows === null} isEmpty={roleDonut.length === 0}>
          <DonutChart data={roleDonut} centerLabel={t('donutCenterLabel')} />
        </ChartCard>

        <div className="lg:col-span-2">
          <DataTable<StaffMember>
            data={rows ?? []} columns={columns} getRowId={(u) => u.id} loading={rows === null}
            searchable searchPlaceholder={t('searchPlaceholder')} searchValue={(u) => `${u.firstName} ${u.lastName} ${u.email} ${u.jobTitle}`}
            pageSize={10} rowActions={rowActions} onRowClick={(u) => setPermRole(u)} mobileCard={mobileCard}
            enableColumnVisibility emptyTitle={t('emptyTitle')} exportFilename="staff" storageKey="users-table"
          />
        </div>
      </div>

      {/* Permission overview */}
      <Card>
        <CardHeader>
          <CardTitle>{t('permissionOverview')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('permissionOverviewDescription')}</p>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((r) => {
            const p = PERMISSIONS[r];
            const full = INTERNAL_SECTIONS.filter((s) => p.sections[s] === 'full').length;
            const edit = INTERNAL_SECTIONS.filter((s) => p.sections[s] === 'edit').length;
            const view = INTERNAL_SECTIONS.filter((s) => p.sections[s] === 'view').length;
            return (
              <div key={r} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between"><StatusBadge kind="role" value={r} /><span className="text-2xs text-muted-foreground">{t('actionsCount', { count: p.actions.length })}</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-2xs">
                  <Badge variant="success">{t('fullCount', { count: full })}</Badge>
                  <Badge variant="info">{t('editCount', { count: edit })}</Badge>
                  <Badge variant="muted">{t('viewCount', { count: view })}</Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Permissions detail sheet */}
      <Sheet open={!!permRole} onOpenChange={(o) => !o && setPermRole(null)}>
        <SheetContent side="right" className="max-w-md overflow-y-auto">
          {permRole && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11"><AvatarFallback style={{ backgroundColor: permRole.avatarColor, color: '#fff' }}>{initials(`${permRole.firstName} ${permRole.lastName}`)}</AvatarFallback></Avatar>
                  <div><SheetTitle>{permRole.firstName} {permRole.lastName}</SheetTitle><SheetDescription>{permRole.jobTitle} · {permRole.email}</SheetDescription></div>
                </div>
              </SheetHeader>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('roleLabel')}</label>
                <Select value={permRole.role} onValueChange={(v) => { setRole(permRole, v as InternalRole); setPermRole({ ...permRole, role: v as InternalRole }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{getLabel('role', r)}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">{t('sectionAccess')}</p>
                <div className="space-y-1">
                  {INTERNAL_SECTIONS.map((s) => {
                    const lvl = PERMISSIONS[permRole.role].sections[s as InternalSection] ?? 'hidden';
                    const tone = lvl === 'full' ? 'success' : lvl === 'edit' ? 'info' : lvl === 'view' ? 'muted' : 'outline';
                    return (
                      <div key={s} className="flex items-center justify-between rounded-md px-2 py-1 text-sm odd:bg-muted/40">
                        <span className="capitalize">{s.replace(/_/g, ' ')}</span>
                        <Badge variant={tone as 'success' | 'info' | 'muted' | 'outline'}>{lvl}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">{t('allowedActions', { count: PERMISSIONS[permRole.role].actions.length })}</p>
                <div className="flex flex-wrap gap-1.5">
                  {PERMISSIONS[permRole.role].actions.map((a) => <Badge key={a} variant="secondary" className="font-mono text-2xs">{a}</Badge>)}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
