import type { LeadEntry } from '@/lib/types';

/**
 * Mock "My Leads" service — leads are extracted from real Gmail traffic, so
 * mock mode simply has none. The real implementation lives in
 * lib/services/lead.ts.
 */
export const leadService = {
  async listMine(): Promise<LeadEntry[]> {
    return [];
  },

  async list(): Promise<LeadEntry[]> {
    return [];
  },

  async byAdmin(adminUserId: string): Promise<LeadEntry[]> {
    void adminUserId;
    return [];
  },

  async remove(id: string): Promise<void> {
    void id;
  },

  async getStatistics(): Promise<{ total: number; mine: number }> {
    return { total: 0, mine: 0 };
  },

  reset(): void {},
};

export type LeadService = typeof leadService;
