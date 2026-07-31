import { NextResponse } from "next/server";

import { signState } from "@/lib/backend/crypto";
import { absoluteUrl } from "@/lib/backend/env";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/backend/gmail";
import { getCurrentUser } from "@/lib/backend/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Starts the Google OAuth flow for connecting the org Gmail mailbox.
// Middleware never covers /api, so this route enforces its own session check.
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "integrations.manage")) {
    return NextResponse.redirect(absoluteUrl("/en/team-login"));
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(absoluteUrl("/en/admin/settings?gmail=not_configured"));
  }
  const state = signState({ uid: user.id });
  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
