'use client';

import * as React from 'react';
import {
  FileText,
  FileSignature,
  FlaskConical,
  ShieldCheck,
  Truck,
  BarChart3,
  Building2,
  Download,
  Eye,
  Search,
  LayoutGrid,
  List as ListIcon,
  Lock,
  Upload,
  FileSpreadsheet,
  FileImage,
  Presentation,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import { companyService, documentService } from '@/lib/mock-services';
import type { Company, DocumentRecord, DocumentCategory, Locale } from '@/lib/types';
import { can } from '@/lib/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { FadeIn } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { getLabel, getTone } from '@/lib/labels';
import { formatNumber, formatDate } from '@/lib/formatting';
import { toast } from '@/components/ui/use-toast';

const LOCALE: Locale = 'en';

/** File-type icon. */
function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  switch (fileType.toLowerCase()) {
    case 'xlsx':
    case 'csv':
      return <FileSpreadsheet className={className} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
      return <FileImage className={className} />;
    case 'pptx':
    case 'ppt':
      return <Presentation className={className} />;
    default:
      return <FileText className={className} />;
  }
}

/** Logical grouping shown to the company, derived from category + access level. */
type GroupKey =
  | 'signature'
  | 'technical'
  | 'regulatory'
  | 'shipment'
  | 'reports'
  | 'company'
  | 'other';

interface GroupDef {
  key: GroupKey;
  label: string;
  description: string;
  icon: LucideIcon;
}

const GROUPS: GroupDef[] = [
  { key: 'signature', label: 'Requires your signature', description: 'Agreements to review and sign.', icon: FileSignature },
  { key: 'technical', label: 'Technical files', description: 'Data sheets and application guides.', icon: FlaskConical },
  { key: 'regulatory', label: 'Regulatory & certificates', description: 'Compliance and safety documents.', icon: ShieldCheck },
  { key: 'shipment', label: 'Shipment & quality', description: 'Certificates of analysis and price lists.', icon: Truck },
  { key: 'reports', label: 'Shared reports', description: 'Presentations and marketing materials.', icon: BarChart3 },
  { key: 'company', label: 'Your uploads', description: 'Documents you have shared with us.', icon: Building2 },
  { key: 'other', label: 'Other documents', description: 'Everything else shared with you.', icon: FileText },
];

function groupOf(doc: DocumentRecord): GroupKey {
  if (doc.category === 'nda') return 'signature';
  if (doc.category === 'technical_data_sheet' || doc.category === 'application_guide') return 'technical';
  if (doc.category === 'regulatory' || doc.category === 'safety_data_sheet' || doc.category === 'certificate') {
    // COAs are tied to a specific company/shipment → show under shipment & quality.
    if (doc.category === 'certificate' && doc.companyId) return 'shipment';
    return 'regulatory';
  }
  if (doc.category === 'price_list') return 'shipment';
  if (doc.category === 'presentation' || doc.category === 'marketing') return 'reports';
  // Anything the company itself shared (company-specific 'other'/'photo').
  if (doc.companyId && (doc.category === 'other' || doc.category === 'photo')) return 'company';
  return 'other';
}

export default function PortalDocumentsPage() {
  const { session, ready } = useSession();
  const companyId = session?.companyId;
  const role = session?.role;

  const [company, setCompany] = React.useState<Company | null>(null);
  const [docs, setDocs] = React.useState<DocumentRecord[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const [query, setQuery] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<DocumentCategory | 'all'>('all');
  const [view, setView] = React.useState<'grid' | 'list'>('grid');

  const [preview, setPreview] = React.useState<DocumentRecord | null>(null);
  const [signing, setSigning] = React.useState<DocumentRecord | null>(null);

  const reload = React.useCallback(() => {
    if (!companyId) return;
    let cancelled = false;
    companyService.get(companyId).then((c) => {
      if (cancelled || !c) {
        if (!cancelled) setLoaded(true);
        return;
      }
      setCompany(c);
      documentService.forPortal(c.id, c.ndaStatus === 'fully_signed').then((list) => {
        if (cancelled) return;
        setDocs(list);
        setLoaded(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const ndaSigned = company?.ndaStatus === 'fully_signed';
  const canUpload = role ? can(role, 'portal.request_docs') : false;

  const availableCategories = React.useMemo(() => {
    const set = new Set<DocumentCategory>();
    docs.forEach((d) => set.add(d.category));
    return Array.from(set).sort();
  }, [docs]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        getLabel('documentCategory', d.category).toLowerCase().includes(q) ||
        (d.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [docs, query, categoryFilter]);

  const grouped = React.useMemo(() => {
    const map = new Map<GroupKey, DocumentRecord[]>();
    for (const d of filtered) {
      const g = groupOf(d);
      const arr = map.get(g) ?? [];
      arr.push(d);
      map.set(g, arr);
    }
    return map;
  }, [filtered]);

  function handleUploaded() {
    // The upload dialog persists via documentService.create — refresh the list.
    reload();
  }

  if (!ready || (companyId && !loaded)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!companyId || !company) {
    return (
      <div className="space-y-6">
        <PageHeader title="Documents" />
        <EmptyState
          icon={FileText}
          title="No company linked to your account"
          description="We couldn't load your document library. Please contact your Italprotein account manager."
        />
      </div>
    );
  }

  const signatureCount = docs.filter((d) => groupOf(d) === 'signature').length;
  const technicalCount = docs.filter((d) => groupOf(d) === 'technical').length;
  const regulatoryCount = docs.filter((d) => groupOf(d) === 'regulatory').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        subtitle="Technical, regulatory and project files Italprotein has shared with you."
        actions={
          canUpload ? (
            <UploadDialog companyId={company.id} onUploaded={handleUploaded} />
          ) : (
            <Button variant="outline" disabled title="You don't have permission to upload documents">
              <Upload className="h-4 w-4" /> Upload document
            </Button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available documents" value={docs.length} icon={FileText} tone="default" hint="Shared with your company" />
        <StatCard label="Technical files" value={technicalCount} icon={FlaskConical} tone="info" hint="Data sheets & guides" />
        <StatCard label="Regulatory & certificates" value={regulatoryCount} icon={ShieldCheck} tone="success" hint="Compliance documents" />
        <StatCard label="Awaiting signature" value={signatureCount} icon={FileSignature} tone={signatureCount > 0 ? 'warning' : 'default'} hint="Agreements to review" />
      </div>

      {!ndaSigned && (
        <FadeIn>
          <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-subtle p-4 text-sm">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
            <div>
              <p className="font-medium text-warning-foreground">More documents unlock after the NDA is signed</p>
              <p className="mt-0.5 text-muted-foreground">
                Confidential technical specifications, trial reports and company-specific files become available once your
                NDA is fully signed. Current NDA status: {getLabel('ndaStatus', company.ndaStatus)}.
              </p>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Toolbar: search + category filter + view toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="pl-9"
            aria-label="Search documents"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as DocumentCategory | 'all')}>
            <SelectTrigger className="w-[200px]" aria-label="Filter by category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {availableCategories.map((c) => (
                <SelectItem key={c} value={c}>
                  {getLabel('documentCategory', c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              type="button"
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setView('grid')}
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setView('list')}
              aria-label="List view"
              aria-pressed={view === 'list'}
            >
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No documents match your filters"
          description="Try a different search term or category, or clear the filters to see everything shared with you."
          action={
            (query || categoryFilter !== 'all') ? (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setCategoryFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const items = grouped.get(group.key);
            if (!items || items.length === 0) return null;
            return (
              <section key={group.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
                    <group.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold">
                      {group.label} <span className="text-muted-foreground">({items.length})</span>
                    </h2>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                </div>

                {view === 'grid' ? (
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((doc) => (
                      <DocumentCard
                        key={doc.id}
                        doc={doc}
                        requiresSignature={group.key === 'signature'}
                        onPreview={() => setPreview(doc)}
                        onSign={() => setSigning(doc)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y rounded-lg border">
                    {items.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        requiresSignature={group.key === 'signature'}
                        onPreview={() => setPreview(doc)}
                        onSign={() => setSigning(doc)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <PreviewSheet doc={preview} onOpenChange={(o) => !o && setPreview(null)} />
      <SignDialog doc={signing} onOpenChange={(o) => !o && setSigning(null)} />
    </div>
  );
}

function downloadToast(doc: DocumentRecord) {
  toast({ title: 'Downloading…', description: `${doc.name} will download shortly.` });
}

function DocumentCard({
  doc,
  requiresSignature,
  onPreview,
  onSign,
}: {
  doc: DocumentRecord;
  requiresSignature: boolean;
  onPreview: () => void;
  onSign: () => void;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
          <FileTypeIcon fileType={doc.fileType} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-snug" title={doc.name}>
            {doc.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant={categoryTone(doc.category)}>{getLabel('documentCategory', doc.category)}</Badge>
            {doc.version && <span className="text-xs text-muted-foreground">{doc.version}</span>}
          </div>
        </div>
      </div>

      {doc.description && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{doc.description}</p>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span>{doc.fileType}</span>
        {doc.sizeKb != null && <span>{formatNumber(doc.sizeKb, LOCALE)} KB</span>}
        <span className="normal-case">{formatDate(doc.uploadedAt, LOCALE)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 pt-1">
        {requiresSignature ? (
          <Button size="sm" variant="gold" onClick={onSign}>
            <PenLine className="h-4 w-4" /> Review &amp; sign
          </Button>
        ) : (
          <Button size="sm" onClick={() => downloadToast(doc)}>
            <Download className="h-4 w-4" /> Download
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onPreview}>
          <Eye className="h-4 w-4" /> Preview
        </Button>
      </div>
    </div>
  );
}

function DocumentRow({
  doc,
  requiresSignature,
  onPreview,
  onSign,
}: {
  doc: DocumentRecord;
  requiresSignature: boolean;
  onPreview: () => void;
  onSign: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
        <FileTypeIcon fileType={doc.fileType} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={doc.name}>
          {doc.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <Badge variant={categoryTone(doc.category)}>{getLabel('documentCategory', doc.category)}</Badge>
          {doc.version && <span>{doc.version}</span>}
          <span className="uppercase">{doc.fileType}</span>
          {doc.sizeKb != null && <span>{formatNumber(doc.sizeKb, LOCALE)} KB</span>}
          <span>{formatDate(doc.uploadedAt, LOCALE)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {requiresSignature ? (
          <Button size="sm" variant="gold" onClick={onSign}>
            <PenLine className="h-4 w-4" /> Review &amp; sign
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => downloadToast(doc)}>
            <Download className="h-4 w-4" /> Download
          </Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onPreview} aria-label="Preview">
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function categoryTone(category: DocumentCategory) {
  // Reuse the central tone mapping so badges match the rest of the app.
  return getTone('documentCategory', category);
}

function PreviewSheet({ doc, onOpenChange }: { doc: DocumentRecord | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!doc} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="max-w-lg">
        {doc && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-8">{doc.name}</SheetTitle>
              <SheetDescription>
                {getLabel('documentCategory', doc.category)}
                {doc.version ? ` · ${doc.version}` : ''} · {doc.fileType.toUpperCase()}
                {doc.sizeKb != null ? ` · ${formatNumber(doc.sizeKb, LOCALE)} KB` : ''}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 p-8 text-center">
              <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl bg-brand-navy/5 text-brand-navy">
                <FileTypeIcon fileType={doc.fileType} className="h-8 w-8" />
              </span>
              <p className="text-sm font-medium">Preview not available yet</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Download the file to view its full contents. A live preview will be available in the production portal.
              </p>
            </div>

            {doc.description && (
              <p className="text-sm text-muted-foreground">{doc.description}</p>
            )}
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Uploaded</dt>
                <dd className="font-medium">{formatDate(doc.uploadedAt, LOCALE)}</dd>
              </div>
              {doc.downloadCount != null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Downloads</dt>
                  <dd className="font-medium tabular">{formatNumber(doc.downloadCount, LOCALE)}</dd>
                </div>
              )}
            </dl>

            <SheetFooter>
              <SheetClose asChild>
                <Button variant="outline">Close</Button>
              </SheetClose>
              <Button onClick={() => downloadToast(doc)}>
                <Download className="h-4 w-4" /> Download
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function SignDialog({ doc, onOpenChange }: { doc: DocumentRecord | null; onOpenChange: (open: boolean) => void }) {
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSign() {
    if (!doc) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    setSubmitting(false);
    onOpenChange(false);
    toast({ title: 'Signature request sent', description: `We've logged your intent to sign “${doc.name}”. Your account manager will follow up.` });
  }

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent>
        {doc && (
          <>
            <DialogHeader>
              <DialogTitle>Review &amp; sign</DialogTitle>
              <DialogDescription>
                You&apos;re about to confirm your review of <span className="font-medium text-foreground">{doc.name}</span>.
                In the production portal this opens a secure e-signature flow.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Document</span>
                <span className="font-medium">{getLabel('documentCategory', doc.category)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">Last updated</span>
                <span className="font-medium">{formatDate(doc.uploadedAt, LOCALE)}</span>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="gold" onClick={handleSign} disabled={submitting}>
                <PenLine className="h-4 w-4" /> {submitting ? 'Submitting…' : 'Confirm & sign'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ companyId, onUploaded }: { companyId: string; onUploaded: () => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState<DocumentCategory>('other');
  const [description, setDescription] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const UPLOADABLE: DocumentCategory[] = ['other', 'technical_data_sheet', 'regulatory', 'certificate', 'presentation'];

  function reset() {
    setName('');
    setCategory('other');
    setDescription('');
  }

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    const ext = trimmed.includes('.') ? trimmed.split('.').pop()!.toLowerCase() : 'pdf';
    await documentService.create({
      id: `doc_upload_${Date.now()}`,
      name: trimmed.includes('.') ? trimmed : `${trimmed}.pdf`,
      category,
      accessLevel: 'company_specific',
      companyId,
      fileType: ext,
      sizeKb: Math.floor(80 + Math.random() * 400),
      uploadedAt: new Date().toISOString().slice(0, 10),
      description: description.trim() || undefined,
      downloadCount: 0,
    });
    setSubmitting(false);
    setOpen(false);
    reset();
    onUploaded();
    toast({ title: 'Document uploaded', description: `“${trimmed}” has been shared with your Italprotein team.` });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <Upload className="h-4 w-4" /> Upload document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload a document</DialogTitle>
          <DialogDescription>
            Share a file with your Italprotein team. It will be visible to your company and our staff only.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-name">File name</Label>
            <Input
              id="doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Our spec requirements.pdf"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
              <SelectTrigger id="doc-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UPLOADABLE.map((c) => (
                  <SelectItem key={c} value={c}>
                    {getLabel('documentCategory', c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-desc">Description (optional)</Label>
            <Textarea
              id="doc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A short note about this document…"
              rows={3}
            />
          </div>
          <p className="rounded-md border border-dashed bg-muted/40 p-2 text-xs text-muted-foreground">
            Preview mode: no real file is uploaded. The document record is added to your library.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="gold" onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
