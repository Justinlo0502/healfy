import { NextRequest, NextResponse } from "next/server";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { connectGarmin } from "@/lib/garmin";

/**
 * Takes the athlete's real Garmin email/password over our own HTTPS form
 * (never logged) and hands them to connectGarmin(), which performs the
 * login server-side and persists only the resulting session — never the
 * password itself. See src/lib/garmin.ts for where the actual login call
 * happens and the ToS tradeoff that comes with it.
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

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return NextResponse.json(
      { ok: false, error: "email and password are required" },
      { status: 400 }
    );
  }

  try {
    await connectGarmin(athlete.id, email, password);
  } catch (err) {
    // connectGarmin() only throws Errors with end-user-safe messages, so
    // it's fine to surface err.message directly here — never the raw
    // exception (which could include response bodies/stack traces).
    const message =
      err instanceof Error ? err.message : "Garmin login failed — check your email and password";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

/** Disconnects Garmin: deletes the athlete's stored session. */
export async function DELETE() {
  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  await db.garminAccount.deleteMany({ where: { athleteId: athlete.id } });
  return NextResponse.json({ ok: true });
}
