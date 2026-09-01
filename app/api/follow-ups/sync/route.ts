import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/backend/rate-limit";
import { runFollowUpSync } from "@/lib/backend/follow-up-register";
import { getCurrentUser } from "@/lib/backend/session";
import { canEdit } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Follow-up register sync — same shape as /api/shipments/sync-tracking: a
 * signed-in user who may edit the register, or a scheduler holding CRON_SECRET.
 *
 * Idempotent by construction. The pass creates at most one row per company and
 * refreshes only the counters on rows it created itself, so a missed run costs
 * nothing and re-running never overwrites a decision somebody made by hand.
 */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!isCron) {
    const user = await getCurrentUser();
    // The same right the page checks before showing the sync button.
    if (!user || !canEdit(user.role, "follow_ups")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  const limit = await checkRateLimit("follow-ups:sync", 6, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await runFollowUpSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
