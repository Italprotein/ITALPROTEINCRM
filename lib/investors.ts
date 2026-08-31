/**
 * Investor outreach — the pure half.
 *
 * CSV parsing, row mapping and the statistics reducer for the investors
 * register, free of any Prisma import so the importer script, the server
 * actions and the vitest suite all share one source of truth (same split as
 * lib/company-logo.ts / lib/do-not-contact.ts).
 *
 * The source of truth is the campaign workbook exported to
 * assets/Investitori/Investitori_Stato_Contatti-Contatti.csv:
 *   Azienda, Stato, Email, Paese, Città, Dominio, Data primo contatto,
 *   Data ultimo contatto, Tipo di riscontro, Dettagli / prossimo passo, Link email
 */

import type { InvestorStatus } from '@/lib/types';

export const INVESTOR_STATUSES: readonly InvestorStatus[] = [
  'in_contact',
  'to_recontact',
  'rejected',
  'first_contact',
];

/** The workbook's Italian state labels → the enum. Unknown labels map to null. */
const STATUS_BY_LABEL: Record<string, InvestorStatus> = {
  'in contatto': 'in_contact',
  'da ricontattare': 'to_recontact',
  'rifiutato': 'rejected',
  'primo contatto': 'first_contact',
};

export function investorStatusFromLabel(label: string): InvestorStatus | null {
  return STATUS_BY_LABEL[label.trim().toLowerCase()] ?? null;
}

/** What the importer writes and the create/update form submits. */
export interface InvestorInput {
  name: string;
  status: InvestorStatus;
  emails: string[];
  country?: string;
  city?: string;
  domain?: string;
  firstContactAt?: Date;
  lastContactAt?: Date;
  responseType?: string;
  nextStep?: string;
  gmailUrl?: string;
  notes?: string;
}

/**
 * Minimal RFC-4180-ish CSV parser: quoted fields, embedded commas, doubled
 * quotes, CRLF or LF, and a UTF-8 BOM on the first cell. Small on purpose —
 * this parses one known workbook export, not arbitrary CSV, and being here
 * (instead of inside the script) is what lets the vitest suite exercise it:
 * scripts/ is excluded from the typecheck, and logic that hides there has
 * shipped broken before (see the reconcile-script post-mortem).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** dd/MM/yyyy → Date at UTC midnight, or undefined for blank/garbage. */
export function parseItalianDate(value: string | undefined): Date | undefined {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value?.trim() ?? '');
  if (!match) return undefined;
  const [, d, m, y] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  // Reject 31/02-style rollovers rather than silently shifting the month.
  return date.getUTCMonth() === Number(m) - 1 ? date : undefined;
}

/** "a@x.com; b@x.com" → ['a@x.com', 'b@x.com']; junk entries dropped. */
export function splitEmails(value: string | undefined): string[] {
  return (value ?? '')
    .split(';')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

export function normalizeDomain(value: string | undefined): string | undefined {
  const domain = (value ?? '').trim().toLowerCase().replace(/^www\./, '');
  if (!domain.includes('.') || domain.split('.').some((label) => label === '')) return undefined;
  return domain;
}

const blank = (value: string | undefined): string | undefined => {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? undefined : trimmed;
};

export interface CsvImportIssue {
  line: number;
  reason: 'missing_name' | 'unknown_status';
  raw: string;
}

/**
 * Parses the Contatti export into importer inputs.
 *
 * Column positions come from the known header row, looked up by name so a
 * re-export with reordered columns still imports correctly. Rows without a
 * name, and rows whose Stato is not one of the four known labels, are reported
 * as issues rather than silently dropped or guessed at.
 */
export function parseInvestorsCsv(text: string): {
  inputs: InvestorInput[];
  issues: CsvImportIssue[];
} {
  const rows = parseCsv(text);
  const inputs: InvestorInput[] = [];
  const issues: CsvImportIssue[] = [];
  if (rows.length === 0) return { inputs, issues };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.findIndex((h) => h.startsWith(name));
  const AZIENDA = col('azienda');
  const STATO = col('stato');
  const EMAIL = col('email');
  const PAESE = col('paese');
  const CITTA = col('citt');
  const DOMINIO = col('dominio');
  const PRIMO = col('data primo');
  const ULTIMO = col('data ultimo');
  const RISCONTRO = col('tipo di riscontro');
  const DETTAGLI = col('dettagli');
  const LINK = col('link email');

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    // Trailing blank line from the export.
    if (cells.every((c) => c.trim() === '')) continue;
    const name = blank(cells[AZIENDA]);
    if (!name) {
      issues.push({ line: i + 1, reason: 'missing_name', raw: cells.join(',').slice(0, 120) });
      continue;
    }
    const status = investorStatusFromLabel(cells[STATO] ?? '');
    if (!status) {
      issues.push({ line: i + 1, reason: 'unknown_status', raw: cells.join(',').slice(0, 120) });
      continue;
    }
    inputs.push({
      name,
      status,
      emails: splitEmails(cells[EMAIL]),
      country: blank(cells[PAESE]),
      city: blank(cells[CITTA]),
      domain: normalizeDomain(cells[DOMINIO]),
      firstContactAt: parseItalianDate(cells[PRIMO]),
      lastContactAt: parseItalianDate(cells[ULTIMO]),
      responseType: blank(cells[RISCONTRO]),
      nextStep: blank(cells[DETTAGLI]),
      gmailUrl: blank(cells[LINK]),
    });
  }
  return { inputs, issues };
}

/** Per-status tallies for the stat cards and the importer's validation line. */
export function investorStatistics(rows: { status: InvestorStatus }[]): {
  total: number;
  inContact: number;
  toRecontact: number;
  rejected: number;
  firstContact: number;
} {
  const by = (s: InvestorStatus) => rows.filter((r) => r.status === s).length;
  return {
    total: rows.length,
    inContact: by('in_contact'),
    toRecontact: by('to_recontact'),
    rejected: by('rejected'),
    firstContact: by('first_contact'),
  };
}
