import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { checkRateLimit, resetRateLimit } from "@/lib/backend/rate-limit";
import { verifySecondFactor } from "@/lib/backend/mfa";
import { issueLoginTicket, userAgentHash, verifyLoginTicket } from "@/lib/backend/login-tickets";

const CHALLENGE_COOKIE = "italprotein_mfa_challenge";

export async function POST(request: Request) {
  const challenge = verifyLoginTicket(
    request.headers.get("cookie")?.match(/(?:^|;\s*)italprotein_mfa_challenge=([^;]+)/)?.[1] ?? "",
    "mfa_challenge",
  );
  if (!challenge) return NextResponse.json({ error: "CHALLENGE_EXPIRED" }, { status: 401 });
  const input = await request.json().catch(() => null) as { code?: string; rememberDevice?: boolean } | null;
  if (!(await checkRateLimit(`login:mfa:${challenge.userId}`, 8, 15 * 60)).ok) {
    return NextResponse.json({ error: "TRY_LATER" }, { status: 429 });
  }
  const user = await prisma.user.findUnique({ where: { id: challenge.userId }, select: { authVersion: true, status: true } });
  if (!user || user.status !== "active" || user.authVersion !== challenge.authVersion || !(await verifySecondFactor(challenge.userId, input?.code ?? ""))) {
    return NextResponse.json({ error: "INVALID_CODE" }, { status: 401 });
  }
  await resetRateLimit(`login:mfa:${challenge.userId}`);

  const response = NextResponse.json({
    loginTicket: issueLoginTicket({
      purpose: "login", userId: challenge.userId, workspace: challenge.workspace, authVersion: challenge.authVersion,
    }, 120),
  });
  response.cookies.delete(CHALLENGE_COOKIE);
  if (input?.rememberDevice) {
    response.cookies.set("italprotein_trusted_device", issueLoginTicket({
      purpose: "trusted_device",
      userId: challenge.userId,
      workspace: challenge.workspace,
      authVersion: challenge.authVersion,
      userAgentHash: userAgentHash(request.headers.get("user-agent") ?? ""),
    }, 30 * 24 * 60 * 60), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 24 * 60 * 60,
    });
  }
  return response;
}
