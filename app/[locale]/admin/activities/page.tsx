'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Activity as ActivityIcon, Mail, Phone, Users, FileSignature, FlaskConical,
  Truck, MessageSquareText, FileText, StickyNote, Plus, Search, Receipt, UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { activityService, companyService } from '@/lib/mock-services';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { useSession } from '@/components/providers/session-provider';
import { canEdit } from '@/lib/permissions';
import type { Activity, ActivityType, Company } from '@/lib/types';
import { getLabel, humanize } from '@/lib/labels';
import { formatDate, formatRelative } from '@/lib/formatting';
import { uid, initials } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

const ALL = '__all__';

const TYPE_META: Partial<Record<ActivityType, { icon: LucideIcon; cls: string }>> = {
  email: { icon: Mail, cls: 'bg-info-subtle text-info' },
  call: { icon: Phone, cls: 'bg-success-subtle text-success' },
  meeting: { icon: Users, cls: 'bg-brand-gold/15 text-brand-goldDark' },
  note: { icon: StickyNote, cls: 'bg-muted text-muted-foreground' },
  nda_event: { icon: FileSignature, cls: 'bg-brand-navy/5 text-brand-navy' },
  sample_event: { icon: FlaskConical, cls: 'bg-info-subtle text-info' },
  shipment_event: { icon: Truck, cls: 'bg-warning-subtle text-warning-foreground' },
  feedback: { icon: MessageSquareText, cls: 'bg-success-subtle text-success' },
  technical_reply: { icon: MessageSquareText, cls: 'bg-info-subtle text-info' },
  document: { icon: FileText, cls: 'bg-muted text-muted-foreground' },
  quote: { icon: Receipt, cls: 'bg-brand-gold/15 text-brand-goldDark' },
  order: { icon: Receipt, cls: 'bg-success-subtle text-success' },
  invoice: { icon: Receipt, cls: 'bg-warning-subtle text-warning-foreground' },
  registration: { icon: UserPlus, cls: 'bg-info-subtle text-info' },
};
function meta(t: ActivityType) { return TYPE_META[t] ?? { icon: ActivityIcon, cls: 'bg-muted text-muted-foreground' }; }

const TYPE_OPTIONS: ActivityType[] = ['email', 'call', 'meeting', 'note', 'nda_event', 'sample_event', 'shipment_event', 'feedback', 'document'];

export default function ActivitiesPage() {
  const t = useTranslations('AdminActivities');
  const staff = useStaffDirectory();
  const { session } = useSession();
  const role = session?.role;
  const canLogActivity = !!role && canEdit(role, 'activities');
  const [rows, setRows] = React.useState<Activity[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof activityService.getStatistics>> | null>(null);
  const [q, setQ] = React.useState('');
  const [fType, setFType] = React.useState(ALL);
  const [logOpen, setLogOpen] = React.useState(false);

  React.useEffect(() => {
    activityService.list().then((l) => setRows([...l].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())));
    activityService.getStatistics().then(setStats);
    companyService.list().then((l) => setCompanyMap(new Map(l.map((c) => [c.id, c]))));
  }, []);

  const userName = (id?: string) => {
    if (!id) return t('systemUser');
    const a = staff.get(id);
    return a ? `${a.firstName} ${a.lastName}` : humanize(id.replace('u_', ''));
  };

  const filtered = React.useMemo(() => {
    let d = rows ?? [];
    const s = q.trim().toLowerCase();
    if (s) d = d.filter((a) => [a.title, a.body, companyMap.get(a.companyId ?? '')?.tradingName].filter(Boolean).join(' ').toLowerCase().includes(s));
    if (fType !== ALL) d = d.filter((a) => a.type === fType);
    return d;
  }, [rows, q, fType, companyMap]);

  const groups = React.useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of filtered) {
      const day = a.at.slice(0, 10);
      if (!m.has(day)) m.set(day, []);
      m.get(day)!.push(a);
    }
    return [...m.entries()];
  }, [filtered]);

  function handleLog(a: Activity) {
    setRows((prev) => (prev ? [a, ...prev] : [a]));
    setStats((prev) => prev ? { ...prev, total: prev.total + 1, byType: { ...prev.byType, [a.type]: (prev.byType[a.type] ?? 0) + 1 } } : prev);
  }

  const byType = stats?.byType ?? ({} as Record<ActivityType, number>);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={canLogActivity ? <Button variant="gold" onClick={() => setLogOpen(true)}><Plus /> {t('logActivity')}</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('statTotal')} value={stats?.total ?? 0} icon={ActivityIcon} tone="gold" />
        <StatCard label={t('statEmails')} value={byType.email ?? 0} icon={Mail} tone="info" delay={0.05} />
        <StatCard label={t('statCalls')} value={byType.call ?? 0} icon={Phone} tone="success" delay={0.1} />
        <StatCard label={t('statMeetings')} value={byType.meeting ?? 0} icon={Users} tone="warning" delay={0.15} />
      </div>

      <Card>
        <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-8" />
              </div>
              <Select value={fType} onValueChange={setFType}>
                <SelectTrigger className="h-10 w-[170px]"><SelectValue placeholder={t('typePlaceholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('allTypes')}</SelectItem>
                  {TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{getLabel('activityType', t)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {rows === null ? (
              <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={ActivityIcon} title={t('emptyTitle')} description={t('emptyDescription')} />
            ) : (
              <div className="max-h-[560px] space-y-5 overflow-y-auto scrollbar-thin pr-1">
                {groups.map(([day, items]) => (
                  <div key={day}>
                    <p className="sticky top-0 z-10 bg-card py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{formatDate(day)}</p>
                    <div className="relative space-y-3 border-l border-border pl-4 pt-1">
                      {items.map((a) => {
                        const m = meta(a.type);
                        const c = companyMap.get(a.companyId ?? '');
                        return (
                          <div key={a.id} className="relative">
                            <span className={`absolute -left-[26px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card ${m.cls}`}>
                              <m.icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm font-medium text-foreground">{a.title}</p>
                                <span className="shrink-0 text-2xs text-muted-foreground">{formatRelative(a.at)}</span>
                              </div>
                              {a.body && <p className="mt-0.5 text-xs text-muted-foreground">{a.body}</p>}
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1">
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-navy text-[8px] font-semibold text-white">{initials(userName(a.byUserId))}</span>
                                  {userName(a.byUserId)}
                                </span>
                                {c && <Link href={`/admin/companies/${c.id}`} className="font-medium text-foreground hover:text-brand-teal hover:underline">{c.tradingName || c.legalName}</Link>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      <LogActivityDialog open={logOpen} onOpenChange={setLogOpen} companies={[...companyMap.values()]} onLogged={handleLog} />
    </div>
  );
}

function LogActivityDialog({ open, onOpenChange, companies, onLogged }: {
  open: boolean; onOpenChange: (o: boolean) => void; companies: Company[]; onLogged: (a: Activity) => void;
}) {
  const t = useTranslations('AdminActivities');
  const { account } = useSession();
  const [type, setType] = React.useState<ActivityType>('call');
  const [companyId, setCompanyId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const valid = title.trim().length > 0;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 450));
    const a: Activity = {
      id: uid('ac'), type, companyId: companyId || undefined, title: title.trim(),
      body: body.trim() || undefined, byUserId: account?.id, visibility: 'internal',
      at: new Date().toISOString(),
    };
    try {
      await activityService.create(a);
      onLogged(a);
      toast({ variant: 'success', title: t('toastLogged'), description: title.trim() });
      setTitle(''); setBody(''); setCompanyId('');
      onOpenChange(false);
    } catch {
      toast({ variant: 'danger', title: 'Action failed', description: 'Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('logActivity')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>{t('fieldType')}</Label>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{getLabel('activityType', t)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>{t('fieldCompany')}</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder={t('selectCompany')} /></SelectTrigger>
                <SelectContent>
                  {companies.slice().sort((a, b) => (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName)).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.tradingName || c.legalName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="at">{t('fieldTitle')}</Label><Input id="at" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} /></div>
          <div className="space-y-1.5"><Label htmlFor="ab">{t('fieldNotes')}</Label><Textarea id="ab" rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t('cancel')}</Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>{submitting ? t('saving') : t('logActivity')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
