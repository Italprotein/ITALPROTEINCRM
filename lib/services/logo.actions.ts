"use server";

import {
  fetchCompanyLogo,
  importMissingCompanyLogos,
  type LogoFetchOutcome,
} from "@/lib/backend/company-logo";
import { requireAction } from "@/lib/backend/session";
import { isApiMode } from "@/lib/data-mode";

/**
 * Guarded entry points for the company logo pipeline.
 *
 * The mechanics live in lib/backend/company-logo.ts. This file is only the
 * authorisation boundary: every export here is a publicly reachable POST
 * endpoint (middleware does not cover server actions), and both of these
 * trigger outbound HTTP requests and database writes, so both need a guard of
 * their own — see tests/action-guards.test.ts.
 *
 * `company.edit` is an internal-only action (see lib/permissions), so requiring
 * it is both the role gate and the workspace gate.
 */

/** Fetches and stores a logo for one company. See fetchCompanyLogo. */
export async function fetchLogoForCompany(companyId: string): Promise<LogoFetchOutcome> {
  await requireAction("company.edit");
  return fetchCompanyLogo(companyId);
}

/** Backfills logos for every company with a website and no logo yet. */
export async function importMissingLogos(): Promise<{
  updated: number;
  skipped: number;
  failed: number;
}> {
  await requireAction("company.edit");
  // Mock mode has no database behind it; the toolbar button is hidden there, and
  // this is the server-side half of the same rule.
  if (!isApiMode) return { updated: 0, skipped: 0, failed: 0 };
  return importMissingCompanyLogos();
}
