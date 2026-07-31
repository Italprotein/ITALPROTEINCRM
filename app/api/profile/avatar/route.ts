import { NextResponse } from "next/server";

import { prisma } from "@/lib/backend/prisma";
import { requireUser } from "@/lib/backend/session";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET() {
  try {
    const actor = await requireUser();
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { image: true },
    });
    return NextResponse.json({
      image: user?.image?.startsWith("data:image/") ? user.image : null,
    });
  } catch {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireUser();
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "IMAGE_REQUIRED" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type) || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "INVALID_IMAGE" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const image = `data:${file.type};base64,${bytes.toString("base64")}`;
    await prisma.user.update({
      where: { id: actor.id },
      data: { image, updatedById: actor.id },
    });
    return NextResponse.json({ image });
  } catch {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
}
