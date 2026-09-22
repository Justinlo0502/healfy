import { NextRequest, NextResponse } from "next/server";
import { getSessionAthleteId } from "@/lib/auth";
import { db } from "@/lib/db";

type PatchBody = {
  maxHR?: number | null;
  restingHR?: number | null;
  lthr?: number | null;
};

function normalizeField(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

export async function PATCH(req: NextRequest) {
  const athleteId = await getSessionAthleteId();
  if (!athleteId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: PatchBody = {};
  const maxHR = normalizeField(body.maxHR);
  const restingHR = normalizeField(body.restingHR);
  const lthr = normalizeField(body.lthr);
  if (maxHR !== undefined) data.maxHR = maxHR;
  if (restingHR !== undefined) data.restingHR = restingHR;
  if (lthr !== undefined) data.lthr = lthr;

  const updated = await db.athlete.update({
    where: { id: athleteId },
    data,
  });

  return NextResponse.json(updated);
}
