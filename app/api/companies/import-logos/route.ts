import { NextResponse } from "next/server";

import { importMissingCompanyLogos } from "@/lib/backend/company-logo";
import { checkRateLimit } from "@/lib/backend/rate-limit";
import { getCurrentUser } from "@/lib/backend/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Company logo backfill trigger — same shape as /api/gmail/sync and the two
 * document sync routes: a signed-in admin, or a scheduler holding CRON_SECRET.
 *
 * The Companies page already exposes this action behind a button, but a button
 * cannot backfill a book of several hundred companies: one run is capped at a
 * 60s wall-clock budget and reports `remaining`, so the backfill is meant to be
 * repeated until that reaches zero. This endpoint is what makes "repeat it"
 * something a person or a cron line can do, rather than a human clicking until
 * the number stops moving.
 *
 * Idempotent by construction — a company holding logo bytes is no longer a
 * candidate, so re-running only ever picks up what is still missing.
 */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!isCron) {
    const user = await getCurrentUser();
    // Same right the Companies page checks before showing the button.
    if (!user || !can(user.role, "company.edit")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  const limit = await checkRateLimit("companies:import-logos", 10, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await importMissingCompanyLogos();
  return NextResponse.json(result, { status: 200 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
