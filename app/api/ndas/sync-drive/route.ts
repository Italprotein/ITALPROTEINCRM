import { NextResponse } from "next/server";

import { requireAction } from "@/lib/backend/session";
import { syncLatestDriveNdas } from "@/lib/backend/drive-nda-sync";

export const maxDuration = 300;

export async function POST() {
  try {
    const actor = await requireAction("nda.prepare");
    return NextResponse.json(await syncLatestDriveNdas(actor.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "SYNC_FAILED" }, { status: 400 });
  }
}
