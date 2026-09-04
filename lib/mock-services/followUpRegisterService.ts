import { followUpStatistics, type FollowUpStatus } from '@/lib/follow-ups';
import type { FollowUp } from '@/lib/types';
import type { FollowUpFormInput } from '@/lib/services/follow-up-register.mapper';
import type { FollowUpSaveResult as SaveResult } from '@/lib/services/follow-up-register.actions';
import type {
  FollowUpReconcileReport,
  FollowUpSyncReport,
} from '@/lib/backend/follow-up-register';

// Small in-memory register so the UI works in mock mode. Production data lives
// in Postgres — the outreach freeze via scripts/import-suppression-list.ts and
// the quiet companies via the sync pass. This sample exists for contract parity
// and local demos only, so it holds one row of each source.

const now = new Date().toISOString();

const seed: FollowUp[] = [
  {
    id: 'fu_bulla',
    companyName: 'Bulla Dairy Foods',
    domain: 'bulla.com.au',
    status: 'waiting',
    source: 'suppression_list',
    followUpOn: '2026-10-11',
    reason: 'Active sample / supplier / October meeting process',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'fu_ristora',
    companyName: 'Ristora',
    domain: 'ristora.com',
    status: 'waiting',
    source: 'suppression_list',
    followUpOn: '2026-11-01',
    reason: 'Explicitly asked to reconnect Nov-Dec 2026',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'fu_quiet',
    companyId: 'c_proteinworks',
    companyName: 'The Protein Works',
    status: 'pending',
    source: 'quiet_detection',
    reason: 'Nessun contatto da 24 giorni',
    quietDays: 24,
    lastContactAt: new Date(Date.now() - 24 * 86_400_000).toISOString(),
    countryCode: 'GB',
    createdAt: now,
    updatedAt: now,
  },
];

let rows: FollowUp[] = [...seed];

function applyInput(base: FollowUp, input: FollowUpFormInput): FollowUp {
  return {
    ...base,
    companyId: input.companyId?.trim() || undefined,
    companyName: input.companyName.trim(),
    domain: input.domain?.trim().toLowerCase() || undefined,
    status: (input.status as FollowUpStatus) ?? base.status,
    followUpOn: input.followUpOn?.trim() || undefined,
    reason: input.reason?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
}

export const followUpRegisterService = {
  async list(): Promise<FollowUp[]> {
    return [...rows];
  },
  async get(id: string): Promise<FollowUp | undefined> {
    return rows.find((r) => r.id === id);
  },
  async getStatistics() {
    return followUpStatistics(rows);
  },
  async companyOptions(): Promise<{ id: string; name: string; countryCode: string }[]> {
    return [];
  },
  async create(input: FollowUpFormInput): Promise<SaveResult> {
    const companyName = input.companyName.trim();
    if (!companyName) return { ok: false, reason: 'missing_name' };
    if (rows.some((r) => r.companyName.toLowerCase() === companyName.toLowerCase())) {
      return { ok: false, reason: 'duplicate_company' };
    }
    const followUp = applyInput(
      {
        id: `fu_${Math.random().toString(36).slice(2, 10)}`,
        companyName,
        status: 'pending',
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      input,
    );
    rows = [followUp, ...rows];
    return { ok: true, followUp, created: true };
  },
  async update(id: string, input: FollowUpFormInput): Promise<SaveResult | undefined> {
    const existing = rows.find((r) => r.id === id);
    if (!existing) return undefined;
    const companyName = input.companyName.trim();
    if (!companyName) return { ok: false, reason: 'missing_name' };
    const followUp = applyInput(existing, input);
    rows = rows.map((r) => (r.id === id ? followUp : r));
    return { ok: true, followUp, created: false };
  },
  async setStatus(
    id: string,
    status: FollowUpStatus,
    followUpOn?: string | null,
  ): Promise<FollowUp | undefined> {
    const existing = rows.find((r) => r.id === id);
    if (!existing) return undefined;
    const followUp: FollowUp = {
      ...existing,
      status,
      ...(followUpOn === undefined ? {} : { followUpOn: followUpOn ?? undefined }),
      statusChangedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    rows = rows.map((r) => (r.id === id ? followUp : r));
    return followUp;
  },
  async remove(id: string): Promise<void> {
    rows = rows.filter((r) => r.id !== id);
  },
  async reconcile(): Promise<FollowUpReconcileReport> {
    // No mailbox to compare against, so nothing can be shown to be resolved.
    return {
      ok: true,
      checked: rows.filter((r) => r.source === 'quiet_detection').length,
      resolved: { recontacted: 0, stage_closed: 0, do_not_contact: 0 },
      removed: 0,
    };
  },

  async sync(): Promise<FollowUpSyncReport> {
    // Nothing to scan without a mailbox — the mock reports an honest no-op.
    return {
      ok: true,
      scanned: 0,
      quiet: 0,
      created: 0,
      refreshed: 0,
      skipped: {
        still_warm: 0,
        stage_closed: 0,
        do_not_contact: 0,
        settled_by_hand: 0,
        not_ours_to_touch: 0,
        unchanged: 0,
      },
    };
  },
};

export type FollowUpRegisterService = typeof followUpRegisterService;
