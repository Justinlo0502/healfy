// Strava integration: OAuth, token refresh, activity/stream fetching, and
// the sync job that turns raw Strava activities into Activity rows with
// precomputed insights. No React/route concerns live here — the API routes
// under src/app/api/auth/strava and src/app/api/webhooks/strava are thin
// wrappers around this file so the sync logic has exactly one home.

import { db } from "@/lib/db";
import { ActivitySource } from "@/generated/prisma/enums";
import type { StravaAccount, Athlete } from "@/generated/prisma/client";
import {
  trainingLoadForActivity,
  aerobicEfficiency,
  hrDriftPct,
  downsampleStream,
  type StreamData,
} from "@/lib/insights";

const STRAVA_OAUTH_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_OAUTH_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE = "https://www.strava.com/api/v3";

// How far back to look on a brand-new connection (no lastSyncedAt yet).
const INITIAL_SYNC_LOOKBACK_DAYS = 90;
// Cap per sync invocation so a first-connect backfill (or a burst of
// webhook pings) can't blow through Strava's rate limits.
const MAX_ACTIVITIES_PER_SYNC = 30;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. See .env.example.`);
  return value;
}

async function throwOnError(res: Response, context: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "<unreadable body>");
    throw new Error(`${context} failed: ${res.status} ${res.statusText} - ${body}`);
  }
}

/** Builds the Strava OAuth authorize URL the user is redirected to. */
export function getAuthorizeUrl(): string {
  const clientId = requireEnv("STRAVA_CLIENT_ID");
  const redirectUri = requireEnv("STRAVA_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });

  return `${STRAVA_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
  athlete?: { id: number; [key: string]: unknown };
};

/** Exchanges an OAuth `code` (from the callback redirect) for tokens. */
export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
    }),
  });
  await throwOnError(res, "Strava token exchange");
  return res.json();
}

export type StravaRefreshResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch seconds
};

/** Exchanges a refresh token for a new access token. */
export async function refreshAccessToken(refreshToken: string): Promise<StravaRefreshResponse> {
  const res = await fetch(STRAVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("STRAVA_CLIENT_ID"),
      client_secret: requireEnv("STRAVA_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  await throwOnError(res, "Strava token refresh");
  return res.json();
}

/**
 * Returns a usable access token for this StravaAccount, refreshing (and
 * persisting the refreshed tokens) first if the current one is expired or
 * about to expire.
 */
export async function getValidAccessToken(stravaAccount: StravaAccount): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAtSec = Math.floor(stravaAccount.expiresAt.getTime() / 1000);
  // Refresh a little early (5 min buffer) so an in-flight request never
  // races an expiry mid-call.
  if (expiresAtSec - nowSec > 300) {
    return stravaAccount.accessToken;
  }

  const refreshed = await refreshAccessToken(stravaAccount.refreshToken);
  await db.stravaAccount.update({
    where: { id: stravaAccount.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(refreshed.expires_at * 1000),
    },
  });
  return refreshed.access_token;
}

export type StravaSummaryActivity = {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date: string;
  moving_time: number;
  distance: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  [key: string]: unknown;
};

/**
 * Lists activities for the authenticated athlete, newest first, optionally
 * only those after the given epoch-seconds timestamp. Pages through up to
 * a few pages of results (50/page) so a large backlog doesn't require a
 * caller-managed loop.
 */
export async function listActivities(
  accessToken: string,
  after?: number,
  maxPages = 5
): Promise<StravaSummaryActivity[]> {
  const perPage = 50;
  const all: StravaSummaryActivity[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
    });
    if (after !== undefined) params.set("after", String(after));

    const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    await throwOnError(res, "Strava list activities");
    const batch: StravaSummaryActivity[] = await res.json();
    all.push(...batch);

    if (batch.length < perPage) break; // last page
  }

  return all;
}

type StravaStreamSet = {
  time?: { data: number[] };
  heartrate?: { data: number[] };
  velocity_smooth?: { data: number[] };
  distance?: { data: number[] };
};

/**
 * Fetches time/heartrate/velocity/distance streams for one activity and
 * maps + downsamples them into the StreamData shape used across the app.
 */
export async function getActivityStreams(
  accessToken: string,
  activityId: string | number
): Promise<StreamData | null> {
  const params = new URLSearchParams({
    keys: "time,heartrate,velocity_smooth,distance",
    key_by_type: "true",
  });
  const res = await fetch(`${STRAVA_API_BASE}/activities/${activityId}/streams?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return null; // some activities (manual entries) have no streams

  await throwOnError(res, `Strava get streams for activity ${activityId}`);
  const raw: StravaStreamSet = await res.json();

  if (!raw.time?.data?.length) return null;

  const stream: StreamData = {
    time: raw.time.data,
    heartrate: raw.heartrate?.data,
    velocity: raw.velocity_smooth?.data,
    distance: raw.distance?.data,
  };

  return downsampleStream(stream, 500);
}

export type SyncResult = { activitiesCreated: number };

/**
 * Full sync for one athlete: pulls new Strava activities since their last
 * sync (or the last 90 days on a first connect), fetches streams and
 * computes insights for each, writes Activity rows, and bumps
 * StravaAccount.lastSyncedAt. Capped at MAX_ACTIVITIES_PER_SYNC new
 * activities per call.
 */
export async function syncStravaForAthlete(athleteId: string): Promise<SyncResult> {
  const athlete = await db.athlete.findUnique({ where: { id: athleteId } });
  if (!athlete) throw new Error(`Athlete ${athleteId} not found`);

  const stravaAccount = await db.stravaAccount.findUnique({ where: { athleteId } });
  if (!stravaAccount) throw new Error(`Athlete ${athleteId} has no connected StravaAccount`);

  const accessToken = await getValidAccessToken(stravaAccount);

  const afterSec = stravaAccount.lastSyncedAt
    ? Math.floor(stravaAccount.lastSyncedAt.getTime() / 1000)
    : Math.floor((Date.now() - INITIAL_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000) / 1000);

  const summaries = await listActivities(accessToken, afterSec);

  // Oldest first so a partial/interrupted sync still leaves history in order.
  summaries.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());

  let activitiesCreated = 0;

  for (const summary of summaries) {
    if (activitiesCreated >= MAX_ACTIVITIES_PER_SYNC) break;

    const stravaId = String(summary.id);
    const existing = await db.activity.findUnique({ where: { stravaId } });
    if (existing) continue;

    await createActivityFromStrava(accessToken, summary, athlete);
    activitiesCreated++;
  }

  await db.stravaAccount.update({
    where: { id: stravaAccount.id },
    data: { lastSyncedAt: new Date() },
  });

  return { activitiesCreated };
}

async function createActivityFromStrava(
  accessToken: string,
  summary: StravaSummaryActivity,
  athlete: Athlete
): Promise<void> {
  const avgHR = summary.average_heartrate != null ? Math.round(summary.average_heartrate) : null;
  const maxHR = summary.max_heartrate != null ? Math.round(summary.max_heartrate) : null;
  const movingTimeSec = summary.moving_time;
  const distanceMeters = summary.distance;
  const avgPaceSecPerKm =
    distanceMeters > 0 ? Math.round((movingTimeSec / (distanceMeters / 1000)) * 10) / 10 : null;

  let streamData: StreamData | null = null;
  try {
    streamData = await getActivityStreams(accessToken, summary.id);
  } catch {
    // Streams are a nice-to-have (HR drift chart, etc.) — don't fail the
    // whole activity import if Strava errors fetching them.
    streamData = null;
  }

  let trainingLoad: number | null = null;
  let aerobicEff: number | null = null;
  let drift: number | null = null;

  if (avgHR != null) {
    trainingLoad = trainingLoadForActivity(avgHR, movingTimeSec, {
      maxHR: athlete.maxHR,
      restingHR: athlete.restingHR,
    });
    aerobicEff = aerobicEfficiency(avgHR, distanceMeters, movingTimeSec);
  }
  if (streamData) {
    drift = hrDriftPct(streamData);
  }

  await db.activity.create({
    data: {
      athleteId: athlete.id,
      source: ActivitySource.STRAVA,
      stravaId: String(summary.id),
      name: summary.name,
      type: summary.type ?? summary.sport_type ?? "Workout",
      startTime: new Date(summary.start_date),
      movingTimeSec,
      distanceMeters,
      elevationGainMeters: summary.total_elevation_gain ?? null,
      avgHR,
      maxHR,
      avgPaceSecPerKm,
      streamData: streamData ? (streamData as unknown as object) : undefined,
      trainingLoad,
      aerobicEfficiency: aerobicEff,
      hrDriftPct: drift,
    },
  });
}
