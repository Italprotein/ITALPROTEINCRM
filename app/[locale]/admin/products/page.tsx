'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Boxes, Rocket, FlaskConical, Sparkles, Plus, Search } from 'lucide-react';
import { productService, companyService } from '@/lib/mock-services';
import type { Product, Company, ApplicationCategory } from '@/lib/types';
import { APPLICATION_CATEGORIES } from '@/lib/types';
import { getLabel, humanize } from '@/lib/labels';
import { formatDate } from '@/lib/formatting';
import { uid } from '@/lib/utils';
import { Link } from '@/lib/i18n/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { ChartCard, DonutChart, CHART_COLORS } from '@/components/charts/chart-kit';
import { EmptyState } from '@/components/shared/empty-state';
import { Stagger, StaggerItem } from '@/components/shared/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';

const ALL = '__all__';
const STATUSES: Product['status'][] = ['in_development', 'tested', 'launched', 'archived'];
const statusTone: Record<Product['status'], 'success' | 'info' | 'warning' | 'muted'> = {
  launched: 'success', tested: 'info', in_development: 'warning', archived: 'muted',
};

export default function ProductsPage() {
  const t = useTranslations('AdminProducts');
  const [rows, setRows] = React.useState<Product[] | null>(null);
  const [companyMap, setCompanyMap] = React.useState<Map<string, Company>>(new Map());
  const [stats, setStats] = React.useState<Awaited<ReturnType<typeof productService.getStatistics>> | null>(null);
  const [q, setQ] = React.useState('');
  const [fStatus, setFStatus] = React.useState(ALL);
  const [fCat, setFCat] = React.useState(ALL);
  const [createOpen, setCreateOpen] = React.useState(false);

  React.useEffect(() => {
    productService.list().then(setRows);
    productService.getStatistics().then(setStats);
    companyService.list().then((l) => setCompanyMap(new Map(l.map((c) => [c.id, c]))));
  }, []);

  const catDonut = React.useMemo(() => {
    const m = new Map<ApplicationCategory, number>();
    for (const p of rows ?? []) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return [...m.entries()].map(([k, v], i) => ({ name: getLabel('applicationCategory', k), value: v, color: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [rows]);

  const filtered = React.useMemo(() => {
    let d = rows ?? [];
    const s = q.trim().toLowerCase();
    if (s) d = d.filter((p) => [p.name, p.brandName, p.market].filter(Boolean).join(' ').toLowerCase().includes(s));
    if (fStatus !== ALL) d = d.filter((p) => p.status === fStatus);
    if (fCat !== ALL) d = d.filter((p) => p.category === fCat);
    return d;
  }, [rows, q, fStatus, fCat]);

  function handleCreate(p: Product) {
    setRows((prev) => (prev ? [p, ...prev] : [p]));
    setStats((prev) => (prev ? { ...prev, total: prev.total + 1, inDevelopment: prev.inDevelopment + 1 } : prev));
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={<Button variant="gold" onClick={() => setCreateOpen(true)}><Plus /> {t('addProduct')}</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('totalProducts')} value={stats?.total ?? 0} icon={Boxes} tone="gold" />
        <StatCard label={t('launched')} value={stats?.launched ?? 0} icon={Rocket} tone="success" delay={0.05} />
        <StatCard label={t('inDevelopment')} value={stats?.inDevelopment ?? 0} icon={FlaskConical} tone="warning" delay={0.1} />
        <StatCard label={t('tested')} value={(stats ? stats.total - stats.launched - stats.inDevelopment : 0)} icon={Sparkles} tone="info" delay={0.15} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={t('byApplicationTitle')} description={t('byApplicationDescription')} className="lg:col-span-1" loading={rows === null} isEmpty={catDonut.length === 0}>
          <DonutChart data={catDonut} centerLabel={t('donutCenterLabel')} />
        </ChartCard>

        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-8" />
              </div>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-10 w-[150px]"><SelectValue placeholder={t('statusPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('allStatuses')}</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{humanize(s)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fCat} onValueChange={setFCat}>
                <SelectTrigger className="h-10 w-[150px]"><SelectValue placeholder={t('applicationPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('allApplications')}</SelectItem>
                  {APPLICATION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{getLabel('applicationCategory', c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {rows === null ? (
              <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Boxes} title={t('emptyTitle')} description={t('emptyDescription')} />
            ) : (
              <Stagger className="grid gap-3 sm:grid-cols-2">
                {filtered.map((p) => {
                  const c = companyMap.get(p.companyId ?? '');
                  return (
                    <StaggerItem key={p.id}>
                      <div className="h-full rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gold/15 text-brand-goldDark"><Boxes className="h-5 w-5" /></span>
                          <Badge variant={statusTone[p.status]}>{humanize(p.status)}</Badge>
                        </div>
                        <h3 className="mt-3 font-semibold leading-tight">{p.name}</h3>
                        {p.brandName && <p className="text-sm text-muted-foreground">{p.brandName}</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="secondary">{getLabel('applicationCategory', p.category)}</Badge>
                          {p.market && <Badge variant="muted">{p.market}</Badge>}
                        </div>
                        {p.proaminaDosage && <p className="mt-2 text-xs text-muted-foreground">{t('dosageLabel')} <span className="font-medium text-foreground">{p.proaminaDosage}</span></p>}
                        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                          {c ? <Link href={`/admin/companies/${c.id}`} className="font-medium text-foreground hover:text-brand-teal hover:underline">{c.tradingName || c.legalName}</Link> : <span>—</span>}
                          <span>{formatDate(p.createdAt)}</span>
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
              </Stagger>
            )}
          </CardContent>
        </Card>
      </div>

      <AddProductDialog open={createOpen} onOpenChange={setCreateOpen} companies={[...companyMap.values()]} onCreated={handleCreate} />
    </div>
  );
}

function AddProductDialog({ open, onOpenChange, companies, onCreated }: {
  open: boolean; onOpenChange: (o: boolean) => void; companies: Company[]; onCreated: (p: Product) => void;
}) {
  const t = useTranslations('AdminProducts');
  const [name, setName] = React.useState('');
  const [companyId, setCompanyId] = React.useState('');
  const [category, setCategory] = React.useState<ApplicationCategory>('protein_bars');
  const [brandName, setBrandName] = React.useState('');
  const [dosage, setDosage] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const valid = name.trim().length > 0;

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 500));
    const p: Product = {
      id: uid('pr'), name: name.trim(), category, companyId: companyId || undefined,
      brandName: brandName.trim() || undefined, proaminaDosage: dosage.trim() || undefined,
      status: 'in_development', createdAt: new Date().toISOString().slice(0, 10),
    };
    await productService.create(p);
    onCreated(p);
    toast({ variant: 'success', title: t('toastTitle'), description: t('toastDescription', { name: p.name }) });
    setSubmitting(false);
    setName(''); setBrandName(''); setDosage(''); setCompanyId('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pn">{t('productNameLabel')}</Label><Input id="pn" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>{t('companyLabel')}</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder={t('selectCompany')} /></SelectTrigger>
              <SelectContent>
                {companies.slice().sort((a, b) => (a.tradingName || a.legalName).localeCompare(b.tradingName || b.legalName)).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.tradingName || c.legalName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{t('applicationLabel')}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ApplicationCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{APPLICATION_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{getLabel('applicationCategory', c)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="bn">{t('brandNameLabel')}</Label><Input id="bn" value={brandName} onChange={(e) => setBrandName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ds">{t('dosageFieldLabel')}</Label><Input id="ds" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder={t('dosagePlaceholder')} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{t('cancel')}</Button>
          <Button variant="gold" onClick={submit} disabled={!valid || submitting}>{submitting ? t('adding') : t('addProduct')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
