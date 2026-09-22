// Garmin integration: login, session persistence, and the sync job that
// pulls daily readiness metrics + scheduled workouts into our own DB.
//
// This talks to Garmin Connect through the unofficial `garmin-connect` npm
// package, which reverse-engineers Garmin's private web API (there's no
// public OAuth API for hobby projects). That's against Garmin's ToS — an
// acceptable, low risk for a single personal account, but not something to
// scale to other people's credentials. The actual login call is in
// connectGarmin() below.
//
// API surface actually exposed by garmin-connect@1.6.2 (confirmed by reading
// its .d.ts files, not the README, which documents some deprecated/removed
// methods — see the note on session persistence below):
//   - login(), exportToken(), loadToken() for session persistence
//   - getSleepData(), getHeartRate(), getWorkouts(), getWorkoutDetail()
//   - generic get<T>(url, config) for anything not wrapped in a typed method
//     (this is the package's own documented escape hatch for missing
//     endpoints, per its README's "Custom requests" section)

import { GarminConnect } from "garmin-connect";
import type {
  IGarminTokens,
  IWorkout,
  IWorkoutDetail,
} from "garmin-connect/dist/garmin/types";
import type { SleepData } from "garmin-connect/dist/garmin/types/sleep";
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { ActivitySource } from "@/generated/prisma/enums";
import {
  aerobicEfficiency,
  downsampleStream,
  hrDriftPct,
  trainingLoadForActivity,
  type StreamData,
} from "@/lib/insights";

const DAILY_METRICS_LOOKBACK_DAYS = 14;
const WORKOUT_FETCH_LIMIT = 50;
const ACTIVITY_FETCH_LIMIT = 100;

// Same host the package's own typed methods (getHeartRate, getSleepData)
// hit internally for wellness-service/sleep-service endpoints — reused here
// for the two metrics that have no typed method at all.
const GC_API_BASE = "https://connectapi.garmin.com";

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLocalMidnight(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Logs into Garmin Connect with the athlete's real email/password (taken
 * once, over our own HTTPS form, never logged) and persists only the
 * resulting OAuth1/OAuth2 token pair — encrypted, never the password
 * itself — as GarminAccount.encryptedSession.
 *
 * Throws an Error whose message is safe to show the end user.
 */
export async function connectGarmin(
  athleteId: string,
  email: string,
  password: string
): Promise<void> {
  // The actual (unofficial, reverse-engineered) login request happens here.
  const client = new GarminConnect({ username: email, password });
  try {
    await client.login();
  } catch {
    throw new Error("Garmin login failed — check your email and password");
  }

  let tokens: IGarminTokens;
  try {
    tokens = client.exportToken();
  } catch {
    throw new Error("Garmin login failed — check your email and password");
  }

  const encryptedSession = encrypt(JSON.stringify(tokens));

  await db.garminAccount.upsert({
    where: { athleteId },
    create: { athleteId, encryptedSession },
    update: { encryptedSession },
  });
}

/**
 * Restores a logged-in garmin-connect client from the athlete's persisted
 * session tokens (never the raw password, which we don't store). Throws if
 * the athlete has no connected GarminAccount or the stored session is
 * unreadable.
 *
 * Note on session persistence: the garmin-connect README describes an
 * older `sessionJson` / `restore()` / `restoreOrLogin()` API as "deprecated"
 * — those methods don't actually exist on GarminConnect in the installed
 * v1.6.2 (checked its GarminConnect.d.ts). The real, current mechanism is
 * exportToken()/loadToken(), which is what's used here.
 */
export async function getGarminClientForAthlete(athleteId: string): Promise<GarminConnect> {
  const account = await db.garminAccount.findUnique({ where: { athleteId } });
  if (!account) throw new Error(`Athlete ${athleteId} has no connected GarminAccount`);

  let tokens: IGarminTokens;
  try {
    tokens = JSON.parse(decrypt(account.encryptedSession)) as IGarminTokens;
  } catch {
    throw new Error("Stored Garmin session could not be read");
  }

  // Dummy credentials: the constructor requires a (truthy) credentials
  // object, but we never call login() on this instance — loadToken()
  // restores auth state from the stored tokens instead, and the HttpClient
  // auto-refreshes the OAuth2 access token from the OAuth1 token when it
  // expires, so no re-login (and no password) is needed here.
  const client = new GarminConnect({ username: "", password: "" });
  client.loadToken(tokens.oauth1, tokens.oauth2);
  return client;
}

type DailyMetricFields = {
  bodyBattery: number | null;
  hrvStatus: string | null;
  hrvMs: number | null;
  restingHR: number | null;
  sleepScore: number | null;
  trainingReadiness: number | null;
};

/**
 * Optional local-dev-only sidecar (garmin-poc/server.py) that wraps
 * python-garminconnect, which — unlike garmin-connect@1.6.2 — has typed
 * methods for every field Healfy needs, including Body Battery, training
 * readiness, and real scheduled-workout dates. Only used when
 * GARMIN_SIDECAR_URL is set (never in production/Vercel); any failure
 * (unset, unreachable, non-200) falls through to the garmin-connect-based
 * logic below, so behavior is unchanged when it's not running.
 */
function getSidecarBaseUrl(): string | null {
  return process.env.GARMIN_SIDECAR_URL || null;
}

async function fetchDailyMetricsFromSidecar(date: Date): Promise<DailyMetricFields | null> {
  const base = getSidecarBaseUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/daily-metrics?date=${toDateString(date)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return (await res.json()) as DailyMetricFields;
  } catch {
    return null;
  }
}

type SidecarWorkout = {
  garminWorkoutId: string;
  name: string;
  scheduledDate: string;
  structure: unknown;
};

async function fetchWorkoutsFromSidecar(limit: number): Promise<SidecarWorkout[] | null> {
  const base = getSidecarBaseUrl();
  if (!base) return null;

  try {
    const res = await fetch(`${base}/workouts?limit=${limit}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SidecarWorkout[];
  } catch {
    return null;
  }
}

type SidecarActivity = {
  garminId: string;
  name: string;
  type: string;
  startTime: string;
  movingTimeSec: number;
  distanceMeters: number;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  avgHR: number | null;
  maxHR: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  streamData: StreamData | null;
};

/**
 * Completed activities (pace/HR/GPS streams) — unlike daily metrics and
 * workouts, garmin-connect@1.6.2 was never wired up for this in Healfy at
 * all (only Strava supplied activities). So there's no npm-based fallback
 * here: if the sidecar is down, Garmin activity sync just does nothing.
 */
async function fetchActivitiesFromSidecar(
  limit: number,
  knownIds: string[]
): Promise<SidecarActivity[] | null> {
  const base = getSidecarBaseUrl();
  if (!base) return null;

  try {
    const knownParam = knownIds.length > 0 ? `&known_ids=${knownIds.join(",")}` : "";
    const res = await fetch(`${base}/activities?limit=${limit}${knownParam}`, {
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) return null;
    return (await res.json()) as SidecarActivity[];
  } catch {
    return null;
  }
}

/**
 * Pulls completed activities from the local-dev sidecar and stores any not
 * already synced, computing the same derived metrics (pace, training load,
 * aerobic efficiency, HR drift) Strava-sourced activities get, via the
 * shared pure functions in src/lib/insights.ts — one implementation of that
 * math, not a second copy.
 */
async function syncGarminActivities(
  athleteId: string,
  athlete: { maxHR: number | null; restingHR: number | null }
): Promise<number> {
  const existing = await db.activity.findMany({
    where: { athleteId, source: ActivitySource.GARMIN },
    select: { garminId: true },
  });
  const knownIds = existing.map((a) => a.garminId).filter((id): id is string => id != null);

  const sidecarActivities = await fetchActivitiesFromSidecar(ACTIVITY_FETCH_LIMIT, knownIds);
  if (!sidecarActivities) return 0;

  let activitiesSynced = 0;

  for (const a of sidecarActivities) {
    const existing = await db.activity.findUnique({ where: { garminId: a.garminId } });
    if (existing) continue;

    const avgPaceSecPerKm =
      a.distanceMeters > 0 ? Math.round((a.movingTimeSec / (a.distanceMeters / 1000)) * 10) / 10 : null;

    const trainingLoad =
      a.avgHR != null ? trainingLoadForActivity(a.avgHR, a.movingTimeSec, athlete) : null;
    const aerobicEff =
      a.avgHR != null ? aerobicEfficiency(a.avgHR, a.distanceMeters, a.movingTimeSec) : null;

    const streamData = a.streamData ? downsampleStream(a.streamData, 500) : null;
    const drift = streamData ? hrDriftPct(streamData) : null;

    await db.activity.create({
      data: {
        athleteId,
        source: ActivitySource.GARMIN,
        garminId: a.garminId,
        name: a.name,
        type: a.type,
        startTime: new Date(a.startTime),
        movingTimeSec: a.movingTimeSec,
        distanceMeters: a.distanceMeters,
        elevationGainMeters: a.elevationGainMeters,
        elevationLossMeters: a.elevationLossMeters,
        avgHR: a.avgHR,
        maxHR: a.maxHR,
        temperatureC: a.temperatureC,
        humidityPct: a.humidityPct,
        avgPaceSecPerKm,
        streamData: streamData as unknown as object,
        trainingLoad,
        aerobicEfficiency: aerobicEff,
        hrDriftPct: drift,
      },
    });
    activitiesSynced++;
  }

  return activitiesSynced;
}

/**
 * Body Battery has no typed method in garmin-connect@1.6.2. This hits
 * Garmin's undocumented wellness endpoint directly via the client's generic
 * get() — the same escape hatch the package's own README recommends for
 * gaps like this. Response shape is unverified/unofficial, so this is
 * deliberately defensive: any mismatch just yields null rather than
 * breaking the whole sync.
 */
async function fetchBodyBattery(client: GarminConnect, date: Date): Promise<number | null> {
  const dateStr = toDateString(date);
  try {
    const res = await client.get<unknown>(
      `${GC_API_BASE}/wellness-service/wellness/bodyBattery/reports/daily/${dateStr}/${dateStr}`
    );
    const day = (Array.isArray(res) ? res[0] : res) as
      | { bodyBatteryValuesArray?: unknown[]; charged?: number }
      | undefined;

    const values = day?.bodyBatteryValuesArray;
    // Each entry is [timestamp, level | null] — index 1 is the level.
    // A bare `typeof v === "number"` scan over the pair picks the timestamp
    // first, since it's always numeric and null isn't.
    if (Array.isArray(values)) {
      for (let i = values.length - 1; i >= 0; i--) {
        const entry = values[i];
        if (Array.isArray(entry) && typeof entry[1] === "number") {
          return Math.round(entry[1]);
        }
      }
    }
    if (typeof day?.charged === "number") return Math.round(day.charged);
    return null;
  } catch {
    return null;
  }
}

/**
 * "Training readiness" has no typed method either (closest thing this
 * package exposes at all is via custom get()) — same undocumented-endpoint
 * caveat as fetchBodyBattery above.
 */
async function fetchTrainingReadiness(client: GarminConnect, date: Date): Promise<number | null> {
  const dateStr = toDateString(date);
  try {
    const res = await client.get<unknown>(
      `${GC_API_BASE}/metrics-service/metrics/trainingreadiness/${dateStr}`
    );
    const entry = (Array.isArray(res) ? res[0] : res) as { score?: number } | undefined;
    return typeof entry?.score === "number" ? Math.round(entry.score) : null;
  } catch {
    return null;
  }
}

/**
 * Pulls one day's readiness metrics. When the local-dev sidecar is running
 * (GARMIN_SIDECAR_URL set), it's the sole source — python-garminconnect has
 * typed methods for every field here, so there's no need to also hit
 * garmin-connect for a partial result. Only on sidecar failure/absence
 * (always true in production) does this fall back to garmin-connect: sleep,
 * hrvStatus, hrvMs, and sleepScore off the typed getSleepData() response;
 * restingHR from the dedicated getHeartRate() call, falling back to the
 * sleep response's restingHeartRate; bodyBattery and trainingReadiness from
 * the undocumented-endpoint fallbacks below since garmin-connect doesn't
 * expose them at all.
 */
async function fetchDailyMetrics(client: GarminConnect, date: Date): Promise<DailyMetricFields | null> {
  const sidecarResult = await fetchDailyMetricsFromSidecar(date);
  if (sidecarResult && Object.values(sidecarResult).some((v) => v !== null)) {
    return sidecarResult;
  }

  let sleep: SleepData | null = null;
  try {
    sleep = await client.getSleepData(date);
  } catch {
    sleep = null;
  }

  let restingHR: number | null =
    typeof sleep?.restingHeartRate === "number" ? sleep.restingHeartRate : null;
  try {
    const hr = (await client.getHeartRate(date)) as unknown as { restingHeartRate?: number };
    if (typeof hr?.restingHeartRate === "number") restingHR = hr.restingHeartRate;
  } catch {
    // keep whatever we already got from sleep data, if anything
  }

  const bodyBattery = await fetchBodyBattery(client, date);
  const trainingReadiness = await fetchTrainingReadiness(client, date);

  const sleepScore = sleep?.dailySleepDTO?.sleepScores?.overall?.value ?? null;
  const hrvMs = typeof sleep?.avgOvernightHrv === "number" ? Math.round(sleep.avgOvernightHrv) : null;
  const hrvStatus = sleep?.hrvStatus ?? null;

  const hasAnyData =
    sleep != null ||
    restingHR != null ||
    bodyBattery != null ||
    trainingReadiness != null;
  if (!hasAnyData) return null;

  return { bodyBattery, hrvStatus, hrvMs, restingHR, sleepScore, trainingReadiness };
}

/**
 * Scheduled workouts. When the local-dev sidecar is running, it's the sole
 * source: python-garminconnect has a real calendar/scheduling endpoint
 * (get_scheduled_workouts), giving actual scheduled dates instead of a
 * guess — something garmin-connect@1.6.2 simply cannot provide (the
 * README's `scheduleWorkout` example doesn't correspond to any method that
 * actually exists on GarminConnect in this version).
 *
 * On sidecar failure/absence (always true in production), falls back to
 * garmin-connect's workout library — getWorkouts()/getWorkoutDetail() —
 * which is where Runna-pushed workouts land (Runna creates structured
 * workouts in Garmin's workout library). Since IWorkout has no
 * scheduledDate field there, updateDate (falling back to createdDate, then
 * now) is used as the closest available proxy for "when this was
 * pushed/updated".
 */
async function syncWorkouts(client: GarminConnect, athleteId: string): Promise<number> {
  const sidecarWorkouts = await fetchWorkoutsFromSidecar(WORKOUT_FETCH_LIMIT);
  if (sidecarWorkouts) {
    let workoutsSynced = 0;
    for (const w of sidecarWorkouts) {
      const scheduledDate = new Date(w.scheduledDate);
      await db.plannedWorkout.upsert({
        where: { garminWorkoutId: w.garminWorkoutId },
        create: {
          athleteId,
          garminWorkoutId: w.garminWorkoutId,
          name: w.name,
          scheduledDate,
          structure: w.structure as object,
        },
        update: {
          name: w.name,
          scheduledDate,
          structure: w.structure as object,
        },
      });
      workoutsSynced++;
    }
    return workoutsSynced;
  }

  let list: IWorkout[] = [];
  try {
    list = await client.getWorkouts(0, WORKOUT_FETCH_LIMIT);
  } catch {
    return 0;
  }

  let workoutsSynced = 0;

  for (const workout of list) {
    if (workout.workoutId == null) continue;
    const garminWorkoutId = String(workout.workoutId);

    let detail: IWorkout | IWorkoutDetail = workout;
    try {
      detail = await client.getWorkoutDetail({ workoutId: garminWorkoutId });
    } catch {
      // fall back to the summary if the detail fetch fails; still store what we have
    }

    const scheduledDateRaw = detail.updateDate ?? detail.createdDate ?? new Date();
    const scheduledDate = new Date(scheduledDateRaw);
    const name = detail.workoutName ?? "Garmin workout";

    await db.plannedWorkout.upsert({
      where: { garminWorkoutId },
      create: {
        athleteId,
        garminWorkoutId,
        name,
        scheduledDate,
        structure: detail as unknown as object,
      },
      update: {
        name,
        scheduledDate,
        structure: detail as unknown as object,
      },
    });
    workoutsSynced++;
  }

  return workoutsSynced;
}

export type GarminSyncResult = {
  dailyMetricsSynced: number;
  workoutsSynced: number;
  activitiesSynced: number;
};

/**
 * Full sync for one athlete: pulls ~14 days of daily readiness metrics
 * (upserted per local-midnight date), the current Garmin workout library
 * (upserted by garminWorkoutId), and — local-dev-sidecar only — completed
 * activities, then bumps GarminAccount.lastSyncedAt.
 */
export async function syncGarminForAthlete(athleteId: string): Promise<GarminSyncResult> {
  const account = await db.garminAccount.findUnique({ where: { athleteId } });
  if (!account) throw new Error(`Athlete ${athleteId} has no connected GarminAccount`);

  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    select: { maxHR: true, restingHR: true },
  });
  if (!athlete) throw new Error(`Athlete ${athleteId} not found`);

  const client = await getGarminClientForAthlete(athleteId);

  let dailyMetricsSynced = 0;
  for (let i = 0; i < DAILY_METRICS_LOOKBACK_DAYS; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const localMidnight = toLocalMidnight(date);

    const metrics = await fetchDailyMetrics(client, date);
    if (!metrics) continue;

    await db.dailyMetric.upsert({
      where: { athleteId_date: { athleteId, date: localMidnight } },
      create: { athleteId, date: localMidnight, ...metrics },
      update: { ...metrics },
    });
    dailyMetricsSynced++;
  }

  const workoutsSynced = await syncWorkouts(client, athleteId);
  const activitiesSynced = await syncGarminActivities(athleteId, athlete);

  await db.garminAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  return { dailyMetricsSynced, workoutsSynced, activitiesSynced };
}
