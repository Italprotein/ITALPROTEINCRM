'use client';

import * as React from 'react';
import { Database, Download, FileDown, FileSpreadsheet } from 'lucide-react';

import {
  companyService, contactService, sampleService, shipmentService, ndaService,
  documentService, taskService,
} from '@/lib/mock-services';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

type Row = Record<string, unknown>;
type Dataset = { key: string; label: string; load: () => Promise<Row[]> };

const DATASETS: Dataset[] = [
  { key: 'companies', label: 'Companies', load: () => companyService.list() as unknown as Promise<Row[]> },
  { key: 'contacts', label: 'Contacts', load: () => contactService.list() as unknown as Promise<Row[]> },
  { key: 'samples', label: 'Samples', load: () => sampleService.list() as unknown as Promise<Row[]> },
  { key: 'shipments', label: 'Shipments & logistics', load: () => shipmentService.list() as unknown as Promise<Row[]> },
  { key: 'ndas', label: 'NDA records', load: () => ndaService.list() as unknown as Promise<Row[]> },
  { key: 'documents', label: 'Document index', load: () => documentService.list() as unknown as Promise<Row[]> },
  { key: 'tasks', label: 'Tasks', load: () => taskService.list() as unknown as Promise<Row[]> },
];

function toCsv(rows: Row[]): string {
  if (!rows.length) return '';
  const columns = Array.from(new Set(rows.flatMap(Object.keys))).filter((column) =>
    rows.some((row) => typeof row[column] !== 'object' || row[column] === null));
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n');
}

function saveCsv(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function DownloadDataPage() {
  const [count, setCount] = React.useState(0);
  const [downloading, setDownloading] = React.useState<string | null>(null);

  React.useEffect(() => {
    void Promise.all(DATASETS.map((dataset) => dataset.load()))
      .then((results) => setCount(results.reduce((total, rows) => total + rows.length, 0)));
  }, []);

  async function download(dataset: Dataset) {
    setDownloading(dataset.key);
    try {
      const rows = await dataset.load();
      saveCsv(dataset.key, toCsv(rows));
      toast({ variant: 'success', title: 'Download ready', description: `${rows.length} ${dataset.label.toLowerCase()} exported.` });
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader title="Download Data" subtitle="Download a current CSV copy of CRM records. Data upload has been removed from this area." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Available records" value={count} icon={Database} tone="gold" />
        <StatCard label="Download format" value="CSV" icon={Download} tone="success" delay={0.05} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Download datasets</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {DATASETS.map((dataset) => (
            <div key={dataset.key} className="flex items-center justify-between gap-3 rounded-xl border p-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
                <span className="truncate text-sm font-medium" title={dataset.label}>{dataset.label}</span>
              </div>
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => void download(dataset)} disabled={downloading === dataset.key}>
                <FileDown /> {downloading === dataset.key ? 'Preparing…' : 'Download'}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
