import { NextResponse } from "next/server";

import { requireAction } from "@/lib/backend/session";
import { syncLatestDriveNdas } from "@/lib/backend/drive-nda-sync";
import { prisma } from "@/lib/backend/prisma";
import { checkRateLimit } from "@/lib/backend/rate-limit";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);
    const actorId = isCron
      ? (await prisma.user.findFirst({
          where: { kind: "internal", status: "active", role: { key: "super_admin" } },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        }))?.id
      : (await requireAction("nda.prepare")).id;
    if (!actorId) return NextResponse.json({ error: "NO_SYNC_ACTOR" }, { status: 503 });
    if (!(await checkRateLimit("drive:nda-sync", 3, 10 * 60)).ok) {
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }
    return NextResponse.json(await syncLatestDriveNdas(actorId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SYNC_FAILED" }, { status: 400 });
  }
}
