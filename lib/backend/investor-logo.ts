/**
 * Investor logo pipeline — the thin sibling of lib/backend/company-logo.ts.
 *
 * Investors are the easy case: every imported row carries an explicit `domain`
 * column from the campaign workbook, so there is no website/contact-email
 * derivation — just "has a domain, has no logo yet → ask the favicon
 * providers". Providers, allowlist and size window are shared with the company
 * pipeline (imported from company-logo.ts) so the two can never drift apart.
 *
 * Server-internal, deliberately NOT "use server" — the guarded entry point is
 * app/api/investors/import-logos/route.ts.
 */
import { prisma } from "@/lib/backend/prisma";
import { providerUrls, tryProvider, LOGO_IMPORT_CONCURRENCY } from "@/lib/backend/company-logo";

/** Same wall-clock ceiling as the company import, for the same proxy reasons. */
const IMPORT_BUDGET_MS = 60_000;

export async function fetchInvestorLogo(investorId: string): Promise<"updated" | "skipped" | "failed"> {
  try {
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      select: { id: true, domain: true, logoUrl: true },
    });
    if (!investor?.domain || investor.logoUrl) return "skipped";
    for (const url of providerUrls(investor.domain)) {
      const dataUri = await tryProvider(url);
      if (!dataUri) continue;
      await prisma.investor.update({
        where: { id: investor.id },
        data: { logoUrl: dataUri, logoUpdatedAt: new Date() },
      });
      return "updated";
    }
    return "skipped";
  } catch {
    return "failed";
  }
}

/**
 * Backfills logos for every investor with a domain and no logo yet. Idempotent:
 * a row holding logo bytes is no longer a candidate, so repeated runs only pick
 * up what is still missing; `remaining` says how many the budget did not reach.
 */
export async function importMissingInvestorLogos(): Promise<{
  updated: number;
  skipped: number;
  failed: number;
  remaining: number;
}> {
  const candidates = await prisma.investor.findMany({
    where: { domain: { not: null }, logoUrl: null },
    select: { id: true },
  });

  const deadline = Date.now() + IMPORT_BUDGET_MS;
  const tally = { updated: 0, skipped: 0, failed: 0, remaining: 0 };
  let processed = 0;
  for (let i = 0; i < candidates.length; i += LOGO_IMPORT_CONCURRENCY) {
    if (Date.now() >= deadline) break;
    const slice = candidates.slice(i, i + LOGO_IMPORT_CONCURRENCY);
    const results = await Promise.allSettled(slice.map((c) => fetchInvestorLogo(c.id)));
    processed += slice.length;
    for (const result of results) {
      if (result.status === "fulfilled") tally[result.value] += 1;
      else tally.failed += 1;
    }
  }
  tally.remaining = candidates.length - processed;
  return tally;
}
