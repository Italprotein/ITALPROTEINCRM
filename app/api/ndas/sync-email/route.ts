import { NextResponse } from "next/server";

import { runGmailSync } from "@/lib/backend/gmail-sync";
import { checkRateLimit } from "@/lib/backend/rate-limit";
import { requireAction } from "@/lib/backend/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    // Same cron-or-staff branch as app/api/ndas/sync-drive/route.ts. Without it
    // this route could only ever be reached by a signed-in user, so the email
    // half of NDA ingestion could not be scheduled at all. `runGmailSync` files
    // documents against the mailbox rather than an actor, so unlike sync-drive
    // there is no actor to resolve — the cron path simply skips the guard.
    const cronSecret = process.env.CRON_SECRET;
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);
    if (!isCron) await requireAction("nda.prepare");
    // Rate limit applies to both paths: it is what stops a wedged cron (or a
    // retry storm) from hammering Gmail.
    if (!(await checkRateLimit("gmail:nda-thread-sync", 3, 10 * 60)).ok) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }

    const result = await runGmailSync({ ndaBackfill: true, maxMessages: 500 });
    return NextResponse.json(result, { status: result.ok ? 200 : 503 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SYNC_FAILED" },
      { status: 400 },
    );
  }
}
