'use client';

import * as React from 'react';
import {
  MessageSquarePlus,
  Inbox,
  Clock,
  CheckCircle2,
  MessagesSquare,
  Send,
  Paperclip,
  Plus,
  X,
  ArrowLeft,
  LifeBuoy,
} from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import {
  companyService,
  supportService,
  sampleService,
  shipmentService,
  contactService,
} from '@/lib/mock-services';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import type { StaffMember } from '@/fixtures';
import type {
  Company,
  Contact,
  SupportRequest,
  SupportCategory,
  SampleRequest,
  Shipment,
  Priority,
  AttachmentRef,
} from '@/lib/types';
import { can } from '@/lib/permissions';
import { getLabel } from '@/lib/labels';
import { formatDateTime, formatRelative } from '@/lib/formatting';
import { initials, uid } from '@/lib/utils';
import { cn } from '@/lib/utils';

import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge, PriorityBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FadeIn } from '@/components/shared/motion';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

/** Real current time, taken fresh at each use so message timestamps are accurate. */
const nowIso = () => new Date().toISOString();

const CATEGORY_OPTIONS: SupportCategory[] = [
  'technical_question',
  'sample_request',
  'logistics_issue',
  'commercial_request',
  'documentation_request',
  'regulatory_request',
  'meeting_request',
  'account_issue',
  'other',
];

const PRIORITY_OPTIONS: Priority[] = ['low', 'medium', 'high', 'urgent'];

/** Most recent activity timestamp of a thread (last message, else createdAt). */
function lastUpdatedAt(r: SupportRequest): string {
  const last = r.conversation[r.conversation.length - 1]?.at;
  return last ?? r.createdAt;
}

function sortByRecent(a: SupportRequest, b: SupportRequest): number {
  return new Date(lastUpdatedAt(b)).getTime() - new Date(lastUpdatedAt(a)).getTime();
}

export default function PortalRequestsPage() {
  const { session, account, ready } = useSession();
  const companyId = session?.companyId;
  const role = session?.role;

  const { get: getStaff } = useStaffDirectory();
  const [company, setCompany] = React.useState<Company | null>(null);
  const [threads, setThreads] = React.useState<SupportRequest[]>([]);
  const [samples, setSamples] = React.useState<SampleRequest[]>([]);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [meContact, setMeContact] = React.useState<Contact | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [composeOpen, setComposeOpen] = React.useState(false);

  React.useEffect(() => {
    if (!ready) return;
    if (!companyId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      const [c, reqs, smp, shp, contacts] = await Promise.all([
        companyService.get(companyId),
        supportService.byCompany(companyId),
        sampleService.byCompany(companyId),
        shipmentService.byCompany(companyId),
        contactService.byCompany(companyId),
      ]);
      if (!alive) return;
      const sorted = [...reqs].sort(sortByRecent);
      setCompany(c ?? null);
      setThreads(sorted);
      setSamples(smp);
      setShipments(shp);
      // Match the signed-in portal user to a company contact (by email) so replies are attributed.
      const mine =
        contacts.find((ct) => ct.email.toLowerCase() === (account?.email ?? '').toLowerCase()) ??
        contacts.find((ct) => ct.portalAccountId === account?.id) ??
        contacts.find((ct) => ct.isPrimary) ??
        contacts[0] ??
        null;
      setMeContact(mine);
      setSelectedId(sorted[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [ready, companyId, account?.email, account?.id]);

  const canSend = role ? can(role, 'portal.request_meeting') || true : true;

  const owner: StaffMember | null = company ? getStaff(company.accountOwnerId) ?? null : null;

  const selected = React.useMemo(
    () => threads.find((t) => t.id === selectedId) ?? null,
    [threads, selectedId],
  );

  const stats = React.useMemo(() => {
    const open = threads.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
    const waiting = threads.filter((t) => t.status === 'waiting_on_client').length;
    const resolved = threads.filter((t) => t.status === 'resolved' || t.status === 'closed').length;
    return { open, waiting, resolved, total: threads.length };
  }, [threads]);

  const meName = meContact
    ? `${meContact.firstName} ${meContact.lastName}`
    : account
      ? `${account.firstName} ${account.lastName}`
      : 'You';

  /* ── Send a reply on the selected thread ── */
  async function handleSend() {
    if (!selected || !reply.trim()) return;
    setSending(true);
    const body = reply.trim();
    const entry = { byContactId: meContact?.id, body, at: nowIso() };
    const nextConversation = [...selected.conversation, entry];
    // Re-open the thread for staff if it was waiting on the client.
    const nextStatus = selected.status === 'waiting_on_client' ? 'in_progress' : selected.status;

    await new Promise((r) => setTimeout(r, 500));
    await supportService.update(selected.id, {
      conversation: nextConversation,
      status: nextStatus,
    });

    setThreads((prev) =>
      [...prev]
        .map((t) =>
          t.id === selected.id ? { ...t, conversation: nextConversation, status: nextStatus } : t,
        )
        .sort(sortByRecent),
    );
    setReply('');
    setSending(false);
    toast({
      title: 'Message sent',
      description: owner
        ? `${owner.firstName} from Italprotein will get back to you shortly.`
        : 'Your message has been added to the thread.',
    });
  }

  /* ── Create a brand new request thread ── */
  async function handleCreate(payload: {
    subject: string;
    category: SupportCategory;
    priority: Priority;
    message: string;
    relatedRef?: string;
    attachments: AttachmentRef[];
  }) {
    if (!companyId) return;
    const seq = String(7 + threads.length).padStart(4, '0');
    const at = nowIso();
    const description = payload.relatedRef
      ? `${payload.message}\n\nRelated: ${payload.relatedRef}`
      : payload.message;
    const newReq: SupportRequest = {
      id: uid('rq'),
      reference: `REQ-2026-${seq}`,
      companyId,
      contactId: meContact?.id,
      subject: payload.subject.trim(),
      category: payload.category,
      description,
      priority: payload.priority,
      status: 'open',
      assignedOwnerId: owner?.id ?? company?.accountOwnerId,
      conversation: [{ byContactId: meContact?.id, body: payload.message.trim(), at }],
      attachments: payload.attachments.length ? payload.attachments : undefined,
      createdAt: at,
    };

    await new Promise((r) => setTimeout(r, 500));
    await supportService.create(newReq);

    setThreads((prev) => [newReq, ...prev].sort(sortByRecent));
    setSelectedId(newReq.id);
    setComposeOpen(false);
    toast({
      title: 'Request sent',
      description: `${newReq.reference} is on its way${owner ? ` to ${owner.firstName}` : ''}. We'll reply soon.`,
    });
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Skeleton className="h-[28rem]" />
          <Skeleton className="h-[28rem]" />
        </div>
      </div>
    );
  }

  if (!companyId || !company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Requests & support" subtitle="Talk to your Italprotein team" />
        <EmptyState
          icon={LifeBuoy}
          title="No company linked to your account"
          description="We couldn't find a company for your sign-in. Please contact your Italprotein account manager."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests & support"
        subtitle={`Message your Italprotein team — ${company.tradingName ?? company.legalName}`}
        actions={
          <Button variant="gold" onClick={() => setComposeOpen(true)} disabled={!canSend}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New message
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open" value={stats.open} icon={Inbox} tone="info" hint="Being handled by our team" />
        <StatCard
          label="Waiting on you"
          value={stats.waiting}
          icon={Clock}
          tone="warning"
          hint="Needs your reply"
          delay={0.05}
        />
        <StatCard
          label="Resolved"
          value={stats.resolved}
          icon={CheckCircle2}
          tone="success"
          hint="Closed conversations"
          delay={0.1}
        />
        <StatCard
          label="Total threads"
          value={stats.total}
          icon={MessagesSquare}
          tone="gold"
          hint="All time"
          delay={0.15}
        />
      </div>

      {threads.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No messages yet"
          description="Start a conversation with your Italprotein team — ask a technical question, request a document, or flag a logistics issue."
          action={
            <Button variant="gold" onClick={() => setComposeOpen(true)} disabled={!canSend}>
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              New message
            </Button>
          }
        />
      ) : (
        <FadeIn>
          <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
            {/* LEFT — thread list */}
            <Card className={cn('overflow-hidden', selected && 'hidden lg:block')}>
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2 className="text-sm font-semibold">Conversations</h2>
                <Badge variant="muted">{threads.length}</Badge>
              </div>
              <ul className="max-h-[34rem] divide-y overflow-y-auto">
                {threads.map((t) => {
                  const active = t.id === selectedId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className={cn(
                          'flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                          active && 'bg-muted/60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-1 text-sm font-medium">{t.subject}</span>
                          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                            {t.reference}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[11px]">
                            {getLabel('supportCategory', t.category)}
                          </Badge>
                          <StatusBadge kind="supportStatus" value={t.status} />
                          <PriorityBadge value={t.priority} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Updated {formatRelative(lastUpdatedAt(t), 'en', new Date())}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* RIGHT — conversation detail */}
            <Card className={cn('flex flex-col', !selected && 'hidden lg:flex')}>
              {selected ? (
                <ThreadDetail
                  thread={selected}
                  owner={owner}
                  meName={meName}
                  reply={reply}
                  setReply={setReply}
                  onSend={handleSend}
                  sending={sending}
                  canSend={canSend}
                  onBack={() => setSelectedId(null)}
                />
              ) : (
                <CardContent className="flex flex-1 items-center justify-center py-16">
                  <p className="text-sm text-muted-foreground">Select a conversation to read it.</p>
                </CardContent>
              )}
            </Card>
          </div>
        </FadeIn>
      )}

      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        owner={owner}
        samples={samples}
        shipments={shipments}
        onCreate={handleCreate}
        canSend={canSend}
      />
    </div>
  );
}

/* ────────────────────────────── Thread detail ────────────────────────────── */

function ThreadDetail({
  thread,
  owner,
  meName,
  reply,
  setReply,
  onSend,
  sending,
  canSend,
  onBack,
}: {
  thread: SupportRequest;
  owner: StaffMember | null;
  meName: string;
  reply: string;
  setReply: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  canSend: boolean;
  onBack: () => void;
}) {
  const closed = thread.status === 'resolved' || thread.status === 'closed';
  const staffName = owner ? `${owner.firstName} ${owner.lastName}` : 'Italprotein team';
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.id, thread.conversation.length]);

  return (
    <>
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{thread.subject}</h2>
              <span className="font-mono text-xs text-muted-foreground">{thread.reference}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[11px]">
                {getLabel('supportCategory', thread.category)}
              </Badge>
              <StatusBadge kind="supportStatus" value={thread.status} />
              <PriorityBadge value={thread.priority} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {owner
            ? `Handled by ${staffName}${owner.jobTitle ? ` · ${owner.jobTitle}` : ''}`
            : 'Handled by your Italprotein team'}
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 max-h-[26rem]">
        {thread.conversation.map((m, i) => {
          const fromStaff = !!m.byUserId;
          const authorName = fromStaff ? staffName : meName;
          const color = fromStaff ? owner?.avatarColor : undefined;
          return (
            <div
              key={`${thread.id}-${i}`}
              className={cn('flex items-end gap-2', fromStaff ? 'justify-start' : 'justify-end')}
            >
              {fromStaff && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className="text-[11px] text-white"
                    style={color ? { backgroundColor: color } : undefined}
                  >
                    {initials(authorName)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={cn('max-w-[80%] sm:max-w-[70%]')}>
                <div
                  className={cn(
                    'flex items-center gap-2 text-[11px] text-muted-foreground',
                    fromStaff ? 'justify-start' : 'justify-end',
                  )}
                >
                  <span className="font-medium text-foreground/80">{authorName}</span>
                  {fromStaff && <Badge variant="info" className="text-[10px]">Italprotein</Badge>}
                  <span>{formatDateTime(m.at, 'en')}</span>
                </div>
                <div
                  className={cn(
                    'mt-1 whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                    fromStaff
                      ? 'rounded-bl-sm bg-muted text-foreground'
                      : 'rounded-br-sm bg-brand-navy text-white',
                  )}
                >
                  {m.body}
                </div>
              </div>
              {!fromStaff && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-brand-gold/20 text-[11px] text-brand-goldDark">
                    {initials(authorName)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
      </div>

      <Separator />

      {/* Reply box */}
      <div className="space-y-2 px-4 py-3">
        {closed && (
          <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            This conversation is marked {getLabel('supportStatus', thread.status).toLowerCase()}.
            Sending a reply will re-open it for our team.
          </p>
        )}
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={`Reply to ${owner ? owner.firstName : 'the team'}…`}
          rows={3}
          disabled={!canSend || sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && reply.trim()) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Press Ctrl/⌘ + Enter to send</span>
          <Button onClick={onSend} disabled={!canSend || sending || !reply.trim()}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </>
  );
}

/* ────────────────────────────── Compose dialog ────────────────────────────── */

function ComposeDialog({
  open,
  onOpenChange,
  owner,
  samples,
  shipments,
  onCreate,
  canSend,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  owner: StaffMember | null;
  samples: SampleRequest[];
  shipments: Shipment[];
  onCreate: (payload: {
    subject: string;
    category: SupportCategory;
    priority: Priority;
    message: string;
    relatedRef?: string;
    attachments: AttachmentRef[];
  }) => Promise<void>;
  canSend: boolean;
}) {
  const [subject, setSubject] = React.useState('');
  const [category, setCategory] = React.useState<SupportCategory>('technical_question');
  const [priority, setPriority] = React.useState<Priority>('medium');
  const [related, setRelated] = React.useState<string>('none');
  const [message, setMessage] = React.useState('');
  const [attachments, setAttachments] = React.useState<AttachmentRef[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  // Reset the form whenever the dialog opens.
  React.useEffect(() => {
    if (open) {
      setSubject('');
      setCategory('technical_question');
      setPriority('medium');
      setRelated('none');
      setMessage('');
      setAttachments([]);
      setSubmitting(false);
    }
  }, [open]);

  const relatedLabel = React.useMemo(() => {
    if (related === 'none') return undefined;
    const s = samples.find((x) => x.id === related);
    if (s) return `Sample ${s.reference} (${s.requestedProduct})`;
    const sh = shipments.find((x) => x.id === related);
    if (sh) return `Shipment ${sh.reference}`;
    return undefined;
  }, [related, samples, shipments]);

  const valid = subject.trim().length > 0 && message.trim().length > 0;

  function addMockAttachment() {
    const n = attachments.length + 1;
    setAttachments((prev) => [
      ...prev,
      {
        id: uid('att'),
        name: `attachment-${n}.pdf`,
        fileType: 'pdf',
        sizeKb: 240,
        uploadedAt: nowIso(),
      },
    ]);
  }

  async function submit() {
    if (!valid || !canSend) return;
    setSubmitting(true);
    await onCreate({
      subject,
      category,
      priority,
      message,
      relatedRef: relatedLabel,
      attachments,
    });
    // Parent closes the dialog on success.
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
          <DialogDescription>
            {owner
              ? `Send a note to ${owner.firstName} ${owner.lastName}, your Italprotein contact. We usually reply within one business day.`
              : 'Send a note to your Italprotein team. We usually reply within one business day.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rq-subject">Subject</Label>
            <Input
              id="rq-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as SupportCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {getLabel('supportCategory', c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {getLabel('priority', p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Related sample or shipment (optional)</Label>
            <Select value={related} onValueChange={setRelated}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {samples.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Sample · {s.reference} — {s.requestedProduct}
                  </SelectItem>
                ))}
                {shipments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    Shipment · {s.reference}
                    {s.trackingNumber ? ` (${s.trackingNumber})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rq-message">Message</Label>
            <Textarea
              id="rq-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us how we can help…"
              rows={4}
            />
          </div>

          {/* Attachments (mock) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Attachments</Label>
              <Button type="button" variant="outline" size="sm" onClick={addMockAttachment}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add file
              </Button>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No files attached.</p>
            ) : (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      {a.name}
                      <span className="text-xs text-muted-foreground">{a.sizeKb} KB</span>
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                      aria-label={`Remove ${a.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting || !canSend}>
            <Send className="mr-2 h-4 w-4" />
            {submitting ? 'Sending…' : 'Send message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
