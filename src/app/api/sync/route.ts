import { NextRequest, NextResponse } from "next/server";
import { getSessionAthleteId } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncStravaForAthlete } from "@/lib/strava";

/**
 * Triggers a Strava sync for every connected athlete. Callable two ways:
 *  - headlessly, by a cron job, with `Authorization: Bearer ${CRON_SECRET}`
 *  - from the logged-in UI ("sync now"), via the normal session cookie
 */
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;

  const athleteId = await getSessionAthleteId();
  return athleteId != null;
}

async function handleSync(req: NextRequest) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await db.stravaAccount.findMany({ select: { athleteId: true } });

  let synced = 0;
  let activitiesCreated = 0;

  for (const account of accounts) {
    try {
      const result = await syncStravaForAthlete(account.athleteId);
      synced++;
      activitiesCreated += result.activitiesCreated;
    } catch (err) {
      console.error(`Strava sync failed for athlete ${account.athleteId}:`, err);
    }
  }

  return NextResponse.json({ synced, activitiesCreated });
}

// Vercel Cron sends GET and auto-attaches `Authorization: Bearer $CRON_SECRET`;
// POST stays available for a manual "sync now" button in the UI.
export const GET = handleSync;
export const POST = handleSync;
