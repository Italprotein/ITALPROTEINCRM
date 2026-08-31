import { NextResponse } from "next/server";

import { importMissingInvestorLogos } from "@/lib/backend/investor-logo";
import { checkRateLimit } from "@/lib/backend/rate-limit";
import { getCurrentUser } from "@/lib/backend/session";
import { canEdit } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Investor logo backfill trigger — same shape as
 * app/api/companies/import-logos/route.ts: a signed-in editor of the investors
 * section, or a scheduler holding CRON_SECRET. One run is capped at a 60s
 * budget and reports `remaining`, so it is meant to be repeated until zero;
 * idempotent because a row holding bytes is no longer a candidate.
 */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!isCron) {
    const user = await getCurrentUser();
    // Same right the Investors page checks before showing the button.
    if (!user || !canEdit(user.role, "investors")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  const limit = await checkRateLimit("investors:import-logos", 10, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await importMissingInvestorLogos();
  return NextResponse.json(result, { status: 200 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
