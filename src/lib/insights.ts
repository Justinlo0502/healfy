// Pure, side-effect-free training-science calculations. Nothing in this
// file talks to the network or the database — it takes the numbers a sync
// job already pulled down and turns them into answers.

export type StreamData = {
  time: number[]; // seconds from activity start
  heartrate?: number[]; // bpm, same length as time
  velocity?: number[]; // m/s, same length as time
  distance?: number[]; // meters, cumulative, same length as time
  elevation?: number[]; // meters above sea level, same length as time
  latitude?: (number | null)[]; // degrees, null where no GPS fix, same length as time
  longitude?: (number | null)[]; // degrees, null where no GPS fix, same length as time
};

export type HrZone = { zone: 1 | 2 | 3 | 4 | 5; label: string; lowBpm: number; highBpm: number };

// HR-zone training is a running/cycling-style framework built around
// sustained, self-driven cardio effort. It doesn't mean much for activities
// where heart rate isn't primarily a function of your own exertion (e.g.
// steering a boat) — showing a zone breakdown there is just noise, not signal.
const ZONE_RELEVANT_TYPES = new Set(["Run", "Trail Run", "Treadmill Run", "Ride", "Swim"]);

export function isZoneRelevantType(type: string): boolean {
  return ZONE_RELEVANT_TYPES.has(type);
}

/**
 * LTHR-based 5-zone model (Friel-style), the standard used by most running
 * watches once you've set a lactate threshold HR — more accurate than
 * age-based max-HR guessing.
 */
export function hrZoneBoundaries(lthr: number): HrZone[] {
  return [
    { zone: 1, label: "Recovery", lowBpm: 0, highBpm: Math.round(lthr * 0.85) },
    { zone: 2, label: "Aerobic", lowBpm: Math.round(lthr * 0.85) + 1, highBpm: Math.round(lthr * 0.89) },
    { zone: 3, label: "Tempo", lowBpm: Math.round(lthr * 0.89) + 1, highBpm: Math.round(lthr * 0.94) },
    { zone: 4, label: "Threshold", lowBpm: Math.round(lthr * 0.94) + 1, highBpm: Math.round(lthr * 0.99) },
    { zone: 5, label: "Anaerobic", lowBpm: Math.round(lthr * 0.99) + 1, highBpm: 999 },
  ];
}

export function zoneForHr(hr: number, lthr: number): 1 | 2 | 3 | 4 | 5 {
  const zones = hrZoneBoundaries(lthr);
  const match = zones.find((z) => hr >= z.lowBpm && hr <= z.highBpm);
  return (match?.zone ?? 1) as 1 | 2 | 3 | 4 | 5;
}

/** Seconds spent in each of the 5 zones over one activity. */
export function timeInHrZones(stream: StreamData, lthr: number): Record<1 | 2 | 3 | 4 | 5, number> {
  const totals: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const { time, heartrate } = stream;
  if (!heartrate || heartrate.length < 2) return totals;
  for (let i = 1; i < time.length; i++) {
    const dt = time[i] - time[i - 1];
    if (dt <= 0) continue;
    const zone = zoneForHr(heartrate[i], lthr);
    totals[zone] += dt;
  }
  return totals;
}

/**
 * Banister-style TRIMP: duration-weighted, exponentially scaled by relative
 * HR intensity. Falls back to a simpler duration * relative-intensity score
 * when resting HR isn't known.
 */
export function trainingLoadForActivity(
  avgHR: number,
  movingTimeSec: number,
  athlete: { maxHR?: number | null; restingHR?: number | null }
): number {
  const durationMin = movingTimeSec / 60;
  if (athlete.maxHR && athlete.restingHR && athlete.maxHR > athlete.restingHR) {
    const hrReserveFrac = Math.max(0, Math.min(1, (avgHR - athlete.restingHR) / (athlete.maxHR - athlete.restingHR)));
    // Male-typical exponential weighting factor (0.64 * e^(1.92x)); the
    // constant differs slightly by sex but the shape — and its use as a
    // *relative*, self-compared trend line — is what matters here.
    const weight = 0.64 * Math.exp(1.92 * hrReserveFrac);
    return Math.round(durationMin * hrReserveFrac * weight);
  }
  // No max/resting HR on file yet: fall back to plain duration-minutes as
  // a rough load proxy so ACWR still has something to work with.
  return Math.round(durationMin);
}

export type AcwrStatus = "low" | "optimal" | "high" | "danger";

export type AcwrResult = {
  acute7dAvg: number;
  chronic28dAvg: number;
  ratio: number | null;
  status: AcwrStatus;
};

/**
 * Acute:chronic workload ratio — 7-day average load vs. 28-day average
 * load, as of `asOf`. Below ~0.8 you're detraining; 0.8–1.3 is the
 * generally-cited sweet spot; above ~1.5 is the range associated with
 * elevated injury risk in the sports-science literature this metric comes
 * from.
 */
export function acwr(
  loads: { date: Date; trainingLoad: number }[],
  asOf: Date = new Date()
): AcwrResult {
  const dayMs = 24 * 60 * 60 * 1000;
  const since = (days: number) => asOf.getTime() - days * dayMs;

  const sum = (days: number) =>
    loads.filter((l) => l.date.getTime() > since(days) && l.date.getTime() <= asOf.getTime()).reduce((s, l) => s + l.trainingLoad, 0);

  const acute7dAvg = sum(7) / 7;
  const chronic28dAvg = sum(28) / 28;
  const ratio = chronic28dAvg > 0 ? acute7dAvg / chronic28dAvg : null;

  let status: AcwrStatus = "optimal";
  if (ratio === null) status = "optimal";
  else if (ratio < 0.8) status = "low";
  else if (ratio <= 1.3) status = "optimal";
  else if (ratio <= 1.5) status = "high";
  else status = "danger";

  return { acute7dAvg, chronic28dAvg, ratio, status };
}

/** True if this run's average HR sits in easy/aerobic territory (zones 1-2). */
export function isEasyEffort(avgHR: number, lthr: number): boolean {
  return zoneForHr(avgHR, lthr) <= 2;
}

/**
 * Meters covered per beat-minute of heart rate — a simple, comparable
 * aerobic-efficiency number. Tracked over weeks on easy runs only (apples
 * to apples), a rising trend is the cleanest available signal that the
 * aerobic engine is improving independent of how hard any single run felt.
 */
export function aerobicEfficiency(avgHR: number, distanceMeters: number, movingTimeSec: number): number {
  const minutes = movingTimeSec / 60;
  if (avgHR <= 0 || minutes <= 0) return 0;
  return Math.round((distanceMeters / (avgHR * minutes)) * 100) / 100;
}

/**
 * Aerobic decoupling (Pw:Hr / speed:HR drift): compares the speed-per-
 * heartbeat ratio in the first half of a run against the second half.
 * A positive percentage means you needed more heartbeats to hold the same
 * speed late in the run — a fatigue, heat, or hydration signal.
 */
export function hrDriftPct(stream: StreamData): number | null {
  const { time, heartrate, velocity } = stream;
  if (!heartrate || !velocity || time.length < 10) return null;

  const midIdx = Math.floor(time.length / 2);
  const avg = (arr: number[], from: number, to: number) => {
    const slice = arr.slice(from, to).filter((v) => v > 0);
    return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : 0;
  };

  const firstHr = avg(heartrate, 0, midIdx);
  const firstV = avg(velocity, 0, midIdx);
  const secondHr = avg(heartrate, midIdx, time.length);
  const secondV = avg(velocity, midIdx, time.length);

  if (firstHr <= 0 || firstV <= 0 || secondHr <= 0) return null;

  const firstRatio = firstV / firstHr;
  const secondRatio = secondV / secondHr;
  if (firstRatio <= 0) return null;

  const drift = ((firstRatio - secondRatio) / firstRatio) * 100;
  return Math.round(drift * 10) / 10;
}

/** Downsample parallel time-series arrays to at most `maxPoints` samples. */
export function downsampleStream(stream: StreamData, maxPoints = 500): StreamData {
  const len = stream.time.length;
  if (len <= maxPoints) return stream;
  const stride = Math.ceil(len / maxPoints);
  const pick = (arr?: number[]) => (arr ? arr.filter((_, i) => i % stride === 0) : undefined);
  const pickNullable = (arr?: (number | null)[]) =>
    arr ? arr.filter((_, i) => i % stride === 0) : undefined;
  return {
    time: stream.time.filter((_, i) => i % stride === 0),
    heartrate: pick(stream.heartrate),
    velocity: pick(stream.velocity),
    distance: pick(stream.distance),
    elevation: pick(stream.elevation),
    latitude: pickNullable(stream.latitude),
    longitude: pickNullable(stream.longitude),
  };
}

/**
 * Grade-adjusted pace: converts uphill/downhill effort into "flat-equivalent"
 * pace using Minetti et al.'s (2002) polynomial energy-cost-of-running-on-
 * gradient curve (the same family of model Strava/Stryd use for GAP). Each
 * segment's actual distance is scaled by how much more (or less) costly that
 * gradient is versus flat ground; the whole adjusted distance is then
 * divided by total moving time.
 */
export function gradeAdjustedPaceSecPerKm(stream: StreamData): number | null {
  const { time, distance, elevation } = stream;
  if (!distance || !elevation || time.length < 2) return null;

  const costOfRunning = (gradeFraction: number): number => {
    const i = Math.max(-0.45, Math.min(0.45, gradeFraction));
    return 155.4 * i ** 5 - 30.4 * i ** 4 - 43.3 * i ** 3 + 46.3 * i ** 2 + 19.5 * i + 3.6;
  };
  const flatCost = costOfRunning(0);

  let adjustedDistance = 0;
  let totalTime = 0;

  for (let idx = 1; idx < time.length; idx++) {
    const dt = time[idx] - time[idx - 1];
    const dd = distance[idx] - distance[idx - 1];
    if (dt <= 0 || dd <= 0) continue;
    const de = elevation[idx] - elevation[idx - 1];
    const grade = de / dd;
    const multiplier = costOfRunning(grade) / flatCost;
    adjustedDistance += dd * multiplier;
    totalTime += dt;
  }

  if (adjustedDistance <= 0 || totalTime <= 0) return null;
  return Math.round((totalTime / (adjustedDistance / 1000)) * 10) / 10;
}
