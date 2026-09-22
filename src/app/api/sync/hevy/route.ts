import { NextRequest, NextResponse } from "next/server";
import { getSessionAthleteId } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncHevyForAthlete } from "@/lib/hevy";

/**
 * Triggers a Hevy sync for every connected athlete. Callable two ways:
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

  const accounts = await db.hevyAccount.findMany({ select: { athleteId: true } });

  let synced = 0;
  let workoutsSynced = 0;
  let routinesSynced = 0;
  let routineFoldersSynced = 0;
  let exerciseTemplatesSynced = 0;
  let bodyMeasurementsSynced = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    try {
      const result = await syncHevyForAthlete(account.athleteId);
      synced++;
      workoutsSynced += result.workoutsSynced;
      routinesSynced += result.routinesSynced;
      routineFoldersSynced += result.routineFoldersSynced;
      exerciseTemplatesSynced += result.exerciseTemplatesSynced;
      bodyMeasurementsSynced += result.bodyMeasurementsSynced;
    } catch (err) {
      console.error(`Hevy sync failed for athlete ${account.athleteId}:`, err);
      errors.push(account.athleteId);
    }
  }

  return NextResponse.json({
    synced,
    workoutsSynced,
    routinesSynced,
    routineFoldersSynced,
    exerciseTemplatesSynced,
    bodyMeasurementsSynced,
    errors,
  });
}

// Vercel Cron sends GET and auto-attaches `Authorization: Bearer $CRON_SECRET`;
// POST stays available for a manual "sync now" button in the UI.
export const GET = handleSync;
export const POST = handleSync;
