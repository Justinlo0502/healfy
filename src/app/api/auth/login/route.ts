import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

const GENERIC_ERROR = "Invalid email or password.";

export async function POST(req: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  const athlete = await db.athlete.findUnique({ where: { email } });

  // Compare against a fixed dummy hash when the athlete doesn't exist so
  // the response time doesn't leak whether the email is registered.
  const hash = athlete?.passwordHash ?? "$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q4v6C4v6C4v6C4v6C4v6C4v6C4v6C";
  const matches = await bcrypt.compare(password, hash);

  if (!athlete || !matches) {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  await createSession(athlete.id);
  return NextResponse.json({ ok: true });
}
