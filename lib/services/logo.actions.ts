"use server";

import { importMissingCompanyLogos } from "@/lib/backend/company-logo";
import { requireAction } from "@/lib/backend/session";
import { isApiMode } from "@/lib/data-mode";

/**
 * Guarded entry point for the company logo pipeline.
 *
 * The mechanics live in lib/backend/company-logo.ts. This file is only the
 * authorisation boundary: every export here is a publicly reachable POST
 * endpoint (middleware does not cover server actions), and this one triggers
 * outbound HTTP requests and database writes, so it needs a guard of its own —
 * see tests/action-guards.test.ts.
 *
 * There is deliberately no single-company action here. `createCompany` calls
 * `fetchCompanyLogo` from the backend module directly, inside code that has
 * already authorised the caller, so a second exported wrapper would only widen
 * the public surface for nobody.
 *
 * `company.edit` is an internal-only action (see lib/permissions), so requiring
 * it is both the role gate and the workspace gate.
 */

/**
 * Backfills logos for every company with a website and no logo yet.
 *
 * `remaining` is non-zero when the run hit its wall-clock budget: the work is
 * unfinished, not failed, and running it again resumes where this one stopped.
 */
export async function importMissingLogos(): Promise<{
  updated: number;
  skipped: number;
  failed: number;
  remaining: number;
}> {
  await requireAction("company.edit");
  // Mock mode has no database behind it; the toolbar button is hidden there, and
  // this is the server-side half of the same rule.
  if (!isApiMode) return { updated: 0, skipped: 0, failed: 0, remaining: 0 };
  return importMissingCompanyLogos();
}
