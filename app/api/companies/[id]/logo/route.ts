import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { requireInternal } from "@/lib/backend/session";

/**
 * Serves a company's stored logo as image bytes.
 *
 * The logo lives in the database as a base64 data URI, but it never travels in
 * the companies list payload (see lib/services/company.mapper.ts) — the DTO
 * carries only `logoUpdatedAt`, and the browser fetches the bytes from here,
 * once, cached. Mechanics mirror app/api/users/[id]/avatar/route.ts.
 *
 * Internal staff only: the companies section is hidden from portal roles, and a
 * company logo is a fingerprint of who we are talking to. External users get the
 * same 404 as a missing logo, so the endpoint reveals nothing either way.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireInternal().catch(() => null);
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await context.params;
  const company = await prisma.company.findUnique({
    where: { id },
    select: { logoUrl: true, logoUpdatedAt: true },
  });
  if (!company?.logoUrl?.startsWith("data:image/")) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Favicon providers return more formats than a user avatar upload ever does —
  // .ico and .svg both turn up in practice, so both are allowed through.
  const match = company.logoUrl.match(
    /^data:(image\/(?:jpeg|png|webp|x-icon|vnd\.microsoft\.icon|svg\+xml));base64,(.+)$/s,
  );
  if (!match) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "content-type": match[1],
      // Private: it is behind a session, so no shared cache may keep it.
      "cache-control": "private, max-age=3600",
      etag: `"${company.logoUpdatedAt?.getTime() ?? 0}"`,
    },
  });
}
