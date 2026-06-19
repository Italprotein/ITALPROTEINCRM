'use client';

import * as React from 'react';
import { MessageSquareText, Inbox, Clock, CheckCircle2, Send, Mail, RotateCw } from 'lucide-react';
import { supportService, companyService, activityService, authService } from '@/lib/mock-services';
import type { SupportRequest, Company, Activity } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, formatRelative } from '@/lib/formatting';
import { cn, initials } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';

export default function CommunicationsPage() {
  const [rows, setRows] = React.useState<SupportRequest[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [emails, setEmails] = React.useState<Activity[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    supportService.list().then((l) => { setRows(l); setActiveId((id) => id ?? l[0]?.id ?? null); });
    companyService.list().then((l) => setCompanyMap(new Map(l.map((c) => [c.id, c]))));
    activityService.byType('email').then(setEmails);
  }, []);

  const companyName = (id: string) => companyMap.get(id)?.tradingName ?? companyMap.get(id)?.legalName ?? '—';
  const active = rows?.find((r) => r.id === activeId) ?? null;

  const stats = React.useMemo(() => {
    const all = rows ?? [];
    return {
      open: all.filter((r) => r.status === 'open' || r.status === 'in_progress').length,
      waiting: all.filter((r) => r.status === 'waiting_on_client').length,
      resolved: all.filter((r) => r.status === 'resolved' || r.status === 'closed').length,
      total: all.length,
    };
  }, [rows]);

  async function sendReply() {
    if (!reply.trim() || !active || sending) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 450));
    const msg = { byUserId: 'u_giuseppe', body: reply.trim(), at: new Date().toISOString() };
    const next = [...active.conversation, msg];
    setRows((prev) => prev ? prev.map((r) => r.id === active.id ? { ...r, conversation: next, status: 'in_progress' } : r) : prev);
    void supportService.update(active.id, { conversation: next, status: 'in_progress' });
    setReply(''); setSending(false);
    toast({ variant: 'success', title: 'Reply sent', description: `Replied on ${active.reference}.` });
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Communications" subtitle="Client requests, conversations and the outbound email log." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open requests" value={stats.open} icon={Inbox} tone="info" />
        <StatCard label="Waiting on client" value={stats.waiting} icon={Clock} tone="warning" delay={0.05} />
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} tone="success" delay={0.1} />
        <StatCard label="Total threads" value={stats.total} icon={MessageSquareText} tone="gold" delay={0.15} />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests ({stats.total})</TabsTrigger>
          <TabsTrigger value="email">Email log ({emails.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            {/* Thread list */}
            <Card className="overflow-hidden">
              <div className="max-h-[600px] divide-y overflow-y-auto scrollbar-thin">
                {rows === null ? (
                  <div className="space-y-2 p-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
                ) : rows.length === 0 ? (
                  <EmptyState icon={Inbox} title="No requests" />
                ) : rows.map((r) => (
                  <button key={r.id} onClick={() => setActiveId(r.id)} className={cn('w-full p-3 text-left transition-colors hover:bg-muted/40', activeId === r.id && 'bg-muted/60')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{r.subject}</span>
                      <StatusBadge kind="supportStatus" value={r.status} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{companyName(r.companyId)} · {r.reference}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-2xs text-muted-foreground">{getLabel('supportCategory', r.category)}</span>
                      <span className="text-2xs text-muted-foreground">{formatRelative(r.conversation.length ? r.conversation[r.conversation.length - 1].at : r.createdAt)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            {/* Conversation */}
            <Card className="flex min-h-[400px] flex-col">
              {active ? (
                <>
                  <div className="flex items-start justify-between gap-2 border-b p-4">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-semibold">{active.subject}</h3><PriorityBadge value={active.priority} /></div>
                      <p className="text-xs text-muted-foreground">
                        <Link href={`/admin/companies/${active.companyId}`} className="font-medium text-foreground hover:underline">{companyName(active.companyId)}</Link>
                        {' · '}{active.reference} · {getLabel('supportCategory', active.category)}
                      </p>
                    </div>
                    <StatusBadge kind="supportStatus" value={active.status} />
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto scrollbar-thin p-4">
                    <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{active.description}</p>
                    {active.conversation.map((m, i) => {
                      const staff = m.byUserId ? authService.getAccount(m.byUserId) : null;
                      const isStaff = !!m.byUserId;
                      return (
                        <div key={i} className={cn('flex gap-2', isStaff ? 'flex-row-reverse' : 'flex-row')}>
                          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white', isStaff ? 'bg-brand-navy' : 'bg-brand-teal')}>
                            {isStaff && staff ? initials(`${staff.firstName} ${staff.lastName}`) : 'CL'}
                          </span>
                          <div className={cn('max-w-[80%] rounded-lg p-2.5 text-sm', isStaff ? 'bg-brand-navy text-white' : 'bg-muted')}>
                            <p>{m.body}</p>
                            <p className={cn('mt-1 text-2xs', isStaff ? 'text-white/60' : 'text-muted-foreground')}>{isStaff && staff ? `${staff.firstName} · ` : 'Client · '}{formatRelative(m.at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t p-3">
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Type a reply…" className="mb-2" />
                    <div className="flex justify-end"><Button variant="gold" size="sm" onClick={sendReply} disabled={!reply.trim() || sending}><Send /> {sending ? 'Sending…' : 'Send reply'}</Button></div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center"><EmptyState icon={MessageSquareText} title="Select a request" description="Choose a thread to view the conversation." /></div>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Company</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {emails.length === 0 ? (
                    <TableRow><TableCell colSpan={4}><EmptyState icon={Mail} title="No emails logged" /></TableCell></TableRow>
                  ) : emails.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium text-foreground">{e.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.companyId ? companyName(e.companyId) : '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(e.at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => toast({ title: 'Email resent', description: e.title, variant: 'info' })}><RotateCw /> Resend</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
