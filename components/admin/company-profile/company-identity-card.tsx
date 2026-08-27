'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { GitMerge, Globe, Plus, Tag, Trash2 } from 'lucide-react';

import {
  addCompanyAlias,
  addCompanyDomain,
  getCompanyIdentity,
  mergeCompanies,
  removeCompanyAlias,
  removeCompanyDomain,
  type AliasKind,
  type CompanyIdentity,
} from '@/lib/services/email-entity.actions';
import { companyService } from '@/lib/mock-services';
import type { Company } from '@/lib/types';
import { can } from '@/lib/permissions';
import { useSession } from '@/components/providers/session-provider';
import { useRouter } from '@/lib/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

const ALIAS_KINDS: AliasKind[] = ['legal_name', 'trading_name', 'former_name', 'spelling'];

/**
 * Enum value → message key, written out rather than interpolated: a literal key
 * is what lets TypeScript and the i18n parity check see it.
 */
const ALIAS_KIND_KEYS = {
  legal_name: 'identityAliasKindLegalName',
  trading_name: 'identityAliasKindTradingName',
  former_name: 'identityAliasKindFormerName',
  spelling: 'identityAliasKindSpelling',
} as const;

const DOMAIN_SOURCE_KEYS = {
  import: 'identityDomainSourceImport',
  gmail_sync: 'identityDomainSourceGmailSync',
  manual: 'identityDomainSourceManual',
  reconciliation: 'identityDomainSourceReconciliation',
} as const;

function domainSourceKey(source: string): (typeof DOMAIN_SOURCE_KEYS)[keyof typeof DOMAIN_SOURCE_KEYS] {
  return DOMAIN_SOURCE_KEYS[source as keyof typeof DOMAIN_SOURCE_KEYS] ?? DOMAIN_SOURCE_KEYS.manual;
}

/**
 * The identity a company is known by to the Gmail sync.
 *
 * `CompanyDomain` is what the sync matches a sender's registrable domain
 * against, and `CompanyAlias` is what it matches a signature block's name
 * against. Both shipped empty in Task 1, which is why they need a place a
 * person can fill them in — and why a wrong row here is worth removing quickly:
 * one bad domain silently attributes every future message from it.
 *
 * Merge lives here too, because "these two rows are one company" is a
 * realisation people have while looking at one of them. It is destructive — the
 * source row is deleted — so it asks for the name to be typed, uses the danger
 * tokens, and refuses outright when the source carries financial records.
 */
export function CompanyIdentityCard({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const t = useTranslations('AdminCompanyDetail');
  const router = useRouter();
  const { session } = useSession();
  const role = session?.role;
  // The same action every server function on this card requires.
  const canManage = !!role && can(role, 'company.edit');

  const [identity, setIdentity] = React.useState<CompanyIdentity | null>(null);
  const [domainInput, setDomainInput] = React.useState('');
  const [aliasInput, setAliasInput] = React.useState('');
  const [aliasKind, setAliasKind] = React.useState<AliasKind>('trading_name');
  const [busy, setBusy] = React.useState(false);
  const [mergeOpen, setMergeOpen] = React.useState(false);

  const load = React.useCallback(() => {
    getCompanyIdentity(companyId)
      .then(setIdentity)
      .catch(() => setIdentity({ aliases: [], domains: [] }));
  }, [companyId]);
  React.useEffect(load, [load]);

  function failed(reason: string, details?: string) {
    const KEYS: Record<string, string> = {
      invalid_domain: 'identityErrorInvalidDomain',
      invalid_name: 'identityErrorInvalidName',
      duplicate: 'identityErrorDuplicate',
      company_not_found: 'identityErrorNotFound',
      not_found: 'identityErrorNotFound',
    };
    toast({
      variant: 'danger',
      title: t('identityErrorTitle'),
      description:
        reason === 'domain_taken'
          ? t('identityErrorDomainTaken', { company: details ?? '' })
          : t(KEYS[reason] ?? 'identityErrorGeneric'),
    });
  }

  async function run(work: () => Promise<{ ok: boolean; reason?: string; details?: string }>) {
    setBusy(true);
    try {
      const result = await work();
      if (!result.ok) {
        failed(result.reason ?? 'generic', result.details);
        return false;
      }
      load();
      return true;
    } catch {
      failed('generic');
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{t('identityTitle')}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t('identitySubtitle')}</p>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setMergeOpen(true)}>
            <GitMerge className="h-4 w-4" />
            {t('mergeAction')}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ── Domains ── */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Globe className="h-3.5 w-3.5" />
            {t('identityDomains')}
          </h3>
          {identity === null ? (
            <div className="skeleton h-9 w-full rounded-lg" />
          ) : identity.domains.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('identityNoDomains')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {identity.domains.map((domain) => (
                <li key={domain.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate text-sm">{domain.domain}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{t(domainSourceKey(domain.source))}</Badge>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('identityRemoveDomain')}
                        className="text-danger-text"
                        disabled={busy}
                        onClick={() => void run(() => removeCompanyDomain(domain.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1 space-y-1.5">
                <Label htmlFor="identity-domain" className="sr-only">{t('identityAddDomain')}</Label>
                <Input
                  id="identity-domain"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder={t('identityAddDomainPlaceholder')}
                  maxLength={200}
                />
              </div>
              <Button
                variant="outline"
                disabled={busy || !domainInput.trim()}
                onClick={async () => {
                  if (await run(() => addCompanyDomain(companyId, domainInput.trim()))) setDomainInput('');
                }}
              >
                <Plus className="h-4 w-4" />
                {t('identityAddDomain')}
              </Button>
            </div>
          )}
        </section>

        {/* ── Aliases ── */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Tag className="h-3.5 w-3.5" />
            {t('identityAliases')}
          </h3>
          {identity === null ? (
            <div className="skeleton h-9 w-full rounded-lg" />
          ) : identity.aliases.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('identityNoAliases')}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {identity.aliases.map((alias) => (
                <li key={alias.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="min-w-0 truncate text-sm">{alias.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{t(ALIAS_KIND_KEYS[alias.kind])}</Badge>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('identityRemoveAlias')}
                        className="text-danger-text"
                        disabled={busy}
                        onClick={() => void run(() => removeCompanyAlias(alias.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canManage && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1 space-y-1.5">
                <Label htmlFor="identity-alias" className="sr-only">{t('identityAddAlias')}</Label>
                <Input
                  id="identity-alias"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder={t('identityAddAliasPlaceholder')}
                  maxLength={200}
                />
              </div>
              <Select value={aliasKind} onValueChange={(value) => setAliasKind(value as AliasKind)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALIAS_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>{t(ALIAS_KIND_KEYS[kind])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={busy || !aliasInput.trim()}
                onClick={async () => {
                  if (await run(() => addCompanyAlias(companyId, aliasInput.trim(), aliasKind))) setAliasInput('');
                }}
              >
                <Plus className="h-4 w-4" />
                {t('identityAddAlias')}
              </Button>
            </div>
          )}
        </section>
      </CardContent>

      <MergeCompanyDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        companyId={companyId}
        companyName={companyName}
        onMerged={(targetId) => {
          setMergeOpen(false);
          router.push('/admin/companies/' + targetId);
        }}
      />
    </Card>
  );
}

/* ── Merge dialog ───────────────────────────────────────────────────────── */

function MergeCompanyDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  onMerged: (targetId: string) => void;
}) {
  const t = useTranslations('AdminCompanyDetail');
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [targetId, setTargetId] = React.useState('');
  const [typed, setTyped] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Clear the previous attempt as the dialog opens, not a frame later.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTargetId('');
      setTyped('');
    }
  }

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    companyService
      .list()
      .then((rows) => !cancelled && setCompanies(rows.filter((row) => row.id !== companyId)));
    return () => {
      cancelled = true;
    };
  }, [open, companyId]);

  // Typing the name is the whole safety mechanism: this deletes THIS company
  // row, and a mis-click on a picker must not be able to do that.
  const confirmed = typed.trim().toLowerCase() === companyName.trim().toLowerCase();

  async function merge() {
    if (!targetId || !confirmed) return;
    setBusy(true);
    try {
      const result = await mergeCompanies(companyId, targetId);
      if (!result.ok) {
        toast({
          variant: 'danger',
          title: t('mergeBlockedTitle'),
          description:
            result.reason === 'financial_records'
              ? t('mergeBlockedFinancial', { details: result.details ?? '' })
              : result.reason === 'linked_records'
                ? t('mergeBlockedLinked')
                : t('identityErrorGeneric'),
        });
        return;
      }
      const moved = Object.values(result.moved).reduce((total, count) => total + count, 0);
      toast({
        variant: 'success',
        title: t('mergeDoneTitle'),
        description: t('mergeDoneDescription', { name: result.sourceName, rows: moved }),
      });
      onMerged(targetId);
    } catch {
      toast({ variant: 'danger', title: t('mergeBlockedTitle'), description: t('identityErrorGeneric') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('mergeDialogTitle')}</DialogTitle>
          <DialogDescription>{t('mergeDialogDescription', { name: companyName })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-lg border border-danger-subtle bg-danger-subtle/40 p-3 text-sm text-danger-text">
            {t('mergeWarning', { name: companyName })}
          </p>

          <div className="space-y-1.5">
            <Label>{t('mergeTargetLabel')}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder={t('mergeTargetPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.tradingName ?? company.legalName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="merge-confirm">{t('mergeTypeToConfirm', { name: companyName })}</Label>
            <Input
              id="merge-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={companyName}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('identityCancel')}</Button>
          <Button variant="destructive" disabled={busy || !targetId || !confirmed} onClick={() => void merge()}>
            {t('mergeConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
