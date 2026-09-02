import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/backend/rate-limit";
import { runApolloEnrichment } from "@/lib/backend/apollo-enrich";
import { getCurrentUser } from "@/lib/backend/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
// 20 calls spaced by the throttle, plus the writes behind each.
export const maxDuration = 300;

/**
 * Apollo company enrichment — same guard as the other company routes: a
 * signed-in user who may edit companies, or a scheduler holding CRON_SECRET.
 *
 * Returns 200 with `configured: false` when APOLLO_API_KEY is unset. That is a
 * deployment state to report, not a server error, and the CRM works without it.
 */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!isCron) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "company.edit")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  // Tighter than the free syncs: every call here spends a metered credit.
  const limit = await checkRateLimit("companies:enrich", 3, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await runApolloEnrichment();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
