'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Ban, Pencil, Plus, Trash2 } from 'lucide-react';
import { doNotContactService, companyService } from '@/lib/mock-services';
import { useSession } from '@/components/providers/session-provider';
import { can } from '@/lib/permissions';
import type { Company, DoNotContactEntry, DoNotContactReason, Locale } from '@/lib/types';
import { DO_NOT_CONTACT_REASONS } from '@/lib/types';
import { doNotContactReasonLabel, draftForCompany } from '@/lib/do-not-contact';
import { useStaffDirectory } from '@/lib/hooks/use-staff';
import { formatDate, flagEmoji } from '@/lib/formatting';
import { Link } from '@/lib/i18n/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { CompanyLogo } from '@/components/shared/company-logo';
import { FadeIn } from '@/components/shared/motion';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

const ALL = '__all__';

/** Display name for a company id, falling back to the id when it is unknown. */
function companyName(companies: Map<string, Company>, id: string): string {
  const c = companies.get(id);
  return c ? c.tradingName || c.legalName : id;
}

export default function DoNotContactPage() {
  const t = useTranslations('AdminDoNotContact');
  const locale = useLocale() as Locale;
  const { session } = useSession();
  const role = session?.role;
  // Everyone internal may READ this list — that is the whole point of it. Only
  // the roles holding do_not_contact.manage see the write controls.
  const canManage = !!role && can(role, 'do_not_contact.manage');

  const { nameOf } = useStaffDirectory();
  const [rows, setRows] = React.useState<DoNotContactEntry[] | null>(null);
  const [companies, setCompanies] = React.useState<Map<string, Company>>(new Map());
  const [fReason, setFReason] = React.useState(ALL);
  const [addOpen, setAddOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<DoNotContactEntry | null>(null);
  const [removing, setRemoving] = React.useState<DoNotContactEntry | null>(null);

  React.useEffect(() => {
    doNotContactService.list().then(setRows);
    companyService.list().then((l) => setCompanies(new Map(l.map((c) => [c.id, c]))));
  }, []);

  const filtered = React.useMemo(() => {
    const all = rows ?? [];
    return fReason === ALL ? all : all.filter((e) => e.reason === fReason);
  }, [rows, fReason]);

  /* ── mutations ── */

  function applySaved(entry: DoNotContactEntry, created: boolean) {
    setRows((prev) => {
      const list = prev ?? [];
      return created ? [entry, ...list] : list.map((e) => (e.id === entry.id ? entry : e));
    });
  }

  async function remove(entry: DoNotContactEntry) {
    const name = companyName(companies, entry.companyId);
    const snapshot = rows;
    setRows((prev) => (prev ? prev.filter((e) => e.id !== entry.id) : prev));
    setRemoving(null);
    try {
      await doNotContactService.remove(entry.id);
      toast({ variant: 'success', title: t('toastRemovedTitle'), description: t('toastRemovedDescription', { name }) });
    } catch {
      setRows(snapshot);
      toast({ variant: 'danger', title: t('toastFailedTitle'), description: t('toastFailedDescription') });
    }
  }

  /* ── columns ── */

  const columns: Column<DoNotContactEntry>[] = [
    {
      key: 'company',
      header: t('colCompany'),
      sortable: true,
      sortValue: (e) => companyName(companies, e.companyId),
      cell: (e) => {
        const c = companies.get(e.companyId);
        return (
          <div className="flex items-center gap-3">
            {c && <CompanyLogo company={c} size="md" />}
            <Link
              href={`/admin/companies/${e.companyId}`}
              className="min-w-0 truncate font-medium text-foreground hover:text-brand-molecular hover:underline motion-safe:transition-colors motion-safe:duration-150 dark:hover:text-brand-blueBright"
            >
              {companyName(companies, e.companyId)}
            </Link>
          </div>
        );
      },
    },
    {
      key: 'country',
      header: t('colCountry'),
      sortable: true,
      hideable: true,
      sortValue: (e) => companies.get(e.companyId)?.country ?? '',
      cell: (e) => {
        const c = companies.get(e.companyId);
        return c ? (
          <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="text-base">{flagEmoji(c.countryCode)}</span>
            {c.country}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        );
      },
    },
    {
      key: 'reason',
      header: t('colReason'),
      sortable: true,
      sortValue: (e) => doNotContactReasonLabel(e.reason),
      cell: (e) => <StatusBadge kind="doNotContactReason" value={e.reason} />,
    },
    {
      key: 'notes',
      header: t('colNotes'),
      hideable: true,
      sortValue: (e) => e.notes ?? '',
      cell: (e) =>
        e.notes ? (
          <span className="line-clamp-2 max-w-md text-sm text-muted-foreground" title={e.notes}>
            {e.notes}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: 'addedBy',
      header: t('colAddedBy'),
      sortable: true,
      hideable: true,
      sortValue: (e) => nameOf(e.addedById, t('unknownAuthor')),
      cell: (e) => <span className="text-sm">{nameOf(e.addedById, t('unknownAuthor'))}</span>,
    },
    {
      key: 'addedOn',
      header: t('colAddedOn'),
      sortable: true,
      sortValue: (e) => e.createdAt,
      cell: (e) => <span className="text-sm text-muted-foreground">{formatDate(e.createdAt, locale)}</span>,
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: rows?.length ?? 0 })}
        actions={
          canManage ? (
            <Button variant="gold" onClick={() => setAddOpen(true)}>
              <Plus /> {t('addCompany')}
            </Button>
          ) : null
        }
      />

      <FadeIn>
        <DataTable<DoNotContactEntry>
          data={filtered}
          columns={columns}
          getRowId={(e) => e.id}
          loading={rows === null}
          searchable
          searchPlaceholder={t('searchPlaceholder')}
          searchValue={(e) => [companyName(companies, e.companyId), e.notes ?? ''].join(' ')}
          density="compact"
          enableDensityToggle
          enableColumnVisibility
          storageKey="do-not-contact"
          exportFilename="do-not-contact"
          defaultSortKey="addedOn"
          defaultSortDir="desc"
          emptyTitle={t('emptyTitle')}
          emptyDescription={t('emptyDescription')}
          toolbar={
            <Select value={fReason} onValueChange={setFReason}>
              <SelectTrigger className="h-9 w-full sm:w-[180px]" aria-label={t('reasonPlaceholder')}>
                <SelectValue placeholder={t('reasonPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('allReasons')}</SelectItem>
                {DO_NOT_CONTACT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{doNotContactReasonLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
          rowActions={
            canManage
              ? (e) => (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label={t('edit')} onClick={() => setEditing(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={t('remove')} onClick={() => setRemoving(e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              : undefined
          }
        />
      </FadeIn>

      {canManage && (
        <>
          <AddDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            companies={[...companies.values()]}
            listed={rows ?? []}
            onSaved={applySaved}
          />
          <EditDialog
            entry={editing}
            companyLabel={editing ? companyName(companies, editing.companyId) : ''}
            onOpenChange={(o) => !o && setEditing(null)}
            onSaved={(entry) => applySaved(entry, false)}
          />
          <RemoveDialog
            entry={removing}
            companyLabel={removing ? companyName(companies, removing.companyId) : ''}
            onOpenChange={(o) => !o && setRemoving(null)}
            onConfirm={remove}
          />
        </>
      )}
    </div>
  );
}

/* ────────────────────────────── Add ────────────────────────────── */

function AddDialog({ open, onOpenChange, companies, listed, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companies: Company[];
  listed: DoNotContactEntry[];
  onSaved: (entry: DoNotContactEntry, created: boolean) => void;
}) {
  const t = useTranslations('AdminDoNotContact');
  const [companyId, setCompanyId] = React.useState('');

  // A company is on the list once. Rather than hiding the ones already there —
  // which looks like the picker is broken when you go looking for a company you
  // know you listed — they stay selectable and the dialog says what will happen.
  const listedIds = React.useMemo(() => new Set(listed.map((e) => e.companyId)), [listed]);
  const existing = listed.find((e) => e.companyId === companyId);

  const sorted = React.useMemo(
    () => companies.slice().sort((a, b) => (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName)),
    [companies],
  );

  const picked = companies.find((c) => c.id === companyId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setCompanyId(''); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addDialogTitle')}</DialogTitle>
          <DialogDescription>{t('addDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('companyLabel')}</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder={t('selectCompany')} /></SelectTrigger>
              <SelectContent>
                {sorted.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {(c.tradingName || c.legalName) + (listedIds.has(c.id) ? ` · ${t('alreadyListedSuffix')}` : '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {existing && <p className="text-xs text-danger-text">{t('alreadyListedHint')}</p>}
          </div>

          {/* Keyed on the picked company, so choosing a different one builds a
              FRESH form rather than editing the old one's state. That is what
              stops a listed company's reason and notes riding along onto the
              next company you pick — the fields cannot survive a change of
              subject, because the component holding them does not. */}
          <AddDialogFields
            key={companyId}
            companyId={companyId}
            companyLabel={picked ? picked.tradingName || picked.legalName : companyId}
            listed={listed}
            isUpdate={!!existing}
            onSaved={onSaved}
            onClose={() => { setCompanyId(''); onOpenChange(false); }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Reason + notes + the submit buttons, for one picked company.
 *
 * Split out of `AddDialog` purely so it can be remounted per company: its
 * initial state comes from `draftForCompany`, which is a total function of
 * (entries, companyId) and therefore has no "and otherwise leave the old
 * values alone" branch for anyone to forget.
 */
function AddDialogFields({ companyId, companyLabel, listed, isUpdate, onSaved, onClose }: {
  companyId: string;
  companyLabel: string;
  listed: DoNotContactEntry[];
  isUpdate: boolean;
  onSaved: (entry: DoNotContactEntry, created: boolean) => void;
  /** Closes the dialog AND clears the picked company, so it reopens clean. */
  onClose: () => void;
}) {
  const t = useTranslations('AdminDoNotContact');
  const draft = draftForCompany(listed, companyId);
  const [reason, setReason] = React.useState<DoNotContactReason>(draft.reason);
  const [notes, setNotes] = React.useState(draft.notes);
  const [submitting, setSubmitting] = React.useState(false);

  async function submit() {
    if (!companyId || submitting) return;
    setSubmitting(true);
    try {
      const { entry, created } = await doNotContactService.add({ companyId, reason, notes });
      onSaved(entry, created);
      toast({
        variant: 'success',
        title: created ? t('toastAddedTitle') : t('toastAlreadyListedTitle'),
        description: created
          ? t('toastAddedDescription', { name: companyLabel })
          : t('toastAlreadyListedDescription', { name: companyLabel }),
      });
      onClose();
    } catch {
      toast({ variant: 'danger', title: t('toastFailedTitle'), description: t('toastFailedDescription') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-1.5">
        <Label>{t('reasonLabel')}</Label>
        <Select value={reason} onValueChange={(v) => setReason(v as DoNotContactReason)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {DO_NOT_CONTACT_REASONS.map((r) => (
              <SelectItem key={r} value={r}>{doNotContactReasonLabel(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dnc-notes">{t('notesLabel')}</Label>
        <Textarea
          id="dnc-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
        />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={submitting}>{t('cancel')}</Button>
        <Button variant="gold" onClick={submit} disabled={!companyId || submitting}>
          {submitting ? t('saving') : isUpdate ? t('updateSubmit') : t('addSubmit')}
        </Button>
      </DialogFooter>
    </>
  );
}

/* ────────────────────────────── Edit ────────────────────────────── */

function EditDialog({ entry, companyLabel, onOpenChange, onSaved }: {
  entry: DoNotContactEntry | null;
  companyLabel: string;
  onOpenChange: (o: boolean) => void;
  onSaved: (entry: DoNotContactEntry) => void;
}) {
  const t = useTranslations('AdminDoNotContact');
  const [reason, setReason] = React.useState<DoNotContactReason>('opt_out');
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!entry) return;
    setReason(entry.reason);
    setNotes(entry.notes ?? '');
  }, [entry]);

  async function submit() {
    if (!entry || submitting) return;
    setSubmitting(true);
    try {
      const updated = await doNotContactService.update(entry.id, { reason, notes });
      // `update` resolves to undefined when the entry is already gone — someone
      // else took this company off the list while the dialog was open. Nothing
      // was saved, so saying "Entry updated" would be a plain lie, and the more
      // dangerous direction of one: it implies the company is still suppressed.
      if (!updated) {
        toast({ variant: 'danger', title: t('toastFailedTitle'), description: t('toastGoneDescription', { name: companyLabel }) });
        onOpenChange(false);
        return;
      }
      onSaved(updated);
      toast({
        variant: 'success',
        title: t('toastUpdatedTitle'),
        description: t('toastUpdatedDescription', { name: companyLabel }),
      });
      onOpenChange(false);
    } catch {
      toast({ variant: 'danger', title: t('toastFailedTitle'), description: t('toastFailedDescription') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('editDialogTitle')}</DialogTitle>
          <DialogDescription>{t('editDialogDescription', { name: companyLabel })}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('reasonLabel')}</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as DoNotContactReason)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DO_NOT_CONTACT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{doNotContactReasonLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dnc-edit-notes">{t('notesLabel')}</Label>
            <Textarea
              id="dnc-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t('cancel')}</Button>
          <Button variant="gold" onClick={submit} disabled={submitting}>
            {submitting ? t('saving') : t('saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────── Remove ────────────────────────────── */

/**
 * The destructive direction. Adding a company to this list is safe; taking one
 * off means the next person to open their record sees nothing stopping them
 * emailing a company that asked to be left alone. So the confirmation names the
 * company, restates why it was listed, and stays disabled until the person
 * acknowledges what removal means — a stray click cannot reach it.
 */
function RemoveDialog({ entry, companyLabel, onOpenChange, onConfirm }: {
  entry: DoNotContactEntry | null;
  companyLabel: string;
  onOpenChange: (o: boolean) => void;
  onConfirm: (entry: DoNotContactEntry) => void;
}) {
  const t = useTranslations('AdminDoNotContact');
  const locale = useLocale() as Locale;
  const [acknowledged, setAcknowledged] = React.useState(false);

  React.useEffect(() => {
    if (entry) setAcknowledged(false);
  }, [entry]);

  return (
    <Dialog open={entry !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-danger-text" aria-hidden />
            {t('removeDialogTitle', { name: companyLabel })}
          </DialogTitle>
          <DialogDescription>{t('removeDialogDescription', { name: companyLabel })}</DialogDescription>
        </DialogHeader>

        {entry && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('colReason')}
              </span>
              <StatusBadge kind="doNotContactReason" value={entry.reason} />
            </div>
            {entry.notes && <p className="text-muted-foreground">{entry.notes}</p>}
            <p className="text-xs text-muted-foreground">
              {t('listedOn', { date: formatDate(entry.createdAt, locale) })}
            </p>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(v) => setAcknowledged(v === true)}
            aria-label={t('removeAcknowledge', { name: companyLabel })}
          />
          <span className="text-muted-foreground">{t('removeAcknowledge', { name: companyLabel })}</span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button
            variant="destructive"
            disabled={!acknowledged || !entry}
            onClick={() => entry && onConfirm(entry)}
          >
            <Trash2 className="h-4 w-4" />
            {t('removeConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
