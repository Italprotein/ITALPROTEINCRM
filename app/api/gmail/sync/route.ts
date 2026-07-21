import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/backend/rate-limit";
import { runGmailSync } from "@/lib/backend/gmail-sync";
import { getCurrentUser } from "@/lib/backend/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gmail inbox sync trigger. Callable by a signed-in admin, or by an external
// scheduler (Vercel cron / cron-job.org) with `Authorization: Bearer CRON_SECRET`.
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!isCron) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "settings.edit")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  const limit = await checkRateLimit("gmail:sync", 4, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await runGmailSync();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
