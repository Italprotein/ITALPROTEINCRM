'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Download,
  Eye,
  EyeOff,
  FileText,
  RefreshCw,
  Upload,
} from 'lucide-react';

import { documentService } from '@/lib/mock-services';
import { useSession } from '@/components/providers/session-provider';
import { can } from '@/lib/permissions';
import { isApiMode } from '@/lib/data-mode';
import { getLabel } from '@/lib/labels';
import { formatDate } from '@/lib/formatting';
import type { DocumentCategory, DocumentRecord, Locale } from '@/lib/types';

import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';

/**
 * Shared technical-document library, imported one-way from the Drive folder
 * "Documenti Tecnici". Reached from the Documenti tecnici card on NDA & Documenti.
 */

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const UPLOADABLE: DocumentCategory[] = [
  'technical_data_sheet',
  'safety_data_sheet',
  'application_guide',
  'certificate',
  'regulatory',
  'other',
];

export default function TechnicalDocumentsPage() {
  const t = useTranslations('TechnicalDocs');
  const locale = useLocale() as Locale;
  const { session } = useSession();
  const canManage = !!session?.role && can(session.role, 'technical_docs.manage');

  const [rows, setRows] = React.useState<DocumentRecord[] | null>(null);
  const [syncing, setSyncing] = React.useState(false);

  const load = React.useCallback(() => {
    void documentService.technical().then(setRows);
  }, []);

  React.useEffect(() => load(), [load]);

  async function syncFromDrive() {
    setSyncing(true);
    try {
      const response = await fetch('/api/documents/sync-technical', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) {
        toast({
          variant: 'danger',
          title: t('syncFailedTitle'),
          description:
            result.error === 'TECHNICAL_FOLDER_NOT_CONFIGURED'
              ? t('syncNotConfigured')
              : t('syncFailedDescription'),
        });
        return;
      }
      load();
      toast({
        variant: 'success',
        title: t('syncDoneTitle'),
        description: t('syncDoneDescription', { synced: result.synced, found: result.found }),
      });
      for (const reason of (result.skipped ?? []) as string[]) {
        toast({ variant: 'warning', title: t('syncSkipped'), description: reason });
      }
    } catch {
      toast({ variant: 'danger', title: t('syncFailedTitle'), description: t('syncFailedDescription') });
    } finally {
      setSyncing(false);
    }
  }

  async function toggleVisibility(document: DocumentRecord) {
    const next = document.accessLevel === 'internal' ? 'post_nda' : 'internal';
    setRows((prev) =>
      prev ? prev.map((d) => (d.id === document.id ? { ...d, accessLevel: next } : d)) : prev,
    );
    try {
      await documentService.setTechnicalVisibility(document.id, next);
      toast({
        variant: 'success',
        title: next === 'post_nda' ? t('publishedTitle') : t('withdrawnTitle'),
        description: next === 'post_nda' ? t('publishedDescription') : t('withdrawnDescription'),
      });
    } catch {
      setRows((prev) =>
        prev
          ? prev.map((d) => (d.id === document.id ? { ...d, accessLevel: document.accessLevel } : d))
          : prev,
      );
      toast({ variant: 'danger', title: t('visibilityFailedTitle'), description: t('visibilityFailedDescription') });
    }
  }

  const columns: Column<DocumentRecord>[] = [
    {
      key: 'name',
      header: t('colName'),
      sortValue: (d) => d.name,
      cell: (d) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground" title={d.name}>{d.name}</p>
            <p className="truncate text-xs uppercase text-muted-foreground">{d.fileType}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('colCategory'),
      sortValue: (d) => getLabel('documentCategory', d.category),
      cell: (d) => <StatusBadge kind="documentCategory" value={d.category} />,
      hideable: true,
    },
    {
      key: 'visibility',
      header: t('colVisibility'),
      sortValue: (d) => d.accessLevel,
      cell: (d) =>
        d.accessLevel === 'internal' ? (
          <Badge variant="muted" className="gap-1 text-2xs">
            <EyeOff className="h-3 w-3" />
            {t('visibilityInternal')}
          </Badge>
        ) : (
          <Badge variant="success" className="gap-1 text-2xs">
            <Eye className="h-3 w-3" />
            {t('visibilityClients')}
          </Badge>
        ),
    },
    {
      key: 'size',
      header: t('colSize'),
      align: 'right',
      sortable: true,
      sortValue: (d) => d.sizeKb ?? 0,
      cell: (d) => (
        <span className="whitespace-nowrap text-sm tabular text-muted-foreground">
          {d.sizeKb ? `${Math.round(d.sizeKb)} KB` : '—'}
        </span>
      ),
      hideable: true,
    },
    {
      key: 'uploadedAt',
      header: t('colUpdated'),
      align: 'right',
      sortable: true,
      sortValue: (d) => new Date(d.uploadedAt).getTime(),
      cell: (d) => (
        <span className="whitespace-nowrap text-sm text-muted-foreground">
          {formatDate(d.uploadedAt, locale)}
        </span>
      ),
      hideable: true,
    },
  ];

  function rowActions(d: DocumentRecord) {
    return (
      <div className="flex items-center justify-end gap-1">
        {canManage && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={d.accessLevel === 'internal' ? t('publish') : t('withdraw')}
            title={d.accessLevel === 'internal' ? t('publish') : t('withdraw')}
            onClick={() => void toggleVisibility(d)}
          >
            {d.accessLevel === 'internal' ? <Eye /> : <EyeOff />}
          </Button>
        )}
        {d.downloadAttachmentId && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('download')}
            title={t('download')}
            onClick={() => window.location.assign(`/api/attachments/${d.downloadAttachmentId}`)}
          >
            <Download />
          </Button>
        )}
      </div>
    );
  }

  function mobileCard(d: DocumentRecord) {
    return (
      <Card className="p-3">
        <p className="truncate font-medium text-foreground" title={d.name}>{d.name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge kind="documentCategory" value={d.category} />
          {d.accessLevel === 'internal' ? (
            <Badge variant="muted" className="text-2xs">{t('visibilityInternal')}</Badge>
          ) : (
            <Badge variant="success" className="text-2xs">{t('visibilityClients')}</Badge>
          )}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{formatDate(d.uploadedAt, locale)}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        actions={
          canManage ? (
            <>
              <Button variant="outline" onClick={() => void syncFromDrive()} disabled={syncing || !isApiMode}>
                <RefreshCw className={syncing ? 'animate-spin' : ''} />
                {syncing ? t('syncing') : t('syncFromDrive')}
              </Button>
              <UploadDialog onUploaded={load} disabled={!isApiMode} />
            </>
          ) : undefined
        }
      />

      <DataTable<DocumentRecord>
        data={rows ?? []}
        columns={columns}
        getRowId={(d) => d.id}
        loading={rows === null}
        searchable
        searchPlaceholder={t('searchPlaceholder')}
        searchValue={(d) => [d.name, getLabel('documentCategory', d.category), d.fileType].join(' ')}
        pageSize={15}
        rowActions={rowActions}
        enableColumnVisibility
        enableDensityToggle
        mobileCard={mobileCard}
        emptyTitle={t('emptyTitle')}
        emptyDescription={t('emptyDescription')}
        exportFilename="technical-documents"
        defaultSortKey="uploadedAt"
        defaultSortDir="desc"
        storageKey="technical-documents-table"
      />
    </div>
  );
}

/* ────────────────────────────── Upload dialog ────────────────────────────── */

function UploadDialog({ onUploaded, disabled }: { onUploaded: () => void; disabled?: boolean }) {
  const t = useTranslations('TechnicalDocs');
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<DocumentCategory>('technical_data_sheet');
  const [submitting, setSubmitting] = React.useState(false);

  function reset() {
    setFile(null);
    setName('');
    setCategory('technical_data_sheet');
  }

  async function submit() {
    if (!file || submitting) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast({ variant: 'danger', title: t('uploadFailedTitle'), description: t('uploadTooLarge') });
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('file', file);
      // The server re-checks the right behind this; it is not taken on trust.
      form.append('scope', 'technical');
      form.append('category', category);
      if (name.trim()) form.append('name', name.trim());

      const response = await fetch('/api/documents/upload', { method: 'POST', body: form });
      if (!response.ok) {
        toast({ variant: 'danger', title: t('uploadFailedTitle'), description: t('uploadFailedDescription') });
        return;
      }
      setOpen(false);
      reset();
      onUploaded();
      toast({ variant: 'success', title: t('uploadedTitle'), description: t('uploadedDescription') });
    } catch {
      toast({ variant: 'danger', title: t('uploadFailedTitle'), description: t('uploadFailedDescription') });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="gold" disabled={disabled}>
          <Upload className="h-4 w-4" />
          {t('addDocument')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addDocument')}</DialogTitle>
          <DialogDescription>{t('uploadDialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tech-file">{t('fieldFile')}</Label>
            <Input
              id="tech-file"
              type="file"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                setFile(picked);
                if (picked && !name.trim()) setName(picked.name);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tech-name">{t('fieldName')}</Label>
            <Input id="tech-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('fieldCategory')}</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as DocumentCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPLOADABLE.map((option) => (
                  <SelectItem key={option} value={option}>
                    {getLabel('documentCategory', option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">{t('uploadVisibilityNote')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button variant="gold" onClick={submit} disabled={!file || submitting}>
            {submitting ? t('uploading') : t('addDocument')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
