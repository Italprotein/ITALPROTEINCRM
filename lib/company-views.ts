/**
 * Saved views for the companies list — the Zoho-style "pick a view, the table
 * narrows" control.
 *
 * Every view is a pure predicate over an already-loaded `Company` DTO. Nothing
 * here queries: the list page holds the full row set in memory anyway, so a
 * view switch is a `filter()`, not a round-trip, and each view's live count can
 * be computed in the same pass. It also keeps the whole thing unit-testable in
 * Node (see tests/company-views.test.ts) with no database and no browser.
 *
 * `labelKey` is a key inside the `CompanyViews` next-intl namespace — the label
 * text itself never lives in this module, so both locales stay in messages/.
 */
import { FOLLOW_UP_AFTER_DAYS } from '@/lib/follow-up';
import type { Company, NDAStatus, RelationshipStage, SampleStatus } from '@/lib/types';

export interface CompanyViewContext {
  /** Signed-in account id, used by the `mine` view. Null when unresolved. */
  accountId: string | null;
  now: Date;
}

export interface CompanyView {
  key: string;
  /** Key within the `CompanyViews` messages namespace. */
  labelKey: string;
  predicate: (c: Company, ctx: CompanyViewContext) => boolean;
}

/** Recent = last activity within this many days (inclusive). */
const RECENT_WITHIN_DAYS = 7;

/**
 * NDA is in flight: someone still owes someone a signature or a redline.
 * `draft` is deliberately out — an unsent draft is our own backlog, not a
 * conversation in progress — as are the terminal `expired`/`terminated`.
 */
const NDA_PENDING: NDAStatus[] = [
  'to_prepare',
  'sent',
  'under_review',
  'changes_requested',
  'awaiting_italprotein_signature',
  'awaiting_counterparty_signature',
  'partially_signed',
];

/** NDA is done enough to work under. */
const NDA_SIGNED: NDAStatus[] = ['approved', 'fully_signed'];

/** A sample that has physically left us, up to the point feedback is chased. */
const SAMPLE_SENT: SampleStatus[] = [
  'shipped',
  'in_transit',
  'delivered',
  'testing',
  'feedback_requested',
];

/**
 * Stages where silence is the expected outcome, not a problem to chase — so
 * they never surface in the "no activity" follow-up view.
 */
const QUIET_EXEMPT_STAGES: RelationshipStage[] = ['lost', 'dormant'];

const EUROPE = [
  'IT', 'DE', 'CH', 'GB', 'FR', 'ES', 'NL', 'BE', 'AT',
  'DK', 'FI', 'SE', 'AL', 'PT', 'IE', 'PL', 'CZ', 'GR', 'NO',
];

const MIDDLE_EAST = ['SA', 'AE', 'TR', 'QA', 'KW', 'BH', 'OM', 'JO', 'EG', 'IL'];

const ANZ = ['AU', 'NZ'];

/** Whole-and-fractional days between `iso` and `now`. Negative for future dates. */
function daysSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (now.getTime() - then) / 86_400_000;
}

const inRegion = (codes: string[]) => (c: Company) => codes.includes((c.countryCode ?? '').toUpperCase());

export const COMPANY_VIEWS: CompanyView[] = [
  { key: 'all', labelKey: 'all', predicate: () => true },

  // An empty owner id must not collide with an unresolved session, so the null
  // account short-circuits to "no rows" rather than matching unowned records.
  {
    key: 'mine',
    labelKey: 'mine',
    predicate: (c, ctx) => ctx.accountId != null && c.accountOwnerId === ctx.accountId,
  },

  {
    key: 'recent7',
    labelKey: 'recent7',
    predicate: (c, ctx) => {
      const days = daysSince(c.lastActivityAt, ctx.now);
      return days != null && days <= RECENT_WITHIN_DAYS;
    },
  },

  // Mirrors lib/follow-up.ts's threshold client-side. A company that never
  // logged an activity falls back to its creation date, so a brand-new record
  // is not immediately flagged as stalled while a year-old untouched one is.
  {
    key: 'quiet10',
    labelKey: 'quiet10',
    predicate: (c, ctx) => {
      if (QUIET_EXEMPT_STAGES.includes(c.relationshipStage)) return false;
      const days = daysSince(c.lastActivityAt ?? c.createdAt, ctx.now);
      return days != null && days >= FOLLOW_UP_AFTER_DAYS;
    },
  },

  { key: 'ndaPending', labelKey: 'ndaPending', predicate: (c) => NDA_PENDING.includes(c.ndaStatus) },
  { key: 'ndaSigned', labelKey: 'ndaSigned', predicate: (c) => NDA_SIGNED.includes(c.ndaStatus) },
  {
    key: 'samplesSent',
    labelKey: 'samplesSent',
    predicate: (c) => c.latestSampleStatus != null && SAMPLE_SENT.includes(c.latestSampleStatus),
  },

  { key: 'customers', labelKey: 'customers', predicate: (c) => c.relationshipStage === 'customer' },
  { key: 'distributors', labelKey: 'distributors', predicate: (c) => c.type === 'distributor' },

  { key: 'europe', labelKey: 'europe', predicate: inRegion(EUROPE) },
  { key: 'middleEast', labelKey: 'middleEast', predicate: inRegion(MIDDLE_EAST) },
  { key: 'anz', labelKey: 'anz', predicate: inRegion(ANZ) },
];

/** The view to fall back to when nothing (or something unknown) is stored. */
export const DEFAULT_COMPANY_VIEW = 'all';

/** Resolves a stored/URL view key to a real view, falling back to `all`. */
export function resolveCompanyView(key: string | null | undefined): CompanyView {
  return (
    COMPANY_VIEWS.find((v) => v.key === key) ??
    COMPANY_VIEWS.find((v) => v.key === DEFAULT_COMPANY_VIEW)!
  );
}
