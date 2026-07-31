import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { checkRateLimit, clientIpFromHeaders, peekRateLimit, resetRateLimit } from "@/lib/backend/rate-limit";
import { hasActiveSecondFactor } from "@/lib/backend/mfa";
import { issueLoginTicket, userAgentHash, verifyLoginTicket } from "@/lib/backend/login-tickets";

const CHALLENGE_COOKIE = "italprotein_mfa_challenge";
const TRUST_COOKIE = "italprotein_trusted_device";

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as { email?: string; password?: string; workspace?: string } | null;
  const email = input?.email?.trim().toLowerCase() ?? "";
  const password = input?.password ?? "";
  const workspace = input?.workspace;
  if (!email || !password || (workspace !== "internal" && workspace !== "external")) {
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  const verifiedWorkspace: "internal" | "external" = workspace;

  const ip = clientIpFromHeaders(request.headers);
  if (!(await checkRateLimit(`login:ip:${ip}`, 30, 15 * 60)).ok) {
    return NextResponse.json({ error: "TRY_LATER" }, { status: 429 });
  }
  const failKey = `login:fail:${email}`;
  if (!(await peekRateLimit(failKey, 8, 15 * 60)).ok) {
    return NextResponse.json({ error: "TRY_LATER" }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
  const valid = Boolean(
    user?.passwordHash &&
    user.status === "active" &&
    user.kind === workspace &&
    user.role.kind === user.kind &&
    (user.kind === "internal" || user.companyId) &&
    await bcrypt.compare(password, user.passwordHash),
  );
  if (!user || !valid) {
    await checkRateLimit(failKey, 8, 15 * 60);
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  await resetRateLimit(failKey);

  const base = { userId: user.id, workspace: verifiedWorkspace, authVersion: user.authVersion };
  const enrolled = await hasActiveSecondFactor(user.id);
  if (!enrolled) {
    return NextResponse.json({ mfaRequired: false, loginTicket: issueLoginTicket({ ...base, purpose: "login" }, 120) });
  }

  const uaHash = userAgentHash(request.headers.get("user-agent") ?? "");
  const trusted = verifyLoginTicket(
    request.headers.get("cookie")?.match(/(?:^|;\s*)italprotein_trusted_device=([^;]+)/)?.[1] ?? "",
    "trusted_device",
  );
  if (
    trusted?.userId === user.id &&
    trusted.authVersion === user.authVersion &&
    trusted.userAgentHash === uaHash
  ) {
    return NextResponse.json({ mfaRequired: false, loginTicket: issueLoginTicket({ ...base, purpose: "login" }, 120) });
  }

  const response = NextResponse.json({ mfaRequired: true });
  response.cookies.set(CHALLENGE_COOKIE, issueLoginTicket({ ...base, purpose: "mfa_challenge" }, 5 * 60), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 5 * 60,
  });
  return response;
}
