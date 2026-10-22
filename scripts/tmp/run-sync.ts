import "dotenv/config";
import { db } from "@/lib/db";
import { syncGarminForAthlete } from "@/lib/garmin";
async function main() {
  const a = await db.garminAccount.findFirstOrThrow();
  console.log(await syncGarminForAthlete(a.athleteId));
  const m = await db.dailyMetric.findFirst({ where: { athleteId: a.athleteId }, orderBy: { date: "desc" } });
  console.log("newest metric:", m?.date, "bb", m?.bodyBattery, "readiness", m?.trainingReadiness);
  const act = await db.activity.findFirst({ where: { athleteId: a.athleteId, source: "GARMIN" }, orderBy: { startTime: "desc" } });
  console.log("newest garmin activity:", act?.startTime, act?.name);
}
main().finally(() => db.$disconnect());
