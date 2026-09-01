import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/backend/rate-limit";
import { runDhlTrackingSync } from "@/lib/backend/dhl-tracking";
import { getCurrentUser } from "@/lib/backend/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
// One call per parcel, spaced by the throttle — a full batch takes minutes.
export const maxDuration = 300;

/**
 * DHL Unified Tracking sync — same guard as /api/shipments/sync-tracking: a
 * signed-in admin who may update shipments, or a scheduler holding CRON_SECRET.
 *
 * Kept separate from the email sync on purpose. That one is free and reads the
 * whole mailbox; this one spends a metered daily budget. Sharing a route would
 * mean an exhausted DHL quota could stop the courier emails from being read.
 *
 * Returns 200 with `configured: false` when DHL_API_KEY is unset — that is a
 * deployment state to report, not a server error.
 */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!isCron) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "shipment.update")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  // Tighter than the email sync's 6/min: every call here costs quota.
  const limit = await checkRateLimit("shipments:sync-dhl", 3, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await runDhlTrackingSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
