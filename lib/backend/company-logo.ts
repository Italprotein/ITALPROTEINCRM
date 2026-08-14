/**
 * Company logo pipeline — the implementation half.
 *
 * A company's website is the one identifier we reliably hold, and its favicon is
 * the one image we can fetch without an API key or a scrape. So: derive the
 * domain, ask two public favicon services for a 128px icon, and store the first
 * plausible answer as a data URI on Company.logoUrl.
 *
 * Deliberately NOT a "use server" module. Every export there becomes a publicly
 * reachable POST endpoint, and an unguarded "fetch an arbitrary URL and write to
 * the database" endpoint is exactly the kind of thing tests/action-guards.test.ts
 * exists to refuse. The guarded entry points live in
 * lib/services/logo.actions.ts; this module is server-internal and is called
 * only from already-authorised code.
 *
 * Everything about this is best-effort. A missing logo is a cosmetic loss (the
 * UI falls back to the initials tile), so no failure here is ever allowed to
 * propagate into a create or block a page.
 */
import { prisma } from "@/lib/backend/prisma";

export type LogoFetchOutcome = "updated" | "skipped" | "failed";

/** Per-request budget. Favicon services are usually fast or dead; 8s covers both. */
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Size window for an acceptable icon.
 *
 * Measured against the live providers on 2026-08-14:
 *   google  italprotein.com 1471B · nestle.com 3650B · danone.com 3598B · iana.org 4055B
 *   ddg     italprotein.com 4286B · nestle.com 1693B · danone.com 15086B
 * Unknown domains (`zzz-nonexistent-domain-xyz123.com`, `a.com`) came back 404
 * from both providers rather than as a generic globe, and DuckDuckGo answered
 * `example.com` with HTTP 200 but `text/plain` and *zero* bytes. So the status
 * and content-type checks do most of the filtering; the 500B floor is the
 * backstop that catches that empty body and any tiny placeholder sprite a
 * provider may start serving with a 200. The smallest real logo seen was 1471B,
 * comfortably clear of the floor.
 */
const MIN_BYTES = 500;
const MAX_BYTES = 512 * 1024;

/** How many companies the bulk import fetches at once. */
export const LOGO_IMPORT_CONCURRENCY = 4;

/** website (possibly scheme-less, possibly a deep link) -> bare hostname, or null. */
export function domainFromWebsite(website: string): string | null {
  const trimmed = website.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
}

function providerUrls(domain: string): string[] {
  return [
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
  ];
}

/** Fetches one provider and returns a data URI, or null if the answer is unusable. */
async function tryProvider(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (response.status !== 200) return null;
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength <= MIN_BYTES || bytes.byteLength > MAX_BYTES) return null;
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch {
    // Timeout, DNS failure, TLS error — all just "no logo from this provider".
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches and stores a logo for one company.
 *
 * `skipped` covers every "nothing to do" case — no company, no website, an
 * unparseable website, a human-verified logo we must not overwrite, or both
 * providers declining. `failed` is reserved for an actual error (a database
 * write that threw), so the tallies distinguish "no logo exists" from
 * "something is broken".
 */
export async function fetchCompanyLogo(companyId: string): Promise<LogoFetchOutcome> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, website: true, logoVerified: true },
    });
    if (!company) return "skipped";
    // A logo someone approved by hand outranks anything a favicon service has.
    if (company.logoVerified) return "skipped";
    if (!company.website) return "skipped";

    const domain = domainFromWebsite(company.website);
    if (!domain) return "skipped";

    for (const url of providerUrls(domain)) {
      const dataUri = await tryProvider(url);
      if (!dataUri) continue;
      await prisma.company.update({
        where: { id: company.id },
        data: { logoUrl: dataUri, logoSource: "favicon", logoUpdatedAt: new Date() },
      });
      return "updated";
    }
    return "skipped";
  } catch {
    return "failed";
  }
}

/**
 * Backfills logos for every company that has a website and no logo yet.
 *
 * Sequential would be minutes of wall-clock on a few hundred companies and
 * unbounded parallelism would hammer both providers into rate-limiting us, so
 * this walks the candidate list in slices of four.
 */
export async function importMissingCompanyLogos(): Promise<{
  updated: number;
  skipped: number;
  failed: number;
}> {
  const candidates = await prisma.company.findMany({
    where: { website: { not: null }, logoVerified: false, logoUrl: null },
    select: { id: true },
  });

  const tally = { updated: 0, skipped: 0, failed: 0 };
  for (let i = 0; i < candidates.length; i += LOGO_IMPORT_CONCURRENCY) {
    const slice = candidates.slice(i, i + LOGO_IMPORT_CONCURRENCY);
    const results = await Promise.allSettled(slice.map((c) => fetchCompanyLogo(c.id)));
    for (const result of results) {
      // fetchCompanyLogo swallows its own errors, so a rejection here would be
      // something exotic — count it as failed rather than lose it.
      if (result.status === "fulfilled") tally[result.value] += 1;
      else tally.failed += 1;
    }
  }
  return tally;
}
