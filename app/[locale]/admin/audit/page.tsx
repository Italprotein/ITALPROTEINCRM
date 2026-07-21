'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ScrollText, CalendarClock, Users } from 'lucide-react';
import { activityService } from '@/lib/mock-services';
import type { Activity } from '@/lib/types';
import { humanize } from '@/lib/labels';
import { formatDateTime } from '@/lib/formatting';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';
const TODAY = new Date().toISOString().slice(0, 10);

interface AuditRow {
  id: string;
  at: string;
  actorId?: string;
  action: string;
  entity: string;
  summary: string;
}

export default function AuditPage() {
  const t = useTranslations('AdminAudit');
  const { nameOf, get } = useStaffDirectory();
  const [rows, setRows] = React.useState<AuditRow[] | null>(null);
  const [fActor, setFActor] = React.useState(ALL);
  const [fAction, setFAction] = React.useState(ALL);

  React.useEffect(() => {
    activityService.list().then((acts: Activity[]) => {
      const derived: AuditRow[] = acts.map((a) => ({
        id: 'au_' + a.id,
        at: a.at,
        actorId: a.byUserId,
        action: a.type,
        entity: a.relatedType ?? (a.companyId ? 'company' : 'system'),
        summary: a.title,
      }));
      setRows(derived.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime()));
    });
  }, []);

  const actorName = (id?: string) => {
    if (!id) return t('systemActor');
    return nameOf(id, humanize(id.replace('u_', '')));
  };

  const actors = React.useMemo(() => [...new Set((rows ?? []).map((r) => r.actorId).filter(Boolean) as string[])], [rows]);
  const actions = React.useMemo(() => [...new Set((rows ?? []).map((r) => r.action))], [rows]);

  const filtered = React.useMemo(() => {
    let d = rows ?? [];
    if (fActor !== ALL) d = d.filter((r) => r.actorId === fActor);
    if (fAction !== ALL) d = d.filter((r) => r.action === fAction);
    return d;
  }, [rows, fActor, fAction]);

  const stats = React.useMemo(() => {
    const all = rows ?? [];
    return {
      total: all.length,
      today: all.filter((r) => r.at.slice(0, 10) === TODAY).length,
      actors: new Set(all.map((r) => r.actorId).filter(Boolean)).size,
    };
  }, [rows]);

  const columns: Column<AuditRow>[] = [
    { key: 'at', header: t('colTimestamp'), sortable: true, sortValue: (r) => new Date(r.at).getTime(), cell: (r) => <span className="whitespace-nowrap text-sm tabular text-muted-foreground">{formatDateTime(r.at)}</span> },
    {
      key: 'actor', header: t('colActor'), sortValue: (r) => actorName(r.actorId),
      cell: (r) => {
        const role = get(r.actorId)?.role;
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{actorName(r.actorId)}</span>
            {role && <StatusBadge kind="role" value={role} />}
          </div>
        );
      },
    },
    { key: 'action', header: t('colAction'), sortValue: (r) => r.action, cell: (r) => <Badge variant="secondary" className="font-mono text-2xs">{r.action}</Badge> },
    { key: 'entity', header: t('colEntity'), sortValue: (r) => r.entity, cell: (r) => <span className="text-sm capitalize text-muted-foreground">{r.entity.replace(/_/g, ' ')}</span>, hideable: true },
    { key: 'summary', header: t('colSummary'), cell: (r) => <span className="text-sm">{r.summary}</span> },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fActor} onValueChange={setFActor}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder={t('filterActorPlaceholder')} /></SelectTrigger>
        <SelectContent><SelectItem value={ALL}>{t('allActors')}</SelectItem>{actors.map((a) => <SelectItem key={a} value={a}>{actorName(a)}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={fAction} onValueChange={setFAction}>
        <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder={t('filterActionPlaceholder')} /></SelectTrigger>
        <SelectContent><SelectItem value={ALL}>{t('allActions')}</SelectItem>{actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('statTotalEvents')} value={stats.total} icon={ScrollText} tone="gold" />
        <StatCard label={t('statEventsToday')} value={stats.today} icon={CalendarClock} tone="info" delay={0.05} />
        <StatCard label={t('statDistinctActors')} value={stats.actors} icon={Users} tone="success" delay={0.1} />
      </div>

      <DataTable<AuditRow>
        data={filtered} columns={columns} getRowId={(r) => r.id} loading={rows === null}
        searchable searchPlaceholder={t('searchPlaceholder')} searchValue={(r) => `${actorName(r.actorId)} ${r.action} ${r.entity} ${r.summary}`}
        pageSize={15} toolbar={toolbar} enableColumnVisibility enableDensityToggle
        emptyTitle={t('emptyTitle')} exportFilename="audit-log" storageKey="audit-table"
      />
    </div>
  );
}
