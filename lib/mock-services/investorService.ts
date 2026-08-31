import { investorStatistics } from '@/lib/investors';
import type { Investor } from '@/lib/types';
import type { InvestorFormInput } from '@/lib/services/investor.mapper';
import type { InvestorSaveResult as SaveResult } from '@/lib/services/investor.actions';

// Small in-memory register so the UI works in mock mode. The production data
// (562 rows) lives in Postgres via scripts/import-investors.ts; this sample
// exists for contract parity and local demos only.

const now = new Date().toISOString();

const seed: Investor[] = [
  {
    id: 'inv_360_capital',
    name: '360 Capital',
    status: 'in_contact',
    emails: ['info@360cap.vc'],
    country: 'Francia',
    city: 'Parigi',
    domain: '360cap.vc',
    firstContactAt: '2026-08-26T00:00:00.000Z',
    lastContactAt: '2026-08-26T00:00:00.000Z',
    nextStep: 'Richiesto upload del deck e delle informazioni sulla piattaforma.',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'inv_italian_angels',
    name: 'Italian Angels for Growth',
    status: 'in_contact',
    emails: ['info@italianangels.net'],
    country: 'Italia',
    city: 'Milano',
    domain: 'italianangels.net',
    firstContactAt: '2026-08-13T00:00:00.000Z',
    lastContactAt: '2026-08-14T00:00:00.000Z',
    nextStep: 'Richiesta candidatura tramite il form IAG.',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'inv_sample_fund',
    name: 'Example Ventures',
    status: 'first_contact',
    emails: ['hello@example-ventures.test'],
    country: 'Italia',
    city: 'Roma',
    domain: 'example-ventures.test',
    firstContactAt: '2026-08-12T00:00:00.000Z',
    createdAt: now,
    updatedAt: now,
  },
];

let rows: Investor[] = [...seed];

function applyInput(base: Investor, input: InvestorFormInput): Investor {
  const emails = Array.isArray(input.emails)
    ? input.emails
    : (input.emails ?? '').split(';').map((e) => e.trim()).filter(Boolean);
  return {
    ...base,
    name: input.name.trim(),
    status: (input.status as Investor['status']) ?? base.status,
    emails,
    country: input.country?.trim() || undefined,
    city: input.city?.trim() || undefined,
    domain: input.domain?.trim().toLowerCase() || undefined,
    firstContactAt: input.firstContactAt ?? base.firstContactAt,
    lastContactAt: input.lastContactAt ?? base.lastContactAt,
    responseType: input.responseType?.trim() || undefined,
    nextStep: input.nextStep?.trim() || undefined,
    gmailUrl: input.gmailUrl?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
}

export const investorService = {
  async list(): Promise<Investor[]> {
    return [...rows];
  },
  async get(id: string): Promise<Investor | undefined> {
    return rows.find((r) => r.id === id);
  },
  async getStatistics() {
    return investorStatistics(rows);
  },
  async create(input: InvestorFormInput): Promise<SaveResult> {
    const name = input.name.trim();
    if (!name || rows.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, reason: 'duplicate_name' };
    }
    const investor = applyInput(
      {
        id: `inv_${Math.random().toString(36).slice(2, 10)}`,
        name,
        status: 'first_contact',
        emails: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      input,
    );
    rows = [investor, ...rows];
    return { ok: true, investor, created: true };
  },
  async update(id: string, input: InvestorFormInput): Promise<SaveResult | undefined> {
    const existing = rows.find((r) => r.id === id);
    if (!existing) return undefined;
    const name = input.name.trim();
    if (rows.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) {
      return { ok: false, reason: 'duplicate_name' };
    }
    const investor = applyInput(existing, input);
    rows = rows.map((r) => (r.id === id ? investor : r));
    return { ok: true, investor, created: false };
  },
  async remove(id: string): Promise<void> {
    rows = rows.filter((r) => r.id !== id);
  },
};

export type InvestorService = typeof investorService;
