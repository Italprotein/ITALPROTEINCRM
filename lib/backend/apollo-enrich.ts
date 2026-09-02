/**
 * Asking Apollo what our companies actually are. The implementation half.
 *
 * The outreach importer could prove we emailed a domain and nothing more, so it
 * left 161 companies typed `other`, 79 with no country and every one of them
 * with no city. Apollo answers exactly that, and only that: on the current
 * plan `organizations/enrich` works and `people/match` returns 403, so this
 * enriches companies and never contacts.
 *
 * The decisions live in lib/apollo.ts, which has no fetch and no Prisma. What
 * is left here is batching, quota discipline, and writing only into blanks.
 *
 * Deliberately NOT "use server" — and note that a type re-export from such a
 * file is what broke the companies page once already. The guarded entry point
 * is app/api/companies/enrich/route.ts.
 */

import { prisma } from "@/lib/backend/prisma";
import {
  apolloFailureFor,
  apolloPatchFor,
  isEmptyPatch,
  isFatalApolloFailure,
  narrowToGaps,
  parseApolloBulk,
  type ApolloFailure,
  type ApolloPatch,
  type CompanyGaps,
} from "@/lib/apollo";
import { registrableDomainOf } from "@/lib/email-entity";

const ENDPOINT = "https://api.apollo.io/api/v1/organizations/bulk_enrich";

/**
 * Batch and budget.
 *
 * `bulk_enrich` takes at most 10 domains. The observed plan allows 50/minute,
 * 200/hour and 600/day, so 20 calls is 200 companies a run and a fifth of the
 * daily ceiling — enough to cover the whole book in three runs without ever
 * approaching a limit.
 */
const BATCH_SIZE = Math.min(Number(process.env.APOLLO_BATCH_SIZE ?? 10), 10);
const MAX_CALLS = Number(process.env.APOLLO_MAX_CALLS_PER_RUN ?? 20);
const COOLDOWN_DAYS = Number(process.env.APOLLO_COOLDOWN_DAYS ?? 90);
/** Apollo's per-minute ceiling is 50; one call per 1.3s stays well inside it. */
const THROTTLE_MS = Number(process.env.APOLLO_THROTTLE_MS ?? 1300);

export interface ApolloEnrichResult {
  ok: boolean;
  /** False when APOLLO_API_KEY is unset — a deployment state, not an error. */
  configured: boolean;
  /** Companies with a domain and a gap Apollo could fill. */
  eligible: number;
  /** Domains actually sent this run. */
  requested: number;
  /** Organizations Apollo returned. */
  matched: number;
  /** Companies whose row changed. */
  updated: number;
  /** Returned, but every field we could fill was already filled. */
  noGaps: number;
  /** Fields written, by column — what the run actually improved. */
  fieldsFilled: Record<string, number>;
  stoppedBy?: ApolloFailure;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBatch(
  domains: string[],
  apiKey: string,
): Promise<{ orgs: ReturnType<typeof parseApolloBulk>; failure: ApolloFailure | null }> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ domains }),
    });
  } catch {
    return { orgs: [], failure: "network" };
  }
  if (!response.ok) return { orgs: [], failure: apolloFailureFor(response.status) };
  try {
    return { orgs: parseApolloBulk(await response.json()), failure: null };
  } catch {
    return { orgs: [], failure: "unavailable" };
  }
}

/**
 * Enrich the companies that have a gap, least-recently-enriched first.
 *
 * Idempotent in the way that matters: a company whose blanks are now filled has
 * no gaps on the next run, and `enrichedAt` keeps it out of the queue for the
 * cooldown regardless. Nothing a person typed is ever overwritten — see
 * `narrowToGaps`.
 */
export async function runApolloEnrichment(
  options: { now?: Date; limit?: number } = {},
): Promise<ApolloEnrichResult> {
  const now = options.now ?? new Date();
  const apiKey = process.env.APOLLO_API_KEY?.trim();

  const result: ApolloEnrichResult = {
    ok: true,
    configured: Boolean(apiKey),
    eligible: 0,
    requested: 0,
    matched: 0,
    updated: 0,
    noGaps: 0,
    fieldsFilled: {},
  };
  if (!apiKey) return result;

  try {
    const cutoff = new Date(now.getTime() - COOLDOWN_DAYS * 86_400_000);

    const companies = await prisma.company.findMany({
      where: {
        domains: { some: {} },
        OR: [{ enrichedAt: null }, { enrichedAt: { lt: cutoff } }],
        // Only rows with something Apollo could actually fill.
        AND: [
          {
            OR: [
              { type: "other" },
              { size: null },
              { city: "" },
              { countryCode: "XX" },
              { website: null },
              { linkedin: null },
              { description: null },
            ],
          },
        ],
      },
      select: {
        id: true,
        legalName: true,
        type: true,
        size: true,
        city: true,
        country: true,
        countryCode: true,
        website: true,
        linkedin: true,
        description: true,
        logoUpdatedAt: true,
        domains: { select: { domain: true } },
      },
      orderBy: { enrichedAt: { sort: "asc", nulls: "first" } },
      take: options.limit ?? BATCH_SIZE * MAX_CALLS,
    });

    result.eligible = companies.length;
    if (companies.length === 0) return result;

    // One company per domain, so a returned organization can be routed back.
    const byDomain = new Map<string, (typeof companies)[number]>();
    for (const company of companies) {
      for (const { domain } of company.domains) {
        const registrable = registrableDomainOf(domain);
        if (registrable && !byDomain.has(registrable)) byDomain.set(registrable, company);
      }
    }

    const domains = [...byDomain.keys()];
    const batches: string[][] = [];
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      batches.push(domains.slice(i, i + BATCH_SIZE));
    }

    const touched = new Set<string>();

    for (const [index, batch] of batches.slice(0, MAX_CALLS).entries()) {
      if (index > 0 && THROTTLE_MS > 0) await sleep(THROTTLE_MS);

      const { orgs, failure } = await fetchBatch(batch, apiKey);
      result.requested += batch.length;

      if (failure) {
        if (isFatalApolloFailure(failure)) {
          result.stoppedBy = failure;
          result.ok = failure === "rate_limited";
          break;
        }
        continue;
      }

      result.matched += orgs.length;

      for (const org of orgs) {
        const key = registrableDomainOf(org.primary_domain ?? org.website_url);
        const company = key ? byDomain.get(key) : undefined;
        if (!company || touched.has(company.id)) continue;
        touched.add(company.id);

        const gaps: CompanyGaps = {
          type: company.type,
          size: company.size,
          city: company.city,
          countryCode: company.countryCode,
          website: company.website,
          linkedin: company.linkedin,
          description: company.description,
          logoUpdatedAt: company.logoUpdatedAt,
        };
        const patch = narrowToGaps(apolloPatchFor(org), gaps);

        if (isEmptyPatch(patch)) {
          result.noGaps += 1;
        } else {
          await applyPatch(company.id, patch, result);
          result.updated += 1;
        }
      }

      // Stamp everything in the batch, matched or not: a domain Apollo does not
      // know must not be re-sent on every run.
      const ids = batch
        .map((domain) => byDomain.get(domain)?.id)
        .filter((id): id is string => Boolean(id));
      await prisma.company
        .updateMany({ where: { id: { in: ids } }, data: { enrichedAt: now } })
        .catch(() => undefined);
    }

    return result;
  } catch (error) {
    result.ok = false;
    result.error = error instanceof Error ? error.message : "unknown_error";
    return result;
  }
}

async function applyPatch(
  companyId: string,
  patch: ApolloPatch,
  result: ApolloEnrichResult,
): Promise<void> {
  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    data[key] = value;
    result.fieldsFilled[key] = (result.fieldsFilled[key] ?? 0) + 1;
  }
  // `logoUrl` alone does not make a logo: the tile reads bytes keyed on
  // logoUpdatedAt, and stamping that here would claim a logo we have not
  // fetched. The URL is stored for the importer to pick up.
  if (data.logoUrl) data.logoSource = "apollo";

  await prisma.company
    .update({ where: { id: companyId }, data })
    .catch(() => {
      for (const key of Object.keys(data)) {
        result.fieldsFilled[key] = Math.max(0, (result.fieldsFilled[key] ?? 1) - 1);
      }
    });
}
