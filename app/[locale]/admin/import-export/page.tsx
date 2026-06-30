'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileSpreadsheet, Database, Upload, Download, UploadCloud, ArrowRight, ArrowLeft, CheckCircle2, FileDown,
} from 'lucide-react';
import {
  companyService, contactService, sampleService, shipmentService, ndaService, documentService, taskService,
} from '@/lib/mock-services';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';

type Loader = () => Promise<Record<string, unknown>[]>;
const ENTITIES = (t: ReturnType<typeof useTranslations>): { key: string; label: string; load: Loader }[] => [
  { key: 'companies', label: t('entityCompanies'), load: () => companyService.list() as unknown as Promise<Record<string, unknown>[]> },
  { key: 'contacts', label: t('entityContacts'), load: () => contactService.list() as unknown as Promise<Record<string, unknown>[]> },
  { key: 'samples', label: t('entitySamples'), load: () => sampleService.list() as unknown as Promise<Record<string, unknown>[]> },
  { key: 'shipments', label: t('entityShipments'), load: () => shipmentService.list() as unknown as Promise<Record<string, unknown>[]> },
  { key: 'ndas', label: t('entityNdas'), load: () => ndaService.list() as unknown as Promise<Record<string, unknown>[]> },
  { key: 'documents', label: t('entityDocuments'), load: () => documentService.list() as unknown as Promise<Record<string, unknown>[]> },
  { key: 'tasks', label: t('entityTasks'), load: () => taskService.list() as unknown as Promise<Record<string, unknown>[]> },
];

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter((c) => {
    const v = rows[0][c];
    return typeof v !== 'object' || v === null;
  });
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

function downloadCsv(name: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${name}.csv`; a.click();
  URL.revokeObjectURL(url);
}

const SAMPLE_ROWS = [
  { 'Company name': 'Oatly AB', Country: 'Sweden', Type: 'fb_manufacturer', Email: 'rd@oatly.com' },
  { 'Company name': 'Granarolo S.p.A.', Country: 'Italy', Type: 'dairy_manufacturer', Email: 'innovation@granarolo.it' },
  { 'Company name': 'Andros', Country: 'France', Type: 'fb_manufacturer', Email: 'contact@andros.fr' },
];

export default function ImportExportPage() {
  const t = useTranslations('AdminImportExport');
  const entities = React.useMemo(() => ENTITIES(t), [t]);
  const [counts, setCounts] = React.useState<number | null>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);

  // import wizard
  const [step, setStep] = React.useState(0);
  const [entity, setEntity] = React.useState('companies');
  const [importing, setImporting] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    Promise.all(entities.map((e) => e.load())).then((all) => setCounts(all.reduce((s, a) => s + a.length, 0)));
  }, [entities]);

  async function exportEntity(e: ReturnType<typeof ENTITIES>[number]) {
    setExporting(e.key);
    const rows = await e.load();
    await new Promise((r) => setTimeout(r, 300));
    downloadCsv(e.key, toCsv(rows));
    setExporting(null);
    toast({ variant: 'success', title: t('exportReadyTitle'), description: t('exportReadyDescription', { count: rows.length, label: e.label.toLowerCase() }) });
  }

  function runImport() {
    setImporting(true);
    setProgress(0);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          setImporting(false);
          toast({ variant: 'success', title: t('importCompleteTitle'), description: t('importCompleteDescription') });
          setStep(0);
          return 100;
        }
        return p + 10;
      });
    }, 120);
  }

  const steps = [t('stepSource'), t('stepUpload'), t('stepMapColumns'), t('stepConfirm')];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t('statTotalRecords')} value={counts ?? 0} icon={Database} tone="gold" />
        <StatCard label={t('statLastImport')} value={t('lastImportDate')} icon={Upload} tone="info" delay={0.05} />
        <StatCard label={t('statLastExport')} value={t('lastExportDate')} icon={Download} tone="success" delay={0.1} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Import wizard */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" /> {t('importCardTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Stepper */}
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
                <React.Fragment key={s}>
                  <div className={`flex items-center gap-1.5 ${i <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-2xs font-semibold ${i < step ? 'bg-success text-success-foreground' : i === step ? 'bg-brand-gold text-brand-navy' : 'bg-muted'}`}>
                      {i < step ? '✓' : i + 1}
                    </span>
                    <span className="hidden text-xs font-medium sm:inline">{s}</span>
                  </div>
                  {i < steps.length - 1 && <div className={`h-px flex-1 ${i < step ? 'bg-success' : 'bg-border'}`} />}
                </React.Fragment>
              ))}
            </div>

            <div className="min-h-[180px]">
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                  {step === 0 && (
                    <div className="space-y-2">
                      <Label>{t('entityToImport')}</Label>
                      <Select value={entity} onValueChange={setEntity}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{entities.map((e) => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{t('entityToImportHelp')}</p>
                    </div>
                  )}
                  {step === 1 && (
                    <label className="surface-quiet flex h-40 cursor-pointer flex-col items-center justify-center gap-2 text-center">
                      <UploadCloud className="h-8 w-8 text-muted-foreground/60" />
                      <span className="text-sm font-medium">{t('dragDrop')}</span>
                      <span className="text-xs text-muted-foreground">{t('dragDropHelp')}</span>
                      <input type="file" accept=".csv" className="hidden" onChange={() => toast({ title: t('fileAttachedTitle'), description: t('fileAttachedDescription') })} />
                    </label>
                  )}
                  {step === 2 && (
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader><TableRow>{Object.keys(SAMPLE_ROWS[0]).map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                        <TableBody>
                          {SAMPLE_ROWS.map((r, i) => (
                            <TableRow key={i}>{Object.values(r).map((v, j) => <TableCell key={j} className="text-sm">{v}</TableCell>)}</TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="p-2 text-2xs text-muted-foreground">{t('mapPreview', { entity: entities.find((e) => e.key === entity)?.label ?? '' })}</p>
                    </div>
                  )}
                  {step === 3 && (
                    <div className="space-y-3">
                      {importing ? (
                        <div className="space-y-2 py-6">
                          <p className="text-center text-sm font-medium">{t('importing')}</p>
                          <Progress value={progress} />
                          <p className="text-center text-2xs tabular text-muted-foreground">{progress}%</p>
                        </div>
                      ) : (
                        <div className="surface-quiet flex flex-col items-center gap-2 p-6 text-center">
                          <CheckCircle2 className="h-8 w-8 text-success" />
                          <p className="text-sm font-medium">{t('readyToImport')}</p>
                          <p className="text-xs text-muted-foreground">{t('intoEntity', { entity: entities.find((e) => e.key === entity)?.label ?? '' })}</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || importing}><ArrowLeft /> {t('back')}</Button>
              {step < 3 ? (
                <Button variant="gold" onClick={() => setStep((s) => s + 1)}>{t('next')} <ArrowRight /></Button>
              ) : (
                <Button variant="success" onClick={runImport} disabled={importing}><CheckCircle2 /> {importing ? t('importing') : t('runImport')}</Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Export */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> {t('exportCardTitle')}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="mb-1 text-sm text-muted-foreground">{t('exportHelp')}</p>
            {entities.map((e) => (
              <div key={e.key} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy"><FileSpreadsheet className="h-4 w-4" /></span>
                  <span className="text-sm font-medium">{e.label}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportEntity(e)} disabled={exporting === e.key}>
                  <FileDown /> {exporting === e.key ? t('exporting') : t('exportCsv')}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
