import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { verifyState } from "@/lib/backend/crypto";
import { exchangeOAuthCode, getGmailProfile, storeMailboxTokens } from "@/lib/backend/gmail";
import { getCurrentUser } from "@/lib/backend/session";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Google OAuth redirect target (GOOGLE_REDIRECT_URI). Static segment, so it
// wins over the [...nextauth] catch-all. Requires the same signed-in admin
// that started the flow (state is HMAC-signed with a 10-minute TTL).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const settingsUrl = (result: string) =>
    NextResponse.redirect(new URL(`/en/admin/settings?gmail=${result}`, request.url));

  if (url.searchParams.get("error")) return settingsUrl("denied");

  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) return settingsUrl("error");

  const state = verifyState<{ uid: string }>(stateRaw);
  if (!state?.uid) return settingsUrl("error");

  const user = await getCurrentUser();
  if (!user || !can(user.role, "settings.edit") || user.id !== state.uid) return settingsUrl("error");

  try {
    const tokens = await exchangeOAuthCode(code);
    const profile = await getGmailProfile({ accessToken: tokens.access_token, email: "" });
    if (!profile.emailAddress) return settingsUrl("error");

    await storeMailboxTokens({
      googleAccountEmail: profile.emailAddress,
      userId: user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSeconds: tokens.expires_in,
    });
    await prisma.auditEvent
      .create({
        data: {
          actorUserId: user.id,
          action: "integration.gmail_connected",
          entityType: "google_oauth_token",
          summary: `Gmail mailbox ${profile.emailAddress} connected to the CRM`,
        },
      })
      .catch(() => undefined);
    return settingsUrl("connected");
  } catch {
    return settingsUrl("error");
  }
}
