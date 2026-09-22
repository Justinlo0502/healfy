import { NextRequest, NextResponse } from "next/server";
import { requireAthlete } from "@/lib/auth";
import { HevyApiError, pushNewExerciseTemplateIfMissing, type ExerciseTemplateWritePayload } from "@/lib/hevy";

/**
 * Push sync: create a custom exercise in Hevy. Idempotent on title — see
 * pushNewExerciseTemplateIfMissing — so a retried request never creates a
 * duplicate exercise in Hevy.
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

  const { title, type, primaryMuscleGroup, secondaryMuscleGroups, equipment } = (body ?? {}) as {
    title?: unknown;
    type?: unknown;
    primaryMuscleGroup?: unknown;
    secondaryMuscleGroups?: unknown;
    equipment?: unknown;
  };

  if (typeof title !== "string" || !title.trim() || typeof type !== "string" || typeof primaryMuscleGroup !== "string") {
    return NextResponse.json(
      { ok: false, error: "title, type, and primaryMuscleGroup are required" },
      { status: 400 }
    );
  }

  const payload: ExerciseTemplateWritePayload = {
    title,
    type,
    primary_muscle_group: primaryMuscleGroup,
    secondary_muscle_groups: Array.isArray(secondaryMuscleGroups)
      ? secondaryMuscleGroups.filter((g): g is string => typeof g === "string")
      : undefined,
    equipment: typeof equipment === "string" ? equipment : undefined,
  };

  try {
    const result = await pushNewExerciseTemplateIfMissing(athlete.id, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof HevyApiError) {
      return NextResponse.json(
        { ok: false, error: `Hevy rejected the exercise (${err.status})`, details: err.body },
        { status: err.status === 429 ? 429 : 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "Couldn't create exercise in Hevy" }, { status: 502 });
  }
}
