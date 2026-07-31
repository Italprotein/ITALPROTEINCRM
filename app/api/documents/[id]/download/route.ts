import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { requireUser } from "@/lib/backend/session";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireUser().catch(() => null);
  if (!actor) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const { id } = await context.params;
  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      companyId: true,
      attachments: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  if (!document || (actor.kind === "external" && document.companyId !== actor.companyId)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const attachment = document.attachments[0];
  if (!attachment) return NextResponse.json({ error: "FILE_NOT_AVAILABLE" }, { status: 404 });
  const publicOrigin = process.env.APP_URL ?? process.env.AUTH_URL ?? request.url;
  return NextResponse.redirect(new URL(`/api/attachments/${attachment.id}`, publicOrigin));
}
