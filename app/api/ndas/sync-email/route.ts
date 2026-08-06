import { NextResponse } from "next/server";

import { runGmailSync } from "@/lib/backend/gmail-sync";
import { checkRateLimit } from "@/lib/backend/rate-limit";
import { requireAction } from "@/lib/backend/session";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    await requireAction("nda.prepare");
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
