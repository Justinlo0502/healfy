import { NextRequest, NextResponse } from "next/server";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { HevyApiError, pushNewRoutine, pushRoutineUpdate, type RoutineWritePayload } from "@/lib/hevy";

/**
 * Push sync: create a routine in Hevy from data originating in our own app.
 * Body: { title, folderId? (our local HevyRoutineFolder.id), notes?, exercises }
 * where `exercises` is already in Hevy's own request shape (see
 * RoutineWritePayload) — this route is the backend wiring point for
 * whatever routine-builder UI gets added later; Healfy has no such UI yet.
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

  const { title, folderId, notes, exercises } = (body ?? {}) as {
    title?: unknown;
    folderId?: unknown;
    notes?: unknown;
    exercises?: unknown;
  };

  if (typeof title !== "string" || !title.trim() || !Array.isArray(exercises)) {
    return NextResponse.json(
      { ok: false, error: "title and exercises are required" },
      { status: 400 }
    );
  }

  let hevyFolderId: string | number | null | undefined;
  if (typeof folderId === "string") {
    const folder = await db.hevyRoutineFolder.findUnique({ where: { id: folderId } });
    if (!folder) {
      return NextResponse.json({ ok: false, error: "Unknown folderId" }, { status: 400 });
    }
    hevyFolderId = folder.hevyFolderId;
  }

  const payload: RoutineWritePayload = {
    title,
    folder_id: hevyFolderId ?? null,
    notes: typeof notes === "string" ? notes : undefined,
    exercises: exercises as RoutineWritePayload["exercises"],
  };

  try {
    const result = await pushNewRoutine(
      athlete.id,
      payload,
      typeof folderId === "string" ? folderId : null
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof HevyApiError) {
      return NextResponse.json(
        { ok: false, error: `Hevy rejected the routine (${err.status})`, details: err.body },
        { status: err.status === 429 ? 429 : 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "Couldn't create routine in Hevy" }, { status: 502 });
  }
}

/**
 * Push sync: update a routine that was already pushed to Hevy.
 * Body: { localRoutineId (our HevyRoutine.id), title, folderId?, notes?, exercises }
 * Uses the stored hevyRoutineId so this is always a PUT against the same
 * Hevy resource — a retry never creates a duplicate routine.
 */
export async function PUT(req: NextRequest) {
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

  const { localRoutineId, title, folderId, notes, exercises } = (body ?? {}) as {
    localRoutineId?: unknown;
    title?: unknown;
    folderId?: unknown;
    notes?: unknown;
    exercises?: unknown;
  };

  if (typeof localRoutineId !== "string" || typeof title !== "string" || !Array.isArray(exercises)) {
    return NextResponse.json(
      { ok: false, error: "localRoutineId, title, and exercises are required" },
      { status: 400 }
    );
  }

  const existing = await db.hevyRoutine.findFirst({
    where: { id: localRoutineId, athleteId: athlete.id },
  });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Unknown localRoutineId" }, { status: 404 });
  }

  let hevyFolderId: string | number | null | undefined;
  if (typeof folderId === "string") {
    const folder = await db.hevyRoutineFolder.findUnique({ where: { id: folderId } });
    hevyFolderId = folder?.hevyFolderId ?? null;
  }

  const payload: RoutineWritePayload = {
    title,
    folder_id: hevyFolderId ?? null,
    notes: typeof notes === "string" ? notes : undefined,
    exercises: exercises as RoutineWritePayload["exercises"],
  };

  try {
    await pushRoutineUpdate(localRoutineId, payload);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HevyApiError) {
      return NextResponse.json(
        { ok: false, error: `Hevy rejected the routine update (${err.status})`, details: err.body },
        { status: err.status === 429 ? 429 : 400 }
      );
    }
    return NextResponse.json({ ok: false, error: "Couldn't update routine in Hevy" }, { status: 502 });
  }
}
