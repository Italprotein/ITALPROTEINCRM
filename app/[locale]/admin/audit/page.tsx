'use client';

import * as React from 'react';
import { ScrollText, CalendarClock, Users } from 'lucide-react';
import { activityService, authService } from '@/lib/mock-services';
import type { Activity } from '@/lib/types';
import { humanize } from '@/lib/labels';
import { formatDateTime } from '@/lib/formatting';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = '__all__';
const TODAY = '2026-06-17';

interface AuditRow {
  id: string;
  at: string;
  actorId?: string;
  actorRole?: string;
  action: string;
  entity: string;
  summary: string;
}

/** Stable synthetic configuration-change events (not derived from activities). */
const CONFIG_EVENTS: AuditRow[] = [
  { id: 'au_cfg_1', at: '2026-06-16T16:42:00Z', actorId: 'u_admin', actorRole: 'super_admin', action: 'user.role_change', entity: 'user', summary: 'Changed Marco Riva role → Logistics' },
  { id: 'au_cfg_2', at: '2026-06-15T09:10:00Z', actorId: 'u_medamine', actorRole: 'crm_admin', action: 'settings.update', entity: 'settings', summary: 'Updated default currency to EUR' },
  { id: 'au_cfg_3', at: '2026-06-12T11:25:00Z', actorId: 'u_admin', actorRole: 'super_admin', action: 'nda.template_update', entity: 'nda_template', summary: 'Published mutual NDA template v2.3' },
  { id: 'au_cfg_4', at: '2026-06-10T14:05:00Z', actorId: 'u_simone', actorRole: 'crm_admin', action: 'data.export', entity: 'companies', summary: 'Exported companies list (CSV)' },
  { id: 'au_cfg_5', at: '2026-06-08T08:50:00Z', actorId: 'u_admin', actorRole: 'super_admin', action: 'user.invite', entity: 'user', summary: 'Invited new Legal counsel account' },
  { id: 'au_cfg_6', at: '2026-06-05T17:30:00Z', actorId: 'u_medamine', actorRole: 'crm_admin', action: 'permission.update', entity: 'role', summary: 'Granted Finance read access to Analytics' },
];

export default function AuditPage() {
  const [rows, setRows] = React.useState<AuditRow[] | null>(null);
  const [fActor, setFActor] = React.useState(ALL);
  const [fAction, setFAction] = React.useState(ALL);

  React.useEffect(() => {
    activityService.list().then((acts: Activity[]) => {
      const derived: AuditRow[] = acts.map((a) => {
        const acc = a.byUserId ? authService.getAccount(a.byUserId) : null;
        return {
          id: 'au_' + a.id,
          at: a.at,
          actorId: a.byUserId,
          actorRole: acc?.role,
          action: a.type,
          entity: a.relatedType ?? (a.companyId ? 'company' : 'system'),
          summary: a.title,
        };
      });
      setRows([...CONFIG_EVENTS, ...derived].sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime()));
    });
  }, []);

  const actorName = (id?: string) => {
    if (!id) return 'System';
    const a = authService.getAccount(id);
    return a ? `${a.firstName} ${a.lastName}` : humanize(id.replace('u_', ''));
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
    { key: 'at', header: 'Timestamp', sortable: true, sortValue: (r) => new Date(r.at).getTime(), cell: (r) => <span className="whitespace-nowrap text-sm tabular text-muted-foreground">{formatDateTime(r.at)}</span> },
    {
      key: 'actor', header: 'Actor', sortValue: (r) => actorName(r.actorId),
      cell: (r) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{actorName(r.actorId)}</span>
          {r.actorRole && <StatusBadge kind="role" value={r.actorRole} />}
        </div>
      ),
    },
    { key: 'action', header: 'Action', sortValue: (r) => r.action, cell: (r) => <Badge variant="secondary" className="font-mono text-2xs">{r.action}</Badge> },
    { key: 'entity', header: 'Entity', sortValue: (r) => r.entity, cell: (r) => <span className="text-sm capitalize text-muted-foreground">{r.entity.replace(/_/g, ' ')}</span>, hideable: true },
    { key: 'summary', header: 'Summary', cell: (r) => <span className="text-sm">{r.summary}</span> },
  ];

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={fActor} onValueChange={setFActor}>
        <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Actor" /></SelectTrigger>
        <SelectContent><SelectItem value={ALL}>All actors</SelectItem>{actors.map((a) => <SelectItem key={a} value={a}>{actorName(a)}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={fAction} onValueChange={setFAction}>
        <SelectTrigger className="h-9 w-[170px]"><SelectValue placeholder="Action" /></SelectTrigger>
        <SelectContent><SelectItem value={ALL}>All actions</SelectItem>{actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Audit log" subtitle="A demo-derived record of system and data events. Production logs are written server-side." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total events" value={stats.total} icon={ScrollText} tone="gold" />
        <StatCard label="Events today" value={stats.today} icon={CalendarClock} tone="info" delay={0.05} />
        <StatCard label="Distinct actors" value={stats.actors} icon={Users} tone="success" delay={0.1} />
      </div>

      <DataTable<AuditRow>
        data={filtered} columns={columns} getRowId={(r) => r.id} loading={rows === null}
        searchable searchPlaceholder="Search audit events…" searchValue={(r) => `${actorName(r.actorId)} ${r.action} ${r.entity} ${r.summary}`}
        pageSize={15} toolbar={toolbar} enableColumnVisibility enableDensityToggle
        emptyTitle="No events" exportFilename="audit-log" storageKey="audit-table"
      />
    </div>
  );
}
