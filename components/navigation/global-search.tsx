'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, Building2, Handshake, Users, FileSignature, FlaskConical,
  Truck, FileText, ListChecks, CornerDownLeft, ArrowUp, ArrowDown, X,
} from 'lucide-react';
import { useRouter } from '@/lib/i18n/navigation';
import {
  companyService, agencyService, contactService, ndaService,
  sampleService, shipmentService, documentService, taskService,
} from '@/lib/mock-services';
import type {
  Company, Contact, NDA, SampleRequest, Shipment, DocumentRecord, Task,
} from '@/lib/types';
import { getLabel } from '@/lib/labels';
import { readRecents, type RecentRecord } from '@/lib/recent-records';
import { CompanyLogo, type CompanyLogoSubject } from '@/components/shared/company-logo';
import { cn } from '@/lib/utils';

type ResultGroup =
  | 'Companies' | 'Agencies' | 'Contacts' | 'NDAs'
  | 'Samples' | 'Shipments' | 'Documents' | 'Tasks';

interface SearchResult {
  group: ResultGroup;
  id: string;
  label: string;
  detail: string;
  href: string;
  /** Company rows show the company's logo in place of the generic group icon. */
  company?: CompanyLogoSubject;
}

const GROUP_ICON: Record<ResultGroup, typeof Building2> = {
  Companies: Building2,
  Agencies: Handshake,
  Contacts: Users,
  NDAs: FileSignature,
  Samples: FlaskConical,
  Shipments: Truck,
  Documents: FileText,
  Tasks: ListChecks,
};

/** Nav namespace key for each group heading. Documents has no sidebar item, so it borrows Search.documents instead. */
const GROUP_NAV_KEY: Partial<Record<ResultGroup, string>> = {
  Companies: 'companies',
  Agencies: 'agencies',
  Contacts: 'contacts',
  NDAs: 'ndas',
  Samples: 'samples',
  Shipments: 'shipments',
  Tasks: 'tasks',
};

/** RecentRecord.type (singular, e.g. "company") → ResultGroup, for reusing GROUP_ICON on recents. */
const RECENT_TYPE_GROUP: Record<string, ResultGroup> = {
  company: 'Companies',
  agency: 'Agencies',
  contact: 'Contacts',
  nda: 'NDAs',
  sample: 'Samples',
  shipment: 'Shipments',
  document: 'Documents',
  task: 'Tasks',
};

interface Dataset {
  companies: Company[];
  agencies: (Company & { meta?: unknown })[];
  contacts: Contact[];
  ndas: NDA[];
  samples: SampleRequest[];
  shipments: Shipment[];
  documents: DocumentRecord[];
  tasks: Task[];
}

export function GlobalSearch() {
  const t = useTranslations('Search');
  const tNav = useTranslations('Nav');
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [data, setData] = React.useState<Dataset | null>(null);
  const [recents, setRecents] = React.useState<RecentRecord[]>([]);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function groupLabel(group: ResultGroup): string {
    const navKey = GROUP_NAV_KEY[group];
    return navKey ? tNav(navKey) : t('documents');
  }

  function recentIcon(type: string) {
    const group = RECENT_TYPE_GROUP[type];
    return group ? GROUP_ICON[group] : Building2;
  }

  // Cmd/Ctrl+K to open, '/' shortcut too.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lazy-load datasets the first time the palette opens.
  React.useEffect(() => {
    if (!open || data) return;
    Promise.all([
      companyService.list(), agencyService.list(), contactService.list(), ndaService.list(),
      sampleService.list(), shipmentService.list(), documentService.list(), taskService.list(),
    ]).then(([companies, agencies, contacts, ndas, samples, shipments, documents, tasks]) => {
      setData({ companies, agencies, contacts, ndas, samples, shipments, documents, tasks });
    });
  }, [open, data]);

  React.useEffect(() => {
    if (open) {
      // Refreshed on every open so a record visited elsewhere in the same
      // session (e.g. a company detail page) shows up immediately.
      setRecents(readRecents());
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = React.useMemo<SearchResult[]>(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchResult[] = [];
    const companyName = (id: string) => {
      const c = data.companies.find((x) => x.id === id) ?? data.agencies.find((x) => x.id === id);
      return c ? c.tradingName || c.legalName : '';
    };
    const match = (...parts: (string | undefined)[]) =>
      parts.filter(Boolean).join(' ').toLowerCase().includes(q);

    for (const c of data.companies) {
      if (match(c.legalName, c.tradingName, c.country, c.city, ...(c.tags ?? [])))
        out.push({ group: 'Companies', id: c.id, label: c.tradingName || c.legalName, detail: `${c.country} · ${getLabel('companyType', c.type)}`, href: `/admin/companies/${c.id}`, company: c });
    }
    for (const a of data.agencies) {
      if (match(a.legalName, a.tradingName, a.territory, a.country))
        out.push({ group: 'Agencies', id: a.id, label: a.tradingName || a.legalName, detail: a.territory || a.country, href: `/admin/agencies/${a.id}` });
    }
    for (const c of data.contacts) {
      if (match(c.firstName, c.lastName, c.email, c.jobTitle))
        out.push({ group: 'Contacts', id: c.id, label: `${c.firstName} ${c.lastName}`, detail: [c.jobTitle, companyName(c.companyId)].filter(Boolean).join(' · '), href: `/admin/companies/${c.companyId}` });
    }
    for (const n of data.ndas) {
      if (match(n.reference, companyName(n.companyId), n.status))
        out.push({ group: 'NDAs', id: n.id, label: n.reference, detail: `${companyName(n.companyId)} · ${getLabel('ndaStatus', n.status)}`, href: `/admin/ndas?detail=${encodeURIComponent(n.id)}` });
    }
    for (const s of data.samples) {
      if (match(s.reference, s.requestedProduct, companyName(s.companyId), s.status))
        out.push({ group: 'Samples', id: s.id, label: s.reference, detail: `${companyName(s.companyId)} · ${getLabel('sampleStatus', s.status)}`, href: `/admin/samples/${s.id}` });
    }
    for (const s of data.shipments) {
      if (match(s.reference, s.trackingNumber, s.courier, companyName(s.companyId)))
        out.push({ group: 'Shipments', id: s.id, label: s.reference, detail: [s.courier, companyName(s.companyId)].filter(Boolean).join(' · '), href: `/admin/shipments/${s.id}` });
    }
    for (const d of data.documents) {
      if (match(d.name, getLabel('documentCategory', d.category)))
        out.push({ group: 'Documents', id: d.id, label: d.name, detail: getLabel('documentCategory', d.category), href: d.companyId ? `/admin/companies/${d.companyId}` : `/admin/ndas` });
    }
    for (const t of data.tasks) {
      if (match(t.title, companyName(t.companyId ?? ''), t.status))
        out.push({ group: 'Tasks', id: t.id, label: t.title, detail: getLabel('taskStatus', t.status), href: `/admin/tasks` });
    }
    return out.slice(0, 40);
  }, [data, query]);

  React.useEffect(() => { setActive(0); }, [query]);

  function go(r: { href: string }) {
    setOpen(false);
    router.push(r.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  // group results, preserving order
  const grouped = React.useMemo(() => {
    const map = new Map<ResultGroup, SearchResult[]>();
    for (const r of results) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return [...map.entries()];
  }, [results]);

  let flatIndex = -1;

  return (
    <>
      {/* Trigger (replaces the old mock search box) */}
      <button
        onClick={() => setOpen(true)}
        // min-w-0: without it the flex item refuses to shrink below its label,
        // which pushed the whole topbar 269px past a phone viewport.
        className="group flex h-9 min-w-0 max-w-md flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
        aria-label={t('openSearch')}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">{t('trigger')}</span>
        <span className="ml-auto hidden items-center gap-1 sm:flex">
          <kbd className="kbd">⌘</kbd><kbd className="kbd">K</kbd>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-brand-navy/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              role="dialog" aria-modal="true" aria-label={t('placeholder')}
              className="relative w-full max-w-xl overflow-hidden rounded-xl border bg-popover shadow-2xl"
              initial={{ opacity: 0, scale: 0.97, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-2 border-b px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t('placeholder')}
                  className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label={t('close')}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[55vh] overflow-y-auto scrollbar-thin p-2">
                {!data ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-9 w-full" />)}
                  </div>
                ) : !query.trim() ? (
                  recents.length > 0 ? (
                    <div className="mb-1">
                      <p className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{t('recent')}</p>
                      {recents.map((r) => {
                        const Icon = recentIcon(r.type);
                        return (
                          <button
                            key={r.href}
                            onClick={() => go(r)}
                            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent/60"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{r.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {t('hint')}
                    </p>
                  )
                ) : results.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t('empty', { query })}</p>
                ) : (
                  grouped.map(([group, items]) => {
                    const Icon = GROUP_ICON[group];
                    return (
                      <div key={group} className="mb-1">
                        <p className="px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{groupLabel(group)}</p>
                        {items.map((r) => {
                          flatIndex++;
                          const isActive = flatIndex === active;
                          const idx = flatIndex;
                          return (
                            <button
                              key={r.id}
                              onMouseEnter={() => setActive(idx)}
                              onClick={() => go(r)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
                                isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                              )}
                            >
                              {r.company ? (
                                <CompanyLogo company={r.company} size="sm" />
                              ) : (
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                  <Icon className="h-4 w-4" />
                                </span>
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-foreground">{r.label}</span>
                                <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                              </span>
                              {isActive && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-3 border-t px-3 py-2 text-2xs text-muted-foreground">
                <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> {t('navigate')}</span>
                <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> {t('open')}</span>
                <span className="ml-auto flex items-center gap-1"><kbd className="kbd">esc</kbd> {t('close')}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
