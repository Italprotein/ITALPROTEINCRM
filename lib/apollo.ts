/**
 * Apollo organization enrichment -> our company fields. The pure half.
 *
 * Apollo answers the question the mailbox cannot: what a company *is*. The
 * outreach importer could only prove we emailed a domain, which is why it left
 * 161 companies typed `other`, 79 with no country and every one of them with no
 * city. This module turns Apollo's answer into ours.
 *
 * No fetch and no Prisma, so the mapping is testable against captured payloads
 * with no network and no database. Same split as lib/dhl-tracking.ts.
 *
 * API: POST https://api.apollo.io/api/v1/organizations/bulk_enrich
 *      header `x-api-key`, body `{ domains: [...] }`, up to 10 per call.
 */

import type { CompanySize, CompanyType } from "@/lib/types";

/** The organization fields we read. Everything else Apollo returns is ignored. */
export interface ApolloOrganization {
  name?: string | null;
  primary_domain?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  keywords?: string[] | null;
  estimated_num_employees?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  street_address?: string | null;
  short_description?: string | null;
  founded_year?: number | null;
  logo_url?: string | null;
}

/* ────────────────────────────── Industry -> type ──────────────────────────────
 *
 * Apollo's `industry` is a free-ish label from a fixed vocabulary. The mapping
 * below is deliberately conservative: anything it does not recognise stays
 * `null`, which leaves the company as it was rather than asserting a type from
 * a label nobody checked. A wrong type is worse than no type — it silently
 * skews every by-type chart in Analytics.
 * ──────────────────────────────────────────────────────────────────────────── */

const INDUSTRY_TO_TYPE: Record<string, CompanyType> = {
  "food production": "food_manufacturer",
  "food & beverages": "fb_manufacturer",
  "food and beverages": "fb_manufacturer",
  dairy: "dairy_manufacturer",
  "consumer goods": "fb_manufacturer",
  farming: "food_manufacturer",
  ranching: "food_manufacturer",
  wine: "beverage_manufacturer",
  "wine and spirits": "beverage_manufacturer",
  breweries: "beverage_manufacturer",
  beverages: "beverage_manufacturer",
  "health, wellness & fitness": "sports_nutrition",
  "health wellness and fitness": "sports_nutrition",
  supermarkets: "retailer",
  retail: "retailer",
  "consumer services": "retailer",
  wholesale: "distributor",
  "import and export": "distributor",
  "logistics and supply chain": "distributor",
  "package/freight delivery": "distributor",
  chemicals: "ingredient_company",
  "chemical manufacturing": "ingredient_company",
  "plastics": "ingredient_company",
  restaurants: "horeca",
  "food & beverage services": "horeca",
  hospitality: "horeca",
  "research": "laboratory",
  biotechnology: "laboratory",
  pharmaceuticals: "laboratory",
  "management consulting": "consultant",
  "marketing and advertising": "agency",
  "marketing & advertising": "agency",
};

/**
 * A company type from Apollo's industry label, or null when it says nothing
 * we can act on.
 *
 * `keywords` is consulted only to sharpen a bakery or confectionery reading of
 * an otherwise generic food label — never to invent a type on its own.
 */
export function companyTypeFromApollo(
  industry: string | null | undefined,
  keywords: readonly string[] | null | undefined,
): CompanyType | null {
  const label = (industry ?? "").trim().toLowerCase();
  const base = INDUSTRY_TO_TYPE[label] ?? null;

  const words = (keywords ?? []).map((k) => k.toLowerCase()).join(" ");
  if (base === "food_manufacturer" || base === "fb_manufacturer") {
    if (/\b(bakery|baking|bread|patisserie|biscuit)\b/.test(words)) return "bakery_manufacturer";
    if (/\b(confectionery|chocolate|candy|sweets)\b/.test(words)) return "confectionery_manufacturer";
    if (/\b(dairy|cheese|yogurt|yoghurt|milk)\b/.test(words)) return "dairy_manufacturer";
  }
  return base;
}

/**
 * Headcount -> our size bands.
 *
 * Boundaries follow the EU SME definition the rest of the CRM implies: micro
 * under 10, small under 50, medium under 250, large under 1000.
 */
export function companySizeFromHeadcount(
  employees: number | null | undefined,
): CompanySize | null {
  if (typeof employees !== "number" || !Number.isFinite(employees) || employees <= 0) return null;
  if (employees < 10) return "micro";
  if (employees < 50) return "small";
  if (employees < 250) return "medium";
  if (employees < 1000) return "large";
  return "enterprise";
}

/* ────────────────────────────── Country -> ISO ────────────────────────────── */

const COUNTRY_TO_ISO: Record<string, string> = {
  "united states": "US", "united states of america": "US", usa: "US",
  canada: "CA", mexico: "MX", brazil: "BR", argentina: "AR", colombia: "CO", chile: "CL",
  "united kingdom": "GB", england: "GB", scotland: "GB", wales: "GB", ireland: "IE",
  italy: "IT", italia: "IT", france: "FR", germany: "DE", spain: "ES", portugal: "PT",
  netherlands: "NL", belgium: "BE", switzerland: "CH", austria: "AT", luxembourg: "LU",
  sweden: "SE", norway: "NO", denmark: "DK", finland: "FI", iceland: "IS",
  poland: "PL", czechia: "CZ", "czech republic": "CZ", slovakia: "SK", hungary: "HU",
  romania: "RO", bulgaria: "BG", greece: "GR", croatia: "HR", slovenia: "SI",
  serbia: "RS", ukraine: "UA", turkey: "TR", "türkiye": "TR", russia: "RU",
  australia: "AU", "new zealand": "NZ",
  india: "IN", china: "CN", japan: "JP", "south korea": "KR", singapore: "SG",
  malaysia: "MY", thailand: "TH", vietnam: "VN", indonesia: "ID", philippines: "PH",
  "united arab emirates": "AE", "saudi arabia": "SA", qatar: "QA", kuwait: "KW",
  bahrain: "BH", oman: "OM", jordan: "JO", lebanon: "LB", israel: "IL",
  egypt: "EG", morocco: "MA", tunisia: "TN", algeria: "DZ",
  "south africa": "ZA", kenya: "KE", nigeria: "NG", ghana: "GH",
};

/** ISO-3166 alpha-2 for a country name Apollo returned, or null. */
export function isoCountryFromName(name: string | null | undefined): string | null {
  const key = (name ?? "").trim().toLowerCase();
  return key ? (COUNTRY_TO_ISO[key] ?? null) : null;
}

/* ────────────────────────────── The patch ────────────────────────────── */

/**
 * What Apollo would change about a company.
 *
 * Only ever fields we can fill; the caller decides whether the company is
 * actually missing them. Absent keys mean "Apollo said nothing", which is
 * different from "Apollo said empty".
 */
export interface ApolloPatch {
  type?: CompanyType;
  size?: CompanySize;
  city?: string;
  country?: string;
  countryCode?: string;
  website?: string;
  linkedin?: string;
  description?: string;
  logoUrl?: string;
  headquarters?: { city: string; line1: string; country: string };
}

const clean = (value: string | null | undefined): string | undefined => {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : undefined;
};

/** Apollo serves http:// URLs; store the https form. */
const https = (url: string | null | undefined): string | undefined => {
  const text = clean(url);
  if (!text) return undefined;
  return text.replace(/^http:\/\//i, "https://");
};

/**
 * Read one organization into a patch.
 *
 * Every field is independently optional. A payload that only knows the city
 * yields a patch that only sets the city — there is no all-or-nothing here,
 * because partial knowledge is the normal case.
 */
export function apolloPatchFor(org: ApolloOrganization): ApolloPatch {
  const patch: ApolloPatch = {};

  const type = companyTypeFromApollo(org.industry, org.keywords);
  if (type) patch.type = type;

  const size = companySizeFromHeadcount(org.estimated_num_employees);
  if (size) patch.size = size;

  const city = clean(org.city);
  if (city) patch.city = city;

  const country = clean(org.country);
  if (country) {
    patch.country = country;
    const iso = isoCountryFromName(country);
    if (iso) patch.countryCode = iso;
  }

  const website = https(org.website_url);
  if (website) patch.website = website;

  const linkedin = https(org.linkedin_url);
  if (linkedin) patch.linkedin = linkedin;

  const description = clean(org.short_description);
  if (description) patch.description = description;

  const logoUrl = clean(org.logo_url);
  if (logoUrl) patch.logoUrl = logoUrl;

  if (city || country) {
    patch.headquarters = {
      city: city ?? "",
      line1: clean(org.street_address) ?? country ?? "",
      country: country ?? "",
    };
  }

  return patch;
}

/**
 * Narrow a patch to the fields a company is actually missing.
 *
 * This is the rule that makes the pass safe to run repeatedly: Apollo is
 * evidence, but it is weaker than anything a person typed, so it may only fill
 * blanks. `countryCode` counts as blank when it is the "XX" placeholder the
 * outreach importer writes when a domain's TLD says nothing.
 */
export interface CompanyGaps {
  type: string;
  size: string | null;
  city: string;
  countryCode: string;
  website: string | null;
  linkedin: string | null;
  description: string | null;
  logoUpdatedAt: Date | null;
}

export function narrowToGaps(patch: ApolloPatch, current: CompanyGaps): ApolloPatch {
  const out: ApolloPatch = {};

  // `other` is the importer's "unknown", so it is a gap rather than a choice.
  if (patch.type && current.type === "other") out.type = patch.type;
  if (patch.size && !current.size) out.size = patch.size;
  if (patch.city && !current.city.trim()) out.city = patch.city;
  if (patch.countryCode && (current.countryCode === "XX" || !current.countryCode)) {
    out.countryCode = patch.countryCode;
    if (patch.country) out.country = patch.country;
  }
  if (patch.website && !current.website?.trim()) out.website = patch.website;
  if (patch.linkedin && !current.linkedin?.trim()) out.linkedin = patch.linkedin;
  if (patch.description && !current.description?.trim()) out.description = patch.description;
  // The logo pipeline stores bytes and stamps logoUpdatedAt; only offer a URL
  // to a company that has no logo at all.
  if (patch.logoUrl && !current.logoUpdatedAt) out.logoUrl = patch.logoUrl;

  // Headquarters rides along only when it would add something.
  if (out.city || out.countryCode) out.headquarters = patch.headquarters;

  return out;
}

/** True when a patch would change nothing, so the write can be skipped. */
export function isEmptyPatch(patch: ApolloPatch): boolean {
  return Object.keys(patch).length === 0;
}

/* ────────────────────────────── Response + errors ────────────────────────────── */

/** Read a bulk_enrich response. Tolerant: a bad shape yields nothing, not a throw. */
export function parseApolloBulk(payload: unknown): ApolloOrganization[] {
  if (typeof payload !== "object" || payload === null) return [];
  const orgs = (payload as { organizations?: unknown }).organizations;
  if (!Array.isArray(orgs)) return [];
  return orgs.filter(
    (org): org is ApolloOrganization => typeof org === "object" && org !== null,
  );
}

export type ApolloFailure = "unauthorized" | "forbidden" | "rate_limited" | "unavailable" | "network";

/**
 * What an HTTP status means for the caller.
 *
 * 403 is its own case rather than folded into unauthorized: on the free plan it
 * is what an endpoint outside the tier returns (`people/match` does exactly
 * this), and that is a permanent fact about the plan, not a bad key.
 */
export function apolloFailureFor(httpStatus: number): ApolloFailure {
  if (httpStatus === 401) return "unauthorized";
  if (httpStatus === 403) return "forbidden";
  if (httpStatus === 429) return "rate_limited";
  return "unavailable";
}

/** A failure that means: stop the run, the next call will fail the same way. */
export function isFatalApolloFailure(failure: ApolloFailure): boolean {
  return failure === "unauthorized" || failure === "forbidden" || failure === "rate_limited";
}
