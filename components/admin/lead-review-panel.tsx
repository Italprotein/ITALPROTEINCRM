'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Building2, Link2, Mail, ShieldOff, Sparkles } from 'lucide-react';

import {
  approveLeadAsCompany,
  leadSenders,
  linkLeadToCompany,
  listLeadsForReview,
  rejectLeadAsCompany,
  type LeadReviewRow,
  type LeadSender,
} from '@/lib/services/email-entity.actions';
import type { Company } from '@/lib/types';
import { can } from '@/lib/permissions';
import { useSession } from '@/components/providers/session-provider';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { formatRelative } from '@/lib/formatting';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

/**
 * Review surface for Gmail-derived leads.
 *
 * A Lead row is the CRM saying "somebody at this domain keeps writing to us and
 * I do not know who they are". Until now the only control beside one was a bin
 * icon on the agencies page, which is why 25 emails from three named people at
 * one dairy company sat unattributed for a month: the evidence was on screen
 * and there was no button that could act on it.
 *
 * Three answers, and every one of them is a decision a person makes:
 *
 *  - Approve — becomes a company, its domain enters the register, its senders
 *    become contacts, its stored mail is linked.
 *  - Not a company — suppresses the domain permanently. Needed because the sync
 *    REBUILDS every gmail lead on each run, so deleting one only makes it
 *    disappear until tomorrow.
 *  - Link to existing — the company is already in the CRM under another name.
 *
 * Each button is gated on the same permission its server action requires:
 * the UI hiding a control is a courtesy, the guard inside the action is the
 * authority.
 */
export function LeadReviewPanel({ companies }: { companies: Company[] }) {
  const t = useTranslations('AdminCommunications');
  const { session } = useSession();
  const { nameOf } = useStaffDirectory();
  const role = session?.role;
  const canApprove = !!role && can(role, 'company.create');
  const canLink = !!role && can(role, 'company.edit');

  const [leads, setLeads] = React.useState<LeadReviewRow[] | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [approving, setApproving] = React.useState<LeadReviewRow | null>(null);
  const [rejecting, setRejecting] = React.useState<LeadReviewRow | null>(null);
  const [linking, setLinking] = React.useState<LeadReviewRow | null>(null);

  const load = React.useCallback(() => {
    // Mock data mode has no server actions behind this; an empty list is the
    // honest answer there rather than an error nobody can act on.
    listLeadsForReview().then(setLeads).catch(() => setLeads([]));
  }, []);
  React.useEffect(load, [load]);

  function failed(reason: string, details?: string) {
    const KEYS: Record<string, string> = {
      lead_not_found: 'leadErrorNotFound',
      company_not_found: 'leadErrorCompanyNotFound',
      no_source_domain: 'leadErrorNoDomain',
      unusable_domain: 'leadErrorUnusableDomain',
      suppressed_domain: 'leadErrorSuppressed',
      invalid_name: 'leadErrorInvalidName',
      domain_taken: 'leadErrorDomainTaken',
    };
    toast({
      variant: 'danger',
      title: t('leadErrorTitle'),
      description:
        reason === 'domain_taken'
          ? t('leadErrorDomainTaken', { company: details ?? '' })
          : t(KEYS[reason] ?? 'leadErrorGeneric'),
    });
  }

  async function approve(lead: LeadReviewRow, legalName: string) {
    setBusyId(lead.id);
    try {
      // Refusals come back as a result object: Next redacts thrown server-action
      // messages in production, so a rule can only be reported by returning it.
      const result = await approveLeadAsCompany(lead.id, { legalName });
      if (!result.ok) {
        failed(result.reason);
        return;
      }
      setApproving(null);
      load();
      toast({
        variant: 'success',
        title: t('leadApprovedTitle'),
        description: result.created
          ? t('leadApprovedDescription', {
              name: result.companyName,
              contacts: result.contactsCreated,
              emails: result.messagesLinked,
            })
          : t('leadAbsorbedDescription', { name: result.companyName, emails: result.messagesLinked }),
      });
    } catch {
      failed('generic');
    } finally {
      setBusyId(null);
    }
  }

  async function reject(lead: LeadReviewRow) {
    setBusyId(lead.id);
    try {
      const result = await rejectLeadAsCompany(lead.id);
      if (!result.ok) {
        failed(result.reason);
        return;
      }
      setRejecting(null);
      load();
      toast({
        variant: 'success',
        title: t('leadRejectedTitle'),
        description: t('leadRejectedDescription', { domain: result.domain }),
      });
    } catch {
      failed('generic');
    } finally {
      setBusyId(null);
    }
  }

  async function link(lead: LeadReviewRow, companyId: string) {
    setBusyId(lead.id);
    try {
      const result = await linkLeadToCompany(lead.id, companyId);
      if (!result.ok) {
        failed(result.reason, 'details' in result ? result.details : undefined);
        return;
      }
      setLinking(null);
      load();
      const company = companies.find((c) => c.id === companyId);
      toast({
        variant: 'success',
        title: t('leadLinkedTitle'),
        description: t('leadLinkedDescription', {
          name: company?.tradingName ?? company?.legalName ?? '',
          emails: result.messagesLinked,
        }),
      });
    } catch {
      failed('generic');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-navy dark:text-brand-blueBright">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{t('leadsTitle')}</h2>
            <p className="text-xs text-muted-foreground">{t('leadsSubtitle')}</p>
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('colLeadName')}</TableHead>
              <TableHead>{t('colLeadDomain')}</TableHead>
              <TableHead className="text-right">{t('colLeadEmails')}</TableHead>
              <TableHead>{t('colLeadOwner')}</TableHead>
              <TableHead>{t('colLeadLastSeen')}</TableHead>
              <TableHead className="text-right">{t('colLeadActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads === null ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={Mail} title={t('leadsEmpty')} description={t('leadsEmptyDescription')} />
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="max-w-[220px]">
                    <p className="truncate font-medium text-foreground">{lead.companyName}</p>
                    {lead.existingCompanyName && (
                      <Badge variant="warning" className="mt-1">
                        <Building2 className="h-3 w-3" />
                        {t('leadDomainRegistered', { company: lead.existingCompanyName })}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.sourceDomain ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm tabular">{lead.emailCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {nameOf(lead.adminUserId, t('unmatched'))}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {formatRelative(lead.lastSeenAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {canApprove && (
                        <Button
                          variant="gold"
                          size="sm"
                          disabled={busyId === lead.id}
                          onClick={() => setApproving(lead)}
                        >
                          <Building2 className="h-4 w-4" />
                          {t('leadApprove')}
                        </Button>
                      )}
                      {canLink && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === lead.id}
                          onClick={() => setLinking(lead)}
                        >
                          <Link2 className="h-4 w-4" />
                          {t('leadLink')}
                        </Button>
                      )}
                      {canApprove && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-danger-text"
                          disabled={busyId === lead.id}
                          onClick={() => setRejecting(lead)}
                        >
                          <ShieldOff className="h-4 w-4" />
                          {t('leadReject')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <ApproveLeadDialog
        lead={approving}
        busy={busyId !== null}
        onOpenChange={(open) => !open && setApproving(null)}
        onConfirm={approve}
      />

      <Dialog open={rejecting !== null} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('leadRejectTitle')}</DialogTitle>
            <DialogDescription>
              {t('leadRejectDescription', { domain: rejecting?.sourceDomain ?? '' })}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-danger-subtle bg-danger-subtle/40 p-3 text-sm text-danger-text">
            {t('leadRejectWarning')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>{t('cancel')}</Button>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => rejecting && void reject(rejecting)}
            >
              {t('leadRejectConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LinkLeadDialog
        lead={linking}
        companies={companies}
        busy={busyId !== null}
        onOpenChange={(open) => !open && setLinking(null)}
        onConfirm={link}
      />
    </Card>
  );
}

/* ── Approve dialog ─────────────────────────────────────────────────────── */

function ApproveLeadDialog({
  lead,
  busy,
  onOpenChange,
  onConfirm,
}: {
  lead: LeadReviewRow | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (lead: LeadReviewRow, legalName: string) => void;
}) {
  const t = useTranslations('AdminCommunications');
  const [name, setName] = React.useState('');
  const [senders, setSenders] = React.useState<LeadSender[] | null>(null);
  const [shownLeadId, setShownLeadId] = React.useState<string | null>(null);

  // Adjusting state during render when a prop changes — React's own recommended
  // shape for this, and the reason it is not an effect: an effect would render
  // the previous lead's name for one frame before correcting it.
  if (lead && lead.id !== shownLeadId) {
    setShownLeadId(lead.id);
    setName(lead.companyName);
    setSenders(null);
  }

  React.useEffect(() => {
    if (!lead) return;
    // The domain names the row; the PEOPLE are why it deserves one. Showing the
    // senders is what turns "approve Bulla?" into a decision with evidence.
    let cancelled = false;
    leadSenders(lead.id)
      .then((rows) => !cancelled && setSenders(rows))
      .catch(() => !cancelled && setSenders([]));
    return () => {
      cancelled = true;
    };
  }, [lead]);

  return (
    <Dialog open={lead !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('leadApproveTitle')}</DialogTitle>
          <DialogDescription>
            {t('leadApproveDescription', { domain: lead?.sourceDomain ?? '', count: lead?.emailCount ?? 0 })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="approve-name">{t('leadApproveNameLabel')}</Label>
            <Input
              id="approve-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('leadApproveNamePlaceholder')}
              maxLength={200}
            />
          </div>

          {lead?.existingCompanyName && (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {t('leadApproveAbsorbNote', { company: lead.existingCompanyName })}
            </p>
          )}

          <div className="space-y-1.5">
            <Label>{t('leadApproveSendersLabel')}</Label>
            {senders === null ? (
              <div className="skeleton h-16 w-full rounded-lg" />
            ) : senders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('leadApproveNoSenders')}</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto scrollbar-thin rounded-lg border p-2">
                {senders.map((sender) => (
                  <li key={sender.email} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {sender.name ? `${sender.name} · ` : ''}
                      <span className="text-muted-foreground">{sender.email}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular text-muted-foreground">{sender.messageCount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button
            variant="gold"
            disabled={busy || name.trim().length < 2}
            onClick={() => lead && onConfirm(lead, name.trim())}
          >
            {t('leadApproveConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Link dialog ────────────────────────────────────────────────────────── */

function LinkLeadDialog({
  lead,
  companies,
  busy,
  onOpenChange,
  onConfirm,
}: {
  lead: LeadReviewRow | null;
  companies: Company[];
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (lead: LeadReviewRow, companyId: string) => void;
}) {
  const t = useTranslations('AdminCommunications');
  const [companyId, setCompanyId] = React.useState('');
  const [shownLeadId, setShownLeadId] = React.useState<string | null>(null);
  if (lead && lead.id !== shownLeadId) {
    setShownLeadId(lead.id);
    setCompanyId('');
  }

  const sorted = React.useMemo(
    () => [...companies].sort((a, b) => (a.tradingName ?? a.legalName).localeCompare(b.tradingName ?? b.legalName)),
    [companies],
  );

  return (
    <Dialog open={lead !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('leadLinkTitle')}</DialogTitle>
          <DialogDescription>
            {t('leadLinkDescription', { domain: lead?.sourceDomain ?? '', count: lead?.emailCount ?? 0 })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>{t('leadLinkCompanyLabel')}</Label>
          <Select value={companyId} onValueChange={setCompanyId}>
            <SelectTrigger><SelectValue placeholder={t('leadLinkCompanyPlaceholder')} /></SelectTrigger>
            <SelectContent>
              {sorted.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.tradingName ?? company.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button
            variant="gold"
            disabled={busy || !companyId}
            onClick={() => lead && onConfirm(lead, companyId)}
          >
            {t('leadLinkConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
