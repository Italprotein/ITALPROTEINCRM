import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { requireSection } from "@/lib/backend/session";
import { parseCourierEmail } from "@/lib/backend/courier-email";

export async function GET() {
  try {
    await requireSection("shipments");
    const messages = await prisma.emailMessage.findMany({
      where: {
        OR: [
          { fromAddress: { contains: "dhl", mode: "insensitive" } },
          { fromAddress: { contains: "brt", mode: "insensitive" } },
          { fromAddress: { contains: "poste", mode: "insensitive" } },
          { fromAddress: { contains: "sda", mode: "insensitive" } },
        ],
      },
      orderBy: { internalDate: "desc" },
      take: 1000,
      select: { gmailMessageId: true, fromAddress: true, subject: true, bodyText: true, snippet: true, internalDate: true },
    });
    const updates = messages
      .map((message) => parseCourierEmail({
        from: message.fromAddress,
        subject: message.subject ?? "",
        body: message.bodyText ?? message.snippet ?? "",
        occurredAt: message.internalDate,
        messageId: message.gmailMessageId,
      }))
      .filter((update): update is NonNullable<typeof update> => Boolean(update));
    return NextResponse.json(updates);
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
}
