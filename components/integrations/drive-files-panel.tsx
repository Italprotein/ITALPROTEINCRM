'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, HardDrive, Link2, Loader2, Search, Unlink } from 'lucide-react';

import {
  searchDrive,
  listCompanyDriveLinks,
  linkDriveFileToCompany,
  unlinkDriveFile,
} from '@/lib/services/google.actions';
import { formatDate } from '@/lib/formatting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { toast } from '@/components/ui/use-toast';

/*
 * Drive files attached to a company.
 *
 * The CRM stores a reference, never a copy: the file stays in Drive with its
 * existing sharing, and "unlink" removes only the reference. That keeps one
 * source of truth for a document instead of a CRM copy that silently goes stale.
 */

interface LinkedFile {
  id: string;
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  linkedAt: string;
}

interface FoundFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  owner?: string;
}

/** A readable label for the Google MIME types that actually turn up. */
function kindOf(mimeType: string): string {
  if (mimeType.startsWith('application/vnd.google-apps.')) {
    const kind = mimeType.slice('application/vnd.google-apps.'.length);
    return kind === 'spreadsheet' ? 'Sheet' : kind === 'presentation' ? 'Slides' : kind === 'document' ? 'Doc' : kind;
  }
  if (mimeType === 'application/pdf') return 'PDF';
  const sub = mimeType.split('/')[1] ?? mimeType;
  return sub.length > 12 ? sub.slice(0, 12) : sub.toUpperCase();
}

export function DriveFilesPanel({ companyId, canEdit }: { companyId: string; canEdit: boolean }) {
  const t = useTranslations('DrivePanel');
  const [linked, setLinked] = React.useState<LinkedFile[] | null>(null);
  const [term, setTerm] = React.useState('');
  const [results, setResults] = React.useState<FoundFile[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [connected, setConnected] = React.useState<boolean | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    listCompanyDriveLinks(companyId).then(setLinked).catch(() => setLinked([]));
  }, [companyId]);

  const runSearch = React.useCallback(async () => {
    setSearching(true);
    try {
      const res = await searchDrive(term);
      setConnected(res.connected);
      setResults(res.files);
      if (res.error) toast({ title: t('searchFailed'), description: res.error, variant: 'danger' });
    } catch {
      toast({ title: t('searchFailed'), variant: 'danger' });
    } finally {
      setSearching(false);
    }
  }, [term, t]);

  async function link(file: FoundFile) {
    setBusyId(file.id);
    try {
      const res = await linkDriveFileToCompany(companyId, file.id);
      if (!res.ok) {
        toast({ title: t('linkFailed'), description: file.name, variant: 'danger' });
        return;
      }
      setLinked(await listCompanyDriveLinks(companyId));
      toast({
        title: res.alreadyLinked ? t('alreadyLinked') : t('linked'),
        description: file.name,
        variant: 'success',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function unlink(row: LinkedFile) {
    setBusyId(row.id);
    // Optimistic: the row disappears at once, and the reload below is the truth.
    setLinked((prev) => prev?.filter((l) => l.id !== row.id) ?? null);
    try {
      await unlinkDriveFile(row.id);
      setLinked(await listCompanyDriveLinks(companyId));
    } finally {
      setBusyId(null);
    }
  }

  const linkedIds = new Set((linked ?? []).map((l) => l.fileId));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HardDrive className="h-4 w-4 text-brand-teal" />
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        {linked !== null && <span className="text-xs text-muted-foreground">({linked.length})</span>}
      </div>

      {linked === null ? (
        <div className="skeleton h-16 w-full" />
      ) : linked.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {linked.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-2xs font-semibold text-muted-foreground">
                  {kindOf(row.mimeType).slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={row.name}>{row.name}</p>
                  <p className="text-xs text-muted-foreground">{t('linkedOn', { date: formatDate(row.linkedAt) })}</p>
                </div>
                {row.webViewLink && (
                  <Button variant="ghost" size="icon-sm" className="shrink-0" asChild aria-label={t('openInDrive')}>
                    <a href={row.webViewLink} target="_blank" rel="noopener noreferrer"><ExternalLink /></a>
                  </Button>
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    disabled={busyId === row.id}
                    onClick={() => unlink(row)}
                    aria-label={t('unlink')}
                  >
                    <Unlink />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={t('noneLinked')} className="py-6" />
      )}

      {canEdit && (
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); void runSearch(); }}
          >
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="h-9 min-w-0 flex-1"
            />
            <Button type="submit" size="sm" className="shrink-0" disabled={searching}>
              {searching ? <Loader2 className="animate-spin" /> : <Search />}
              {t('search')}
            </Button>
          </form>

          {connected === false && (
            <p className="text-xs text-muted-foreground">{t('notConnected')}</p>
          )}

          {results !== null && connected !== false && (
            results.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('noResults')}</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {results.map((file) => (
                  <li key={file.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-2">
                    <span className="w-10 shrink-0 text-2xs font-semibold uppercase text-muted-foreground">
                      {kindOf(file.mimeType).slice(0, 4)}
                    </span>
                    <div className="min-w-0 flex-1 basis-32">
                      <p className="truncate text-sm" title={file.name}>{file.name}</p>
                      {file.modifiedTime && (
                        <p className="truncate text-2xs text-muted-foreground">
                          {t('modifiedOn', { date: formatDate(file.modifiedTime) })}
                          {file.owner ? ` · ${file.owner}` : ''}
                        </p>
                      )}
                    </div>
                    <Button
                      variant={linkedIds.has(file.id) ? 'ghost' : 'outline'}
                      size="sm"
                      className="shrink-0"
                      disabled={busyId === file.id || linkedIds.has(file.id)}
                      onClick={() => link(file)}
                    >
                      {busyId === file.id ? <Loader2 className="animate-spin" /> : <Link2 />}
                      {linkedIds.has(file.id) ? t('alreadyLinked') : t('link')}
                    </Button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  );
}
