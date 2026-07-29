import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { captureError } from "@/lib/backend/observability";

export const dynamic = "force-dynamic";

/*
 * Liveness + readiness probe for uptime monitoring (UptimeRobot, BetterStack,
 * Hetzner checks — anything that can poll a URL and alert).
 *
 * Deliberately unauthenticated so a monitor can reach it, and deliberately
 * uninformative: it reveals only up/down. No version, environment, row counts or
 * error text — a health endpoint should never become a recon endpoint.
 *
 * It touches the database because "Next.js is running" is not the useful
 * question; "can we serve a request end to end" is.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    captureError(error, { source: "GET /api/health" });
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
