import { NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/backend/rate-limit";
import { runOutreachImport } from "@/lib/backend/outreach-companies";
import { getCurrentUser } from "@/lib/backend/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Turn newly-contacted domains into company records.
 *
 * Runs after the Gmail sync rather than inside it, on purpose. The sync loop is
 * the one piece of this system that everything else is downstream of, and it
 * already carries the NDA path, thread stitching and lead matching; bolting
 * company creation into it would put all of that behind a new failure mode.
 * This pass reads the same table a few minutes later and is idempotent — a
 * domain that became a company on the last run classifies as `link` on the
 * next — so running it separately costs nothing but a second pass.
 *
 * Guard mirrors the other cron routes: a signed-in user who may create
 * companies, or a scheduler holding CRON_SECRET.
 */
async function handle(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);

  if (!isCron) {
    const user = await getCurrentUser();
    if (!user || !can(user.role, "company.create")) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
  }

  const limit = await checkRateLimit("companies:sync-outreach", 4, 60);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const result = await runOutreachImport();
  // The candidate list can run to hundreds of rows; the counts are what a
  // scheduler needs, and the detail is available from the importer script.
  return NextResponse.json({
    ok: true,
    domains: result.domains,
    alreadyCompanies: result.linked,
    companiesCreated: result.companiesCreated,
    contactsCreated: result.contactsCreated,
    messagesLinked: result.messagesLinked,
    repliesLinked: result.repliesLinked,
    ignored: result.ignored,
    unattributed: result.unattributed,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
