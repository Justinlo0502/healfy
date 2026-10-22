import "dotenv/config";
import { db } from "@/lib/db";
import { getGarminClientForAthlete } from "@/lib/garmin";

async function step<T>(label: string, fn: () => Promise<T>) {
  try {
    const v = await fn();
    const s = JSON.stringify(v);
    console.log(`OK   ${label}: ${s === undefined ? "undefined" : s.slice(0, 200)}`);
    return v;
  } catch (e) {
    const err = e as { message?: string; response?: { status?: number; data?: unknown } };
    console.log(
      `FAIL ${label}: ${err.message} status=${err.response?.status} data=${JSON.stringify(err.response?.data)?.slice(0, 200)}`
    );
    return null;
  }
}

async function main() {
  const accounts = await db.garminAccount.findMany({
    select: { athleteId: true, lastSyncedAt: true, connectedAt: true },
  });
  console.log("accounts:", accounts);
  if (!accounts.length) return;
  const athleteId = accounts[0].athleteId;

  const newest = await db.dailyMetric.findFirst({ where: { athleteId }, orderBy: { date: "desc" } });
  console.log("newest dailyMetric:", newest?.date, "bodyBattery", newest?.bodyBattery, "sleep", newest?.sleepScore);
  const newestAct = await db.activity.findFirst({
    where: { athleteId, source: "GARMIN" },
    orderBy: { startTime: "desc" },
    select: { startTime: true, name: true },
  });
  console.log("newest garmin activity:", newestAct);

  console.log("sidecar url set:", !!process.env.GARMIN_SIDECAR_URL, process.env.GARMIN_SIDECAR_URL);
  await step("sidecar /daily-metrics", async () => {
    const r = await fetch(`${process.env.GARMIN_SIDECAR_URL}/daily-metrics?date=${new Date().toISOString().slice(0, 10)}`, {
      signal: AbortSignal.timeout(15000),
    });
    return { status: r.status, body: (await r.text()).slice(0, 150) };
  });

  const client = await step("load client from stored tokens", () => getGarminClientForAthlete(athleteId));
  if (!client) return;
  const today = new Date();
  await step("getUserProfile", () => client.getUserProfile());
  await step("getSleepData", () => client.getSleepData(today));
  await step("getHeartRate", () => client.getHeartRate(today));
  await step("getActivities", async () => (await client.getActivities(0, 3)).map((a) => [a.activityId, a.startTimeLocal]));
  await step("getWorkouts", async () => (await client.getWorkouts(0, 3)).map((w) => [w.workoutId, w.workoutName]));
  const d = today.toISOString().slice(0, 10);
  await step("bodyBattery", () =>
    client.get(`https://connectapi.garmin.com/wellness-service/wellness/bodyBattery/reports/daily?startDate=${d}&endDate=${d}`)
  );
  await step("trainingReadiness", () =>
    client.get(`https://connectapi.garmin.com/metrics-service/metrics/trainingreadiness/${d}`)
  );
}

main().finally(() => db.$disconnect());
