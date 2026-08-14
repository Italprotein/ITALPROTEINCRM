import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { requireInternal } from "@/lib/backend/session";
import { parseLogoDataUri } from "@/lib/company-logo";

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

  // One shared allowlist with the writer (lib/company-logo.ts): if the stored
  // bytes are malformed or of a type we do not serve, this is a 404, exactly as
  // if there were no logo — the UI falls back to initials either way.
  const logo = parseLogoDataUri(company?.logoUrl);
  if (!logo) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return new NextResponse(Buffer.from(logo.base64, "base64"), {
    headers: {
      "content-type": logo.contentType,
      // Private: it is behind a session, so no shared cache may keep it.
      "cache-control": "private, max-age=3600",
      etag: `"${company?.logoUpdatedAt?.getTime() ?? 0}"`,
      // This is user-influenced content served from the app's own origin, and
      // the app sets no CSP. `nosniff` stops a browser from ignoring the
      // declared type and re-interpreting the bytes as HTML or script; the
      // response CSP neuters anything active if the bytes ever were a document
      // despite the allowlist. Belt and braces, both free.
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "content-disposition": "inline",
    },
  });
}
