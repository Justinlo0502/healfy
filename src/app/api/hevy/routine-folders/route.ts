import { NextRequest, NextResponse } from "next/server";
import { requireAthlete } from "@/lib/auth";
import { HevyApiError, pushNewRoutineFolderIfMissing } from "@/lib/hevy";

/**
 * Push sync: create a routine folder in Hevy. Idempotent on title — see
 * pushNewRoutineFolderIfMissing — so a retried request never creates a
 * duplicate folder in Hevy.
 */
export async function POST(req: NextRequest) {
  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { title } = (body ?? {}) as { title?: unknown };
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ ok: false, error: "title is required" }, { status: 400 });
  }

  try {
    const result = await pushNewRoutineFolderIfMissing(athlete.id, title);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof HevyApiError) {
      return NextResponse.json(
        { ok: false, error: `Hevy rejected the folder (${err.status})`, details: err.body },
        { status: err.status === 429 ? 429 : 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "Couldn't create folder in Hevy" }, { status: 502 });
  }
}
