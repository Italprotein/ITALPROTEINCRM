import type { ApplicationCategory, CompanyType, RelationshipStage } from '@/lib/types';
import { SAMPLE_STATUS_FLOW } from '@/lib/types';
import {
  COMPANIES, AGENCY_COMPANIES, SAMPLES, SHIPMENTS, NDAS, TASKS, ACTIVITIES, STAFF, FEEDBACK,
} from '@/fixtures';

const ALL_COMPANIES = [...COMPANIES, ...AGENCY_COMPANIES];
const NOW = new Date('2026-06-17T12:00:00Z');

/** Months Sep 2025 → Jun 2026 (the active demo window). */
const MONTHS = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
const monthKey = (iso?: string) => (iso ? iso.slice(0, 7) : '');
const monthLabel = (k: string) => {
  const [y, m] = k.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};
const daysBetween = (a?: string, b?: string) => {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Number.isFinite(d) ? d : null;
};
const sampleRank = (s: string) => SAMPLE_STATUS_FLOW.indexOf(s as never);

export const analyticsService = {
  async companiesOverTime() {
    let cumulative = 0;
    return MONTHS.map((k) => {
      const count = COMPANIES.filter((c) => monthKey(c.createdAt) === k).length;
      cumulative += count;
      return { month: k, label: monthLabel(k), count, cumulative };
    });
  },

  async companiesByCountry() {
    const map = new Map<string, { country: string; countryCode: string; count: number }>();
    for (const c of ALL_COMPANIES) {
      const e = map.get(c.country) ?? { country: c.country, countryCode: c.countryCode, count: 0 };
      e.count++;
      map.set(c.country, e);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  },

  async companiesByCategory() {
    const map = new Map<CompanyType, number>();
    for (const c of ALL_COMPANIES) map.set(c.type, (map.get(c.type) ?? 0) + 1);
    return [...map.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  },

  async pipelineDistribution() {
    const order: RelationshipStage[] = [
      'lead', 'contacted', 'interested', 'qualified', 'nda_in_progress', 'nda_signed',
      'sampling', 'testing', 'commercial_discussion', 'customer', 'repeat_customer', 'dormant', 'lost',
    ];
    return order
      .map((stage) => ({ stage, count: ALL_COMPANIES.filter((c) => c.relationshipStage === stage).length }))
      .filter((d) => d.count > 0);
  },

  async ndaFunnel() {
    const prepared = NDAS.filter((n) => n.status !== 'not_required').length;
    const sent = NDAS.filter((n) => !!n.dateSent || ['sent', 'under_review', 'changes_requested', 'approved', 'awaiting_italprotein_signature', 'awaiting_counterparty_signature', 'partially_signed', 'fully_signed'].includes(n.status)).length;
    const signed = NDAS.filter((n) => n.status === 'fully_signed').length;
    return [
      { name: 'Prepared', value: prepared },
      { name: 'Sent', value: sent },
      { name: 'Signed', value: signed },
    ];
  },

  async sampleFunnel() {
    const atLeast = (status: string) => SAMPLES.filter((s) => sampleRank(s.status) >= sampleRank(status) && s.status !== 'cancelled' && s.status !== 'rejected').length;
    return [
      { name: 'Requested', value: SAMPLES.filter((s) => s.status !== 'draft').length },
      { name: 'Approved', value: atLeast('approved') },
      { name: 'Shipped', value: atLeast('shipped') },
      { name: 'Delivered', value: atLeast('delivered') },
      { name: 'Feedback', value: atLeast('feedback_received') },
    ];
  },

  async samplesOverTime() {
    return MONTHS.map((k) => ({
      month: k,
      label: monthLabel(k),
      count: SAMPLES.filter((s) => monthKey(s.requestDate) === k).length,
    }));
  },

  async ndaCompletionTrend() {
    return MONTHS.map((k) => ({
      month: k,
      label: monthLabel(k),
      signed: NDAS.filter((n) => n.status === 'fully_signed' && monthKey(n.effectiveDate ?? n.dateSent) === k).length,
      sent: NDAS.filter((n) => monthKey(n.dateSent) === k).length,
    }));
  },

  async shipmentStatusBreakdown() {
    const delivered = SHIPMENTS.filter((s) => s.actualDelivery).length;
    const customs = SHIPMENTS.filter((s) => !s.actualDelivery && (s.customsStatus === 'hold' || s.customsStatus === 'in_clearance')).length;
    const inTransit = SHIPMENTS.filter((s) => !s.actualDelivery && s.shipmentDate && !(s.customsStatus === 'hold' || s.customsStatus === 'in_clearance')).length;
    const preparing = SHIPMENTS.filter((s) => !s.shipmentDate && !s.actualDelivery).length;
    return [
      { name: 'Delivered', value: delivered },
      { name: 'In transit', value: inTransit },
      { name: 'Customs', value: customs },
      { name: 'Preparing', value: preparing },
    ].filter((d) => d.value > 0);
  },

  async shipmentPerformance() {
    const delivered = SHIPMENTS.filter((s) => s.actualDelivery);
    const days = delivered.map((s) => daysBetween(s.shipmentDate, s.actualDelivery)).filter((d): d is number => d != null && d >= 0);
    const avgDeliveryDays = days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : 0;
    const onTime = delivered.filter((s) => !s.estimatedDelivery || (s.actualDelivery && new Date(s.actualDelivery) <= new Date(s.estimatedDelivery))).length;
    return {
      avgDeliveryDays,
      onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
      delayedCount: SHIPMENTS.filter((s) => s.isDelayed).length,
      totalDelivered: delivered.length,
    };
  },

  async avgFirstContactToNda() {
    const spans: number[] = [];
    for (const n of NDAS) {
      if (n.status !== 'fully_signed') continue;
      const c = ALL_COMPANIES.find((x) => x.id === n.companyId);
      const d = daysBetween(c?.firstContact?.date, n.effectiveDate ?? n.dateSent);
      if (d != null && d >= 0) spans.push(d);
    }
    return spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : 0;
  },

  async avgNdaToShipment() {
    const spans: number[] = [];
    for (const s of SHIPMENTS) {
      const nda = NDAS.find((n) => n.companyId === s.companyId && n.status === 'fully_signed');
      const d = daysBetween(nda?.effectiveDate ?? nda?.dateSent, s.shipmentDate);
      if (d != null && d >= 0) spans.push(d);
    }
    return spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : 0;
  },

  async teamActivity() {
    return STAFF.map((u) => ({
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`,
      role: u.role,
      activities: ACTIVITIES.filter((a) => a.byUserId === u.id).length,
      tasks: TASKS.filter((t) => t.ownerId === u.id && t.status !== 'done' && t.status !== 'cancelled').length,
      companies: u.assignedCompanyIds.length,
    })).sort((a, b) => b.activities - a.activities);
  },

  async taskCompletionRate() {
    const done = TASKS.filter((t) => t.status === 'done').length;
    return { done, total: TASKS.length, rate: TASKS.length ? Math.round((done / TASKS.length) * 100) : 0 };
  },

  async topMarkets() {
    const map = new Map<string, { country: string; countryCode: string; count: number }>();
    for (const c of ALL_COMPANIES) {
      const e = map.get(c.country) ?? { country: c.country, countryCode: c.countryCode, count: 0 };
      e.count++;
      map.set(c.country, e);
    }
    return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  },

  async topApplications() {
    const map = new Map<ApplicationCategory, number>();
    for (const s of SAMPLES) map.set(s.applicationCategory, (map.get(s.applicationCategory) ?? 0) + 1);
    return [...map.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  },

  async feedbackResults() {
    const results = ['positive', 'mixed', 'negative', 'inconclusive'] as const;
    return results.map((r) => ({ name: r, value: FEEDBACK.filter((f) => f.overallResult === r).length })).filter((d) => d.value > 0);
  },

  _now: NOW,
};

export type AnalyticsService = typeof analyticsService;
