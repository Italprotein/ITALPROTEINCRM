'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  MessageSquareText, Inbox, Clock, CheckCircle2, Send, Mail, Paperclip,
  RefreshCw, PenSquare, FileText, UserRound, Settings2,
} from 'lucide-react';
import { supportService, companyService, activityService, emailService } from '@/lib/mock-services';
import type { SupportRequest, Company, Activity, EmailMessageRecord, GmailConnectionStatus } from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { formatDate, formatRelative } from '@/lib/formatting';
import { cn, initials } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { useSession } from '@/components/providers/session-provider';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const SEND_ERROR_KEYS: Record<string, string> = {
  gmail_not_connected: 'errorGmailNotConnected',
  rate_limited: 'errorRateLimited',
  invalid_recipients: 'errorInvalidRecipients',
  invalid_content: 'errorInvalidContent',
  send_failed: 'errorSendFailed',
  unauthenticated: 'errorSendFailed',
};

function splitAddresses(value: string): string[] {
  return value
    .split(/[,;\s]+/)
    .map((a) => a.trim())
    .filter(Boolean);
}

export default function CommunicationsPage() {
  const t = useTranslations('AdminCommunications');
  const { account } = useSession();
  const { get: getStaff, nameOf } = useStaffDirectory();
  const [rows, setRows] = React.useState<SupportRequest[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [emails, setEmails] = React.useState<Activity[]>([]);
  const [inbox, setInbox] = React.useState<EmailMessageRecord[] | null>(null);
  const [gmail, setGmail] = React.useState<GmailConnectionStatus | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [openMessage, setOpenMessage] = React.useState<EmailMessageRecord | null>(null);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [reply, setReply] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const loadInbox = React.useCallback(() => {
    emailService.listInbox().then(setInbox);
    emailService.status().then(setGmail);
  }, []);

  React.useEffect(() => {
    supportService.list().then((l) => { setRows(l); setActiveId((id) => id ?? l[0]?.id ?? null); });
    companyService.list().then((l) => setCompanyMap(new Map(l.map((c) => [c.id, c]))));
    activityService.byType('email').then(setEmails);
    loadInbox();
  }, [loadInbox]);

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
    const msg = { byUserId: account?.id, body: reply.trim(), at: new Date().toISOString() };
    const next = [...active.conversation, msg];
    setRows((prev) => prev ? prev.map((r) => r.id === active.id ? { ...r, conversation: next, status: 'in_progress' } : r) : prev);
    void supportService.update(active.id, { conversation: next, status: 'in_progress' });
    setReply(''); setSending(false);
    toast({ variant: 'success', title: t('replySentTitle'), description: t('replySentDescription', { reference: active.reference }) });
  }

  async function syncNow() {
    if (syncing) return;
    setSyncing(true);
    const res = await emailService.sync();
    setSyncing(false);
    if (res.ok) {
      loadInbox();
      activityService.byType('email').then(setEmails);
      toast({
        variant: 'success',
        title: t('syncDoneTitle'),
        description: t('syncDoneDescription', { created: res.created, ndas: res.ndasCreated, leads: res.leadsCreated + res.leadsUpdated }),
      });
    } else {
      toast({
        variant: 'danger',
        title: t('syncFailedTitle'),
        description: res.error === 'gmail_not_connected' ? t('errorGmailNotConnected') : t('errorRateLimited'),
      });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="gold" onClick={() => setComposeOpen(true)}>
            <PenSquare className="h-4 w-4" />
            {t('compose')}
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('openRequests')} value={stats.open} icon={Inbox} tone="info" />
        <StatCard label={t('waitingOnClient')} value={stats.waiting} icon={Clock} tone="warning" delay={0.05} />
        <StatCard label={t('resolved')} value={stats.resolved} icon={CheckCircle2} tone="success" delay={0.1} />
        <StatCard label={t('totalThreads')} value={stats.total} icon={MessageSquareText} tone="gold" delay={0.15} />
      </div>

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">{t('inboxTab', { count: inbox?.length ?? 0 })}</TabsTrigger>
          <TabsTrigger value="requests">{t('requestsTab', { count: stats.total })}</TabsTrigger>
          <TabsTrigger value="email">{t('emailLogTab', { count: emails.length })}</TabsTrigger>
        </TabsList>

        {/* ── Gmail inbox ─────────────────────────────────────────── */}
        <TabsContent value="inbox">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div className="min-w-0 text-sm">
                {gmail?.connected ? (
                  <>
                    <p className="font-medium text-foreground">{t('gmailConnectedAs', { email: gmail.email ?? '' })}</p>
                    <p className="text-xs text-muted-foreground">
                      {gmail.lastSyncedAt ? t('lastSynced', { time: formatRelative(gmail.lastSyncedAt) }) : t('neverSynced')}
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {t('gmailNotConnected')}{' '}
                      <Link href="/admin/settings" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline">
                        <Settings2 className="h-3.5 w-3.5" /> {t('connectInSettings')}
                      </Link>
                    </p>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={syncNow} disabled={syncing || !gmail?.connected}>
                <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
                {syncing ? t('syncing') : t('syncNow')}
              </Button>
            </div>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('colFrom')}</TableHead>
                    <TableHead>{t('colSubject')}</TableHead>
                    <TableHead>{t('colDate')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inbox === null ? (
                    <TableRow><TableCell colSpan={3}><div className="space-y-2 p-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div></TableCell></TableRow>
                  ) : inbox.length === 0 ? (
                    <TableRow><TableCell colSpan={3}><EmptyState icon={Inbox} title={t('inboxEmpty')} description={t('inboxEmptyDescription')} /></TableCell></TableRow>
                  ) : inbox.map((m) => (
                    <TableRow key={m.id} className="cursor-pointer" onClick={() => setOpenMessage(m)}>
                      <TableCell className="max-w-[220px]">
                        <p className="truncate text-sm font-medium text-foreground">{m.fromName ?? m.fromAddress}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.fromAddress}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="max-w-[360px] truncate text-sm text-foreground">{m.subject ?? '—'}</span>
                          {m.hasAttachments && <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          {m.ndaDetected && <Badge variant="warning"><FileText className="h-3 w-3" /> {t('ndaFiledBadge')}</Badge>}
                          {m.matchedAdminUserId && (
                            <Badge variant="secondary"><UserRound className="h-3 w-3" /> {nameOf(m.matchedAdminUserId, t('unmatched'))}</Badge>
                          )}
                        </div>
                        <p className="max-w-[420px] truncate text-xs text-muted-foreground">{m.snippet}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatRelative(m.internalDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Support requests (unchanged two-pane) ───────────────── */}
        <TabsContent value="requests">
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <Card className="overflow-hidden">
              <div className="max-h-[600px] divide-y overflow-y-auto scrollbar-thin">
                {rows === null ? (
                  <div className="space-y-2 p-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}</div>
                ) : rows.length === 0 ? (
                  <EmptyState icon={Inbox} title={t('noRequests')} />
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
                      const staff = m.byUserId ? getStaff(m.byUserId) : undefined;
                      const isStaff = !!m.byUserId;
                      return (
                        <div key={i} className={cn('flex gap-2', isStaff ? 'flex-row-reverse' : 'flex-row')}>
                          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white', isStaff ? 'bg-brand-navy' : 'bg-brand-teal')}>
                            {isStaff && staff ? initials(`${staff.firstName} ${staff.lastName}`) : 'CL'}
                          </span>
                          <div className={cn('max-w-[80%] rounded-lg p-2.5 text-sm', isStaff ? 'bg-brand-navy text-white' : 'bg-muted')}>
                            <p>{m.body}</p>
                            <p className={cn('mt-1 text-2xs', isStaff ? 'text-white/60' : 'text-muted-foreground')}>{isStaff && staff ? `${staff.firstName} · ` : `${t('clientSender')} · `}{formatRelative(m.at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t p-3">
                    <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={t('replyPlaceholder')} className="mb-2" />
                    <div className="flex justify-end"><Button variant="gold" size="sm" onClick={sendReply} disabled={!reply.trim() || sending}><Send /> {sending ? t('sending') : t('sendReply')}</Button></div>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center"><EmptyState icon={MessageSquareText} title={t('selectRequestTitle')} description={t('selectRequestDescription')} /></div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── Email activity log ───────────────────────────────────── */}
        <TabsContent value="email">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t('colSubject')}</TableHead><TableHead>{t('colCompany')}</TableHead><TableHead>{t('colSentBy')}</TableHead><TableHead>{t('colDate')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {emails.length === 0 ? (
                    <TableRow><TableCell colSpan={4}><EmptyState icon={Mail} title={t('noEmailsLogged')} /></TableCell></TableRow>
                  ) : emails.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium text-foreground">{e.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{e.companyId ? companyName(e.companyId) : '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{nameOf(e.byUserId, '—')}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(e.at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Message detail sheet ─────────────────────────────────── */}
      <Sheet open={openMessage !== null} onOpenChange={(o) => !o && setOpenMessage(null)}>
        <SheetContent side="right" className="max-w-lg">
          {openMessage && (
            <>
              <SheetHeader>
                <SheetTitle className="pr-8">{openMessage.subject ?? '—'}</SheetTitle>
                <SheetDescription>
                  {(openMessage.fromName ? `${openMessage.fromName} · ` : '') + openMessage.fromAddress}
                  {' · '}{formatDate(openMessage.internalDate)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap gap-2">
                {openMessage.ndaDetected && <Badge variant="warning"><FileText className="h-3 w-3" /> {t('ndaFiledBadge')}</Badge>}
                {openMessage.matchedAdminUserId && (
                  <Badge variant="secondary"><UserRound className="h-3 w-3" /> {t('leadForAdmin', { name: nameOf(openMessage.matchedAdminUserId, '—') })}</Badge>
                )}
              </div>

              {openMessage.attachmentNames.length > 0 && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t('attachments')}</p>
                  <ul className="space-y-1">
                    {openMessage.attachmentNames.map((name) => (
                      <li key={name} className="flex items-center gap-1.5 text-sm"><Paperclip className="h-3.5 w-3.5 text-muted-foreground" /> {name}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="max-h-[55vh] overflow-y-auto scrollbar-thin rounded-lg border p-3">
                <p className="whitespace-pre-wrap text-sm text-foreground">{openMessage.bodyText ?? openMessage.snippet ?? '—'}</p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        companies={[...companyMap.values()]}
        senderEmail={gmail?.email}
        onSent={() => activityService.byType('email').then(setEmails)}
      />
    </div>
  );
}

/* ── Compose dialog ─────────────────────────────────────────────────────── */

function ComposeDialog({
  open,
  onOpenChange,
  companies,
  senderEmail,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  senderEmail?: string;
  onSent: () => void;
}) {
  const t = useTranslations('AdminCommunications');
  const [to, setTo] = React.useState('');
  const [cc, setCc] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [companyId, setCompanyId] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const canSend = splitAddresses(to).length > 0 && subject.trim() && body.trim() && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    const res = await emailService.send({
      to: splitAddresses(to),
      cc: splitAddresses(cc),
      subject: subject.trim(),
      body: body.trim(),
      companyId: companyId || undefined,
    });
    setSending(false);
    if (res.ok) {
      toast({ variant: 'success', title: t('emailSentTitle'), description: t('emailSentDescription') });
      setTo(''); setCc(''); setSubject(''); setBody(''); setCompanyId('');
      onOpenChange(false);
      onSent();
    } else {
      toast({ variant: 'danger', title: t('emailFailedTitle'), description: t(SEND_ERROR_KEYS[res.error ?? 'send_failed'] ?? 'errorSendFailed') });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('composeTitle')}</DialogTitle>
          <DialogDescription>
            {senderEmail ? t('composeDescription', { email: senderEmail }) : t('composeDescriptionNoAccount')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="compose-to">{t('toLabel')}</Label>
            <Input id="compose-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder={t('toPlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compose-cc">{t('ccLabel')}</Label>
            <Input id="compose-cc" value={cc} onChange={(e) => setCc(e.target.value)} placeholder={t('toPlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compose-subject">{t('subjectLabel')}</Label>
            <Input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('subjectPlaceholder')} maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('companySelectLabel')}</Label>
            <Select value={companyId || 'none'} onValueChange={(v) => setCompanyId(v === 'none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder={t('companyNone')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('companyNone')}</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.tradingName ?? c.legalName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compose-body">{t('bodyLabel')}</Label>
            <Textarea id="compose-body" value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder={t('bodyPlaceholder')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button variant="gold" onClick={send} disabled={!canSend}>
            <Send className="h-4 w-4" />
            {sending ? t('sendingEmail') : t('sendEmail')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
