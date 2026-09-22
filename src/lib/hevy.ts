// Hevy (strength training) integration: the shared REST client, pull sync
// (Hevy -> our DB), and push helpers (our DB -> Hevy). No React/route
// concerns live here — the API routes under src/app/api/auth/hevy,
// src/app/api/sync/hevy, and src/app/api/hevy are thin wrappers around this
// file so the sync/push logic has exactly one home, same as strava.ts and
// garmin.ts.
//
// Unlike Strava (OAuth) and Garmin (email/password), Hevy auth is a single
// long-lived API key tied to one Hevy account (HEVY_API_KEY) — there's no
// per-athlete token to mint or refresh, no OAuth dance, and no webhook/push
// sync: everything here is polled.
//
// Response shapes below are taken from live calls against the real API
// (api.hevyapp.com/v1), not from guessed docs — see the field names as
// observed: pagination is `{ page, page_count, <resource_key>: [...] }`,
// workouts/routines share an `exercises[].sets[]` shape keyed by
// `exercise_template_id`/`weight_kg`/`reps`, routine_folder ids are numeric
// while every other Hevy id is an opaque string (some exercise_template ids
// are short hex codes, others full UUIDs) — so all Hevy-side ids are stored
// here as strings.

import { db } from "@/lib/db";

const BASE_URL = "https://api.hevyapp.com/v1";
const MAX_RETRIES = 4;

function requireApiKey(): string {
  const key = process.env.HEVY_API_KEY;
  if (!key) throw new Error("HEVY_API_KEY is not set. See .env.example.");
  return key;
}

export class HevyApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "HevyApiError";
    this.status = status;
    this.body = body;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Centralizes the base URL and auth header. Throws HevyApiError (status +
 * body attached) on any non-2xx so callers can tell a bad/revoked key
 * (401/403) apart from rate limiting (429) or a missing resource (404) —
 * never swallowed, so a failed sync is never a silent no-op. Retries on 429
 * with exponential backoff, honoring `Retry-After` when Hevy sends one.
 */
export async function hevyFetch<T = unknown>(
  pathAndQuery: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = requireApiKey();

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}${pathAndQuery}`, {
      ...options,
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfterHeader = res.headers.get("Retry-After");
      const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
      const delayMs = Number.isFinite(retryAfterSec)
        ? retryAfterSec * 1000
        : 2 ** attempt * 1000;
      await sleep(delayMs);
      continue;
    }

    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    if (!res.ok) {
      throw new HevyApiError(
        `Hevy API ${res.status} ${res.statusText} on ${pathAndQuery}`,
        res.status,
        body
      );
    }
    return body as T;
  }
}

type Paginated<K extends string, T> = { page: number; page_count: number } & Record<K, T[]>;

/**
 * Loops a paginated Hevy list endpoint until every page has been fetched
 * (checked against the returned `page_count`, not assumed to be one page),
 * accumulating and returning every item. `pageSize` is capped at 10 by the
 * live API on every list endpoint (confirmed via a 400 "pageSize must be
 * less than or equal to 10" on a higher value) — callers should not pass more.
 */
async function fetchAllPages<K extends string, T>(
  path: string,
  resourceKey: K,
  pageSize = 10
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const result = await hevyFetch<Paginated<K, T>>(
      `${path}${path.includes("?") ? "&" : "?"}page=${page}&pageSize=${pageSize}`
    );
    all.push(...(result[resourceKey] ?? []));
    pageCount = result.page_count;
    page++;
  } while (page <= pageCount);

  return all;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type HevyUserInfo = { data: { id: string; name: string; url: string } };

export function getUserInfo(): Promise<HevyUserInfo> {
  return hevyFetch<HevyUserInfo>("/user/info");
}

export type HevySet = {
  index: number;
  type: string;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  rpe?: number | null;
  custom_metric?: number | null;
};

export type HevyExercise = {
  index: number;
  title: string;
  notes: string;
  exercise_template_id: string;
  superset_id: number | null;
  rest_seconds?: number | null;
  sets: HevySet[];
};

export type HevyWorkoutDto = {
  id: string;
  title: string;
  routine_id: string | null;
  description: string;
  start_time: string;
  end_time: string;
  updated_at: string;
  created_at: string;
  exercises: HevyExercise[];
};

export type HevyRoutineDto = {
  id: string;
  title: string;
  folder_id: number | string | null;
  updated_at: string;
  created_at: string;
  exercises: HevyExercise[];
};

export type HevyRoutineFolderDto = {
  id: number | string;
  index: number;
  title: string;
  updated_at: string;
  created_at: string;
};

export type HevyExerciseTemplateDto = {
  id: string;
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups: string[];
  equipment: string;
  is_custom: boolean;
};

export type HevyBodyMeasurementDto = {
  id: number | string;
  date: string;
  weight_kg: number | null;
  created_at: string;
  [key: string]: unknown;
};

export type HevyWorkoutEvent =
  | { type: "new" | "updated"; workout: HevyWorkoutDto }
  | { type: "deleted"; id: string; deleted_at?: string };

export function getWorkoutsCount(): Promise<{ workout_count: number }> {
  return hevyFetch("/workouts/count");
}

export function listAllWorkouts(): Promise<HevyWorkoutDto[]> {
  return fetchAllPages<"workouts", HevyWorkoutDto>("/workouts", "workouts", 10);
}

export function listAllRoutines(): Promise<HevyRoutineDto[]> {
  return fetchAllPages<"routines", HevyRoutineDto>("/routines", "routines", 10);
}

export function listAllRoutineFolders(): Promise<HevyRoutineFolderDto[]> {
  return fetchAllPages<"routine_folders", HevyRoutineFolderDto>(
    "/routine_folders",
    "routine_folders",
    10
  );
}

export function listAllExerciseTemplates(): Promise<HevyExerciseTemplateDto[]> {
  return fetchAllPages<"exercise_templates", HevyExerciseTemplateDto>(
    "/exercise_templates",
    "exercise_templates",
    10
  );
}

export function listAllBodyMeasurements(): Promise<HevyBodyMeasurementDto[]> {
  return fetchAllPages<"body_measurements", HevyBodyMeasurementDto>(
    "/body_measurements",
    "body_measurements",
    10
  );
}

/**
 * Incremental workout sync: every created/updated/deleted workout event
 * since `since`. Pages through the same `page_count` shape as every other
 * list endpoint.
 */
export async function listWorkoutEventsSince(since: Date): Promise<HevyWorkoutEvent[]> {
  const all: HevyWorkoutEvent[] = [];
  let page = 1;
  let pageCount = 1;
  const sinceParam = encodeURIComponent(since.toISOString());

  do {
    // Confirmed live quirk: when there are zero matching events, Hevy
    // returns `{ page, page_count, workouts: [] }` instead of the `events`
    // key used whenever there's at least one — so `events` may be absent.
    const result = await hevyFetch<{
      page: number;
      page_count: number;
      events?: HevyWorkoutEvent[];
      workouts?: never[];
    }>(`/workouts/events?page=${page}&pageSize=10&since=${sinceParam}`);
    all.push(...(result.events ?? []));
    pageCount = result.page_count;
    page++;
  } while (page <= pageCount);

  return all;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createRoutineFolderInHevy(title: string): Promise<HevyRoutineFolderDto> {
  const result = await hevyFetch<{ routine_folder: HevyRoutineFolderDto }>("/routine_folders", {
    method: "POST",
    body: JSON.stringify({ routine_folder: { title } }),
  });
  return result.routine_folder;
}

export type RoutineWritePayload = {
  title: string;
  folder_id?: string | number | null;
  notes?: string;
  exercises: Array<{
    exercise_template_id: string;
    superset_id?: number | null;
    rest_seconds?: number | null;
    notes?: string;
    sets: Array<{
      type: string;
      weight_kg?: number | null;
      reps?: number | null;
      distance_meters?: number | null;
      duration_seconds?: number | null;
    }>;
  }>;
};

export async function createRoutineInHevy(payload: RoutineWritePayload): Promise<HevyRoutineDto> {
  const result = await hevyFetch<{ routine: HevyRoutineDto }>("/routines", {
    method: "POST",
    body: JSON.stringify({ routine: payload }),
  });
  return result.routine;
}

export async function updateRoutineInHevy(
  hevyRoutineId: string,
  payload: RoutineWritePayload
): Promise<HevyRoutineDto> {
  const result = await hevyFetch<{ routine: HevyRoutineDto }>(`/routines/${hevyRoutineId}`, {
    method: "PUT",
    body: JSON.stringify({ routine: payload }),
  });
  return result.routine;
}

export type ExerciseTemplateWritePayload = {
  title: string;
  type: string;
  primary_muscle_group: string;
  secondary_muscle_groups?: string[];
  equipment?: string;
};

export async function createExerciseTemplateInHevy(
  payload: ExerciseTemplateWritePayload
): Promise<HevyExerciseTemplateDto> {
  const result = await hevyFetch<{ exercise_template: HevyExerciseTemplateDto }>(
    "/exercise_templates",
    {
      method: "POST",
      body: JSON.stringify({ exercise_template: payload }),
    }
  );
  return result.exercise_template;
}

// ---------------------------------------------------------------------------
// Pull sync (Hevy -> our DB)
// ---------------------------------------------------------------------------

function workoutToRow(athleteId: string, w: HevyWorkoutDto) {
  return {
    athleteId,
    hevyWorkoutId: w.id,
    title: w.title,
    startTime: new Date(w.start_time),
    endTime: w.end_time ? new Date(w.end_time) : null,
    exercises: w.exercises as unknown as object,
  };
}

async function upsertWorkout(athleteId: string, w: HevyWorkoutDto): Promise<void> {
  const data = workoutToRow(athleteId, w);
  await db.hevyWorkout.upsert({
    where: { hevyWorkoutId: w.id },
    create: data,
    update: data,
  });
}

async function syncRoutineFolders(athleteId: string): Promise<number> {
  const folders = await listAllRoutineFolders();
  for (const f of folders) {
    const data = {
      athleteId,
      hevyFolderId: String(f.id),
      title: f.title,
      hevyIndex: f.index,
    };
    await db.hevyRoutineFolder.upsert({
      where: { hevyFolderId: String(f.id) },
      create: data,
      update: { title: data.title, hevyIndex: data.hevyIndex },
    });
  }
  return folders.length;
}

async function syncRoutines(athleteId: string): Promise<number> {
  const routines = await listAllRoutines();
  for (const r of routines) {
    let folderId: string | null = null;
    if (r.folder_id != null) {
      const folder = await db.hevyRoutineFolder.findUnique({
        where: { hevyFolderId: String(r.folder_id) },
      });
      folderId = folder?.id ?? null;
    }

    const data = {
      athleteId,
      hevyRoutineId: r.id,
      title: r.title,
      folderId,
      exercises: r.exercises as unknown as object,
    };
    await db.hevyRoutine.upsert({
      where: { hevyRoutineId: r.id },
      create: data,
      update: {
        title: data.title,
        folderId: data.folderId,
        exercises: data.exercises,
      },
    });
  }
  return routines.length;
}

async function syncExerciseTemplates(athleteId: string): Promise<number> {
  const templates = await listAllExerciseTemplates();
  for (const t of templates) {
    const data = {
      athleteId,
      hevyExerciseTemplateId: t.id,
      title: t.title,
      type: t.type,
      primaryMuscleGroup: t.primary_muscle_group,
      equipment: t.equipment,
      isCustom: t.is_custom,
    };
    await db.hevyExerciseTemplate.upsert({
      where: { hevyExerciseTemplateId: t.id },
      create: data,
      update: {
        title: data.title,
        type: data.type,
        primaryMuscleGroup: data.primaryMuscleGroup,
        equipment: data.equipment,
        isCustom: data.isCustom,
      },
    });
  }
  return templates.length;
}

async function syncBodyMeasurements(athleteId: string): Promise<number> {
  const measurements = await listAllBodyMeasurements();
  for (const m of measurements) {
    const { id, date, weight_kg, created_at: _created_at, ...rest } = m;
    void _created_at;
    const hasOther = Object.keys(rest).length > 0;
    const data = {
      athleteId,
      hevyMeasurementId: String(id),
      date: new Date(date),
      weightKg: weight_kg,
      otherMeasurements: hasOther ? (rest as unknown as object) : undefined,
    };
    await db.hevyBodyMeasurement.upsert({
      where: { hevyMeasurementId: String(id) },
      create: data,
      update: { date: data.date, weightKg: data.weightKg, otherMeasurements: data.otherMeasurements },
    });
  }
  return measurements.length;
}

/**
 * Full backfill: pages through every workout Hevy has for this account.
 * Used only on the first-ever sync (no lastEventSyncAt yet) — every
 * subsequent sync uses the cheaper /workouts/events incremental path below.
 */
async function fullWorkoutBackfill(athleteId: string): Promise<number> {
  const workouts = await listAllWorkouts();
  for (const w of workouts) {
    await upsertWorkout(athleteId, w);
  }
  return workouts.length;
}

/** Incremental sync: created/updated/deleted workouts since the last sync. */
async function incrementalWorkoutSync(athleteId: string, since: Date): Promise<number> {
  const events = await listWorkoutEventsSince(since);
  let count = 0;
  for (const event of events) {
    if (event.type === "deleted") {
      await db.hevyWorkout.deleteMany({ where: { hevyWorkoutId: event.id } });
    } else {
      await upsertWorkout(athleteId, event.workout);
    }
    count++;
  }
  return count;
}

export type HevySyncResult = {
  workoutsSynced: number;
  routinesSynced: number;
  routineFoldersSynced: number;
  exerciseTemplatesSynced: number;
  bodyMeasurementsSynced: number;
};

/**
 * Full sync for one athlete: routine folders, routines, and the exercise
 * library are always re-pulled in full (small, cheap lists with no
 * incremental endpoint); workouts use /workouts/events since the last sync
 * once one has happened, falling back to a full /workouts backfill the
 * first time. Bumps HevyAccount.lastSyncedAt / lastEventSyncAt on success.
 */
export async function syncHevyForAthlete(athleteId: string): Promise<HevySyncResult> {
  const account = await db.hevyAccount.findUnique({ where: { athleteId } });
  if (!account) throw new Error(`Athlete ${athleteId} has no connected HevyAccount`);

  const routineFoldersSynced = await syncRoutineFolders(athleteId);
  const routinesSynced = await syncRoutines(athleteId);
  const exerciseTemplatesSynced = await syncExerciseTemplates(athleteId);
  const bodyMeasurementsSynced = await syncBodyMeasurements(athleteId);

  const syncStartedAt = new Date();
  const workoutsSynced = account.lastEventSyncAt
    ? await incrementalWorkoutSync(athleteId, account.lastEventSyncAt)
    : await fullWorkoutBackfill(athleteId);

  await db.hevyAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date(), lastEventSyncAt: syncStartedAt },
  });

  return {
    workoutsSynced,
    routinesSynced,
    routineFoldersSynced,
    exerciseTemplatesSynced,
    bodyMeasurementsSynced,
  };
}

// ---------------------------------------------------------------------------
// Push sync (our DB -> Hevy)
// ---------------------------------------------------------------------------

/**
 * Creates a routine in Hevy and persists it locally keyed by the returned
 * Hevy id, so a later edit can PUT against that id instead of creating a
 * duplicate. Callers that already have a local HevyRoutine row (an edit,
 * not a create) should call updateRoutineInHevy + a plain db update instead
 * — this is only for the create path.
 */
export async function pushNewRoutine(
  athleteId: string,
  payload: RoutineWritePayload,
  localFolderId?: string | null
): Promise<{ hevyRoutineId: string }> {
  const created = await createRoutineInHevy(payload);
  await db.hevyRoutine.create({
    data: {
      athleteId,
      hevyRoutineId: created.id,
      title: created.title,
      folderId: localFolderId ?? null,
      exercises: created.exercises as unknown as object,
    },
  });
  return { hevyRoutineId: created.id };
}

/** Updates an existing (already-pushed) routine in Hevy and mirrors the change locally. */
export async function pushRoutineUpdate(
  localRoutineId: string,
  payload: RoutineWritePayload
): Promise<void> {
  const existing = await db.hevyRoutine.findUnique({ where: { id: localRoutineId } });
  if (!existing) throw new Error(`No local HevyRoutine ${localRoutineId}`);

  const updated = await updateRoutineInHevy(existing.hevyRoutineId, payload);
  await db.hevyRoutine.update({
    where: { id: localRoutineId },
    data: { title: updated.title, exercises: updated.exercises as unknown as object },
  });
}

/**
 * Creates a routine folder in Hevy, but only if one with this exact title
 * isn't already stored locally — Hevy's create endpoint has no natural
 * idempotency key of its own, so a retried sync/click would otherwise
 * create a duplicate folder every time.
 */
export async function pushNewRoutineFolderIfMissing(
  athleteId: string,
  title: string
): Promise<{ hevyFolderId: string }> {
  const existing = await db.hevyRoutineFolder.findFirst({ where: { athleteId, title } });
  if (existing) return { hevyFolderId: existing.hevyFolderId };

  const created = await createRoutineFolderInHevy(title);
  await db.hevyRoutineFolder.create({
    data: {
      athleteId,
      hevyFolderId: String(created.id),
      title: created.title,
      hevyIndex: created.index,
    },
  });
  return { hevyFolderId: String(created.id) };
}

/** Same check-before-create idempotency as pushNewRoutineFolderIfMissing, keyed on title. */
export async function pushNewExerciseTemplateIfMissing(
  athleteId: string,
  payload: ExerciseTemplateWritePayload
): Promise<{ hevyExerciseTemplateId: string }> {
  const existing = await db.hevyExerciseTemplate.findFirst({
    where: { athleteId, title: payload.title },
  });
  if (existing) return { hevyExerciseTemplateId: existing.hevyExerciseTemplateId };

  const created = await createExerciseTemplateInHevy(payload);
  await db.hevyExerciseTemplate.create({
    data: {
      athleteId,
      hevyExerciseTemplateId: created.id,
      title: created.title,
      type: created.type,
      primaryMuscleGroup: created.primary_muscle_group,
      equipment: created.equipment,
      isCustom: created.is_custom,
    },
  });
  return { hevyExerciseTemplateId: created.id };
}
