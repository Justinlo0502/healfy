// Creates the one athlete account from .env, plus enough realistic mock
// training history that the dashboard is fully demoable before Strava or
// Garmin are ever connected. Run with `npm run seed`.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { trainingLoadForActivity, aerobicEfficiency, hrDriftPct, type StreamData } from "../src/lib/insights";

function buildRunStream(movingTimeSec: number, avgHR: number, avgPaceSecPerKm: number, fatigueDriftPct: number) {
  const points = 240;
  const time: number[] = [];
  const heartrate: number[] = [];
  const velocity: number[] = [];
  const distance: number[] = [];
  let cumDist = 0;
  const baseVelocity = 1000 / avgPaceSecPerKm; // m/s

  for (let i = 0; i < points; i++) {
    const frac = i / (points - 1);
    const t = Math.round(frac * movingTimeSec);
    // Speed drifts down slightly across the run; HR drifts up — the
    // classic decoupling shape — scaled by fatigueDriftPct.
    const v = baseVelocity * (1 - (fatigueDriftPct / 100) * 0.5 * frac) + (Math.random() - 0.5) * 0.1;
    const hr = Math.round(avgHR * (1 + (fatigueDriftPct / 100) * 0.5 * frac) + (Math.random() - 0.5) * 4);
    cumDist += i === 0 ? 0 : v * (t - time[i - 1]);
    time.push(t);
    heartrate.push(Math.max(80, hr));
    velocity.push(Math.max(0.5, v));
    distance.push(Math.round(cumDist));
  }
  return { time, heartrate, velocity, distance } satisfies StreamData;
}

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.");

  const passwordHash = await bcrypt.hash(password, 12);

  const athlete = await db.athlete.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      displayName: "You",
      maxHR: 190,
      restingHR: 48,
      lthr: 168,
    },
  });

  const existing = await db.activity.count({ where: { athleteId: athlete.id } });
  if (existing > 0) {
    console.log(`Athlete already has ${existing} activities — skipping activity seed.`);
    return;
  }

  const runTypes = [
    { name: "Easy Run", avgHR: 142, paceSecPerKm: 335, distanceKm: 8, drift: 3 },
    { name: "Long Run", avgHR: 151, paceSecPerKm: 320, distanceKm: 18, drift: 9 },
    { name: "Tempo Run", avgHR: 168, paceSecPerKm: 275, distanceKm: 10, drift: 4 },
    { name: "Recovery Jog", avgHR: 128, paceSecPerKm: 370, distanceKm: 5, drift: 1 },
    { name: "Interval Session", avgHR: 175, paceSecPerKm: 255, distanceKm: 9, drift: 5 },
  ];

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let week = 8; week >= 0; week--) {
    const sessionsThisWeek = 3 + Math.floor(Math.random() * 3); // 3-5 runs/week
    for (let s = 0; s < sessionsThisWeek; s++) {
      const template = runTypes[Math.floor(Math.random() * runTypes.length)];
      const dayOffset = week * 7 + Math.floor(Math.random() * 7);
      const startTime = new Date(now - dayOffset * dayMs);

      // Slow, gentle "fitness improving" trend: efficiency creeps up and
      // aerobic HR creeps down over the 8-week window.
      const progress = (8 - week) / 8;
      const avgHR = Math.round(template.avgHR - progress * 4);
      const distanceMeters = Math.round(template.distanceKm * 1000 * (0.9 + Math.random() * 0.2));
      const movingTimeSec = Math.round((distanceMeters / 1000) * (template.paceSecPerKm - progress * 6));

      const stream = buildRunStream(movingTimeSec, avgHR, template.paceSecPerKm, template.drift);
      const load = trainingLoadForActivity(avgHR, movingTimeSec, athlete);
      const aeEff = aerobicEfficiency(avgHR, distanceMeters, movingTimeSec);
      const drift = hrDriftPct(stream);

      await db.activity.create({
        data: {
          athleteId: athlete.id,
          source: "STRAVA",
          stravaId: `seed-${week}-${s}-${dayOffset}`,
          name: template.name,
          type: "Run",
          startTime,
          movingTimeSec,
          distanceMeters,
          avgHR,
          maxHR: avgHR + 15,
          avgPaceSecPerKm: Math.round(movingTimeSec / (distanceMeters / 1000)),
          streamData: stream,
          trainingLoad: load,
          aerobicEfficiency: aeEff,
          hrDriftPct: drift,
        },
      });
    }
  }

  // A handful of Garmin-style daily readiness rows for the last 2 weeks so
  // the recovery card has something to show pre-Garmin-connection.
  for (let d = 13; d >= 0; d--) {
    const date = new Date(now - d * dayMs);
    date.setHours(0, 0, 0, 0);
    await db.dailyMetric.upsert({
      where: { athleteId_date: { athleteId: athlete.id, date } },
      update: {},
      create: {
        athleteId: athlete.id,
        date,
        bodyBattery: 40 + Math.floor(Math.random() * 55),
        hrvStatus: ["BALANCED", "BALANCED", "UNBALANCED"][Math.floor(Math.random() * 3)],
        hrvMs: 45 + Math.floor(Math.random() * 30),
        restingHR: 46 + Math.floor(Math.random() * 6),
        sleepScore: 60 + Math.floor(Math.random() * 35),
        trainingReadiness: 30 + Math.floor(Math.random() * 65),
      },
    });
  }

  console.log(`Seeded athlete ${email} with training history.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
