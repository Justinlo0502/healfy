import { NextRequest, NextResponse } from "next/server";
import { getSessionAthleteId } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncRenphoForAthlete } from "@/lib/renpho";

/**
 * Triggers a Renpho sync for every connected athlete. Callable two ways:
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

  const accounts = await db.renphoAccount.findMany({ select: { athleteId: true } });

  let synced = 0;
  let measurementsSynced = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const result = await syncRenphoForAthlete(account.athleteId);
      synced++;
      measurementsSynced += result.measurementsSynced;
    } catch (err) {
      console.error(`Renpho sync failed for athlete ${account.athleteId}:`, err);
      errors.push(account.athleteId);
    }
  }

  return NextResponse.json({ synced, measurementsSynced, errors });
}

// Vercel Cron sends GET and auto-attaches `Authorization: Bearer $CRON_SECRET`;
// POST stays available for a manual "sync now" button in the UI.
export const GET = handleSync;
export const POST = handleSync;
