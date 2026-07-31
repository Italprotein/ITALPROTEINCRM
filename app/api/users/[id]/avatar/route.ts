import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { requireUser } from "@/lib/backend/session";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireUser().catch(() => null);
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await context.params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, kind: true, companyId: true, status: true, image: true, updatedAt: true },
  });
  const visible = target && target.status === "active" && (
    actor.kind === "internal" ||
    target.kind === "internal" ||
    target.id === actor.id ||
    (actor.companyId && target.companyId === actor.companyId)
  );
  if (!visible || !target.image?.startsWith("data:image/")) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const match = target.image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s);
  if (!match) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "content-type": match[1],
      "cache-control": "private, max-age=300",
      etag: `"${target.updatedAt.getTime()}"`,
    },
  });
}
