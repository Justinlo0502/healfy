import { NextResponse } from "next/server";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { RenphoApiError, verifyCredentials } from "@/lib/renpho";

/**
 * "Connects" Renpho for the logged-in athlete. Like Hevy there's no
 * per-athlete credential to collect (auth is the server-side RENPHO_EMAIL /
 * RENPHO_PASSWORD) — this verifies those log in and records a RenphoAccount
 * row so the rest of the app knows Renpho is connected.
 */
export async function POST() {
  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyCredentials();
  } catch (err) {
    if (err instanceof RenphoApiError && err.code != null) {
      return NextResponse.json(
        { ok: false, error: "Renpho rejected the login — check RENPHO_EMAIL and RENPHO_PASSWORD." },
        { status: 400 }
      );
    }
    if (err instanceof Error && err.message.startsWith("RENPHO_EMAIL")) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Couldn't reach Renpho. Try again." }, { status: 502 });
  }

  await db.renphoAccount.upsert({
    where: { athleteId: athlete.id },
    create: { athleteId: athlete.id },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

/** Disconnects Renpho: deletes the athlete's RenphoAccount row (synced weigh-ins are kept). */
export async function DELETE() {
  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await db.renphoAccount.deleteMany({ where: { athleteId: athlete.id } });
  return NextResponse.json({ ok: true });
}
