import { NextResponse } from "next/server";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserInfo, HevyApiError } from "@/lib/hevy";

/**
 * "Connects" Hevy for the logged-in athlete. There's no per-athlete
 * credential to collect (auth is the single server-side HEVY_API_KEY) — this
 * just verifies that key works against GET /user/info and records a
 * HevyAccount row so the rest of the app knows Hevy is connected.
 */
export async function POST() {
  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await getUserInfo();
  } catch (err) {
    if (err instanceof HevyApiError && (err.status === 401 || err.status === 403)) {
      return NextResponse.json(
        { ok: false, error: "Hevy rejected the API key — regenerate it in the Hevy app and update HEVY_API_KEY." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "Couldn't reach Hevy. Try again." }, { status: 502 });
  }

  await db.hevyAccount.upsert({
    where: { athleteId: athlete.id },
    create: { athleteId: athlete.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

/** Disconnects Hevy: deletes the athlete's HevyAccount row (synced data is kept). */
export async function DELETE() {
  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await db.hevyAccount.deleteMany({ where: { athleteId: athlete.id } });
  return NextResponse.json({ ok: true });
}
