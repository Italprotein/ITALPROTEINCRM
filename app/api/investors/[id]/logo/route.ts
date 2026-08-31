import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { requireInternal } from "@/lib/backend/session";
import { parseLogoDataUri } from "@/lib/company-logo";

/**
 * Serves an investor's stored logo as image bytes. Mechanics mirror
 * app/api/companies/[id]/logo/route.ts exactly — one shared allowlist with the
 * writer, private caching versioned by logoUpdatedAt, and hard headers because
 * this is user-influenced content served from our own origin.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireInternal().catch(() => null);
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  const investor = await prisma.investor.findUnique({
    where: { id },
    select: { logoUrl: true, logoUpdatedAt: true },
  });

  const logo = parseLogoDataUri(investor?.logoUrl);
  if (!logo) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return new NextResponse(Buffer.from(logo.base64, "base64"), {
    headers: {
      "content-type": logo.contentType,
      "cache-control": "private, max-age=3600",
      etag: `"${investor?.logoUpdatedAt?.getTime() ?? 0}"`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "content-disposition": "inline",
    },
  });
}
