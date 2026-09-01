import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/backend/rate-limit";
import { runShipmentTrackingSync } from "@/lib/backend/shipment-tracking";
import { getCurrentUser } from "@/lib/backend/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Courier-email tracking sync — same shape as /api/gmail/sync and the two
 * document syncs: a signed-in admin who may update shipments, or a scheduler
 * holding CRON_SECRET.
 *
 * Idempotent by construction (events are keyed on the Gmail message id), so a
 * missed run costs nothing and re-running is always safe.
 */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!isCron) {
    const user = await getCurrentUser();
    // The same right the shipment page checks before letting someone edit a
    // shipment — this writes delivery dates and statuses.
    if (!user || !can(user.role, "shipment.update")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  const limit = await checkRateLimit("shipments:sync-tracking", 6, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await runShipmentTrackingSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
