// Pure, side-effect-free calculations over synced Hevy data. Nothing here
// talks to the network or the database — same split as src/lib/insights.ts
// for the cardio side: sync jobs pull the numbers, this file turns them
// into answers.

import type { HevyExercise } from "@/lib/hevy";

export type HevyWorkoutRow = {
  startTime: Date;
  endTime: Date | null;
  exercises: unknown; // HevyExercise[] as stored in the JSON column
};

export type HevyTemplateRow = {
  hevyExerciseTemplateId: string;
  title: string;
  type: string | null;
  primaryMuscleGroup: string | null;
};

function exercisesOf(workout: HevyWorkoutRow): HevyExercise[] {
  return (workout.exercises as HevyExercise[] | null) ?? [];
}

/** Epley estimated 1-rep max: weight x (1 + reps / 30). */
export function epley1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

type WorkingSet = { date: Date; weightKg: number; reps: number };

/** Every non-warmup set of one exercise across all workouts, with a real weight and rep count. */
function workingSetsFor(workouts: HevyWorkoutRow[], exerciseTemplateId: string): WorkingSet[] {
  const sets: WorkingSet[] = [];
  for (const w of workouts) {
    for (const ex of exercisesOf(w)) {
      if (ex.exercise_template_id !== exerciseTemplateId) continue;
      for (const s of ex.sets) {
        if (s.type === "warmup") continue;
        if (s.weight_kg == null || s.reps == null) continue;
        sets.push({ date: w.startTime, weightKg: s.weight_kg, reps: s.reps });
      }
    }
  }
  return sets;
}

export type TopLift = { exerciseTemplateId: string; title: string; totalSets: number };

/**
 * Top N lifts by total working-weight sets logged, restricted to
 * `weight_reps`-type exercises — bodyweight/reps-only movements (pull-ups,
 * planks) have no weight_kg to base a 1RM/PR/photo-hero card on.
 */
export function topLifts(
  workouts: HevyWorkoutRow[],
  templates: HevyTemplateRow[],
  n = 6
): TopLift[] {
  const weightRepsIds = new Set(
    templates.filter((t) => t.type === "weight_reps").map((t) => t.hevyExerciseTemplateId)
  );
  const counts = new Map<string, { title: string; totalSets: number }>();

  for (const w of workouts) {
    for (const ex of exercisesOf(w)) {
      if (!weightRepsIds.has(ex.exercise_template_id)) continue;
      const nonWarmup = ex.sets.filter((s) => s.type !== "warmup").length;
      if (nonWarmup === 0) continue;
      const existing = counts.get(ex.exercise_template_id);
      counts.set(ex.exercise_template_id, {
        title: ex.title,
        totalSets: (existing?.totalSets ?? 0) + nonWarmup,
      });
    }
  }

  return Array.from(counts.entries())
    .map(([exerciseTemplateId, v]) => ({ exerciseTemplateId, ...v }))
    .sort((a, b) => b.totalSets - a.totalSets)
    .slice(0, n);
}

export type OneRmPoint = { date: Date; oneRm: number };

/**
 * Estimated-1RM trend for one exercise: per workout, the best Epley 1RM
 * among sets of 10 reps or fewer (heavier singles/doubles/triples estimate
 * a max far more reliably than a set of 20).
 */
export function oneRepMaxSeries(workouts: HevyWorkoutRow[], exerciseTemplateId: string): OneRmPoint[] {
  const points: OneRmPoint[] = [];
  for (const w of workouts) {
    let best: number | null = null;
    for (const ex of exercisesOf(w)) {
      if (ex.exercise_template_id !== exerciseTemplateId) continue;
      for (const s of ex.sets) {
        if (s.type === "warmup" || s.weight_kg == null || s.reps == null || s.reps > 10) continue;
        const est = epley1RM(s.weight_kg, s.reps);
        if (best == null || est > best) best = est;
      }
    }
    if (best != null) points.push({ date: w.startTime, oneRm: best });
  }
  return points.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type PersonalRecord = {
  exerciseTemplateId: string;
  title: string;
  heaviestSet: { weightKg: number; reps: number; date: Date } | null;
  bestOneRm: { oneRm: number; date: Date } | null;
};

export function personalRecord(
  workouts: HevyWorkoutRow[],
  exerciseTemplateId: string,
  title: string
): PersonalRecord {
  const sets = workingSetsFor(workouts, exerciseTemplateId);
  let heaviestSet: PersonalRecord["heaviestSet"] = null;
  for (const s of sets) {
    if (!heaviestSet || s.weightKg > heaviestSet.weightKg) {
      heaviestSet = { weightKg: s.weightKg, reps: s.reps, date: s.date };
    }
  }

  const series = oneRepMaxSeries(workouts, exerciseTemplateId);
  let bestOneRm: PersonalRecord["bestOneRm"] = null;
  for (const p of series) {
    if (!bestOneRm || p.oneRm > bestOneRm.oneRm) bestOneRm = { oneRm: p.oneRm, date: p.date };
  }

  return { exerciseTemplateId, title, heaviestSet, bestOneRm };
}

export type HeaviestLiftEver = {
  exerciseTemplateId: string;
  title: string;
  weightKg: number;
  reps: number;
  date: Date;
};

/** The single heaviest weight_reps set ever logged, across the whole account — for a hero stat. */
export function heaviestLiftEver(
  workouts: HevyWorkoutRow[],
  templates: HevyTemplateRow[]
): HeaviestLiftEver | null {
  const weightRepsIds = new Set(
    templates.filter((t) => t.type === "weight_reps").map((t) => t.hevyExerciseTemplateId)
  );
  let best: HeaviestLiftEver | null = null;
  for (const w of workouts) {
    for (const ex of exercisesOf(w)) {
      if (!weightRepsIds.has(ex.exercise_template_id)) continue;
      for (const s of ex.sets) {
        if (s.type === "warmup" || s.weight_kg == null || s.reps == null) continue;
        if (!best || s.weight_kg > best.weightKg) {
          best = {
            exerciseTemplateId: ex.exercise_template_id,
            title: ex.title,
            weightKg: s.weight_kg,
            reps: s.reps,
            date: w.startTime,
          };
        }
      }
    }
  }
  return best;
}

export type LiftStatTiles = {
  totalWorkouts: number;
  workoutsThisYear: number;
  workoutsLast30Days: number;
  totalHours: number;
  totalVolumeKg: number;
};

export function liftStatTiles(workouts: HevyWorkoutRow[]): LiftStatTiles {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let totalHoursMs = 0;
  let totalVolumeKg = 0;
  let workoutsThisYear = 0;
  let workoutsLast30Days = 0;

  for (const w of workouts) {
    if (w.startTime.getFullYear() === thisYear) workoutsThisYear++;
    if (w.startTime >= thirtyDaysAgo) workoutsLast30Days++;
    if (w.endTime) totalHoursMs += w.endTime.getTime() - w.startTime.getTime();

    for (const ex of exercisesOf(w)) {
      for (const s of ex.sets) {
        if (s.type === "warmup" || s.weight_kg == null || s.reps == null) continue;
        totalVolumeKg += s.weight_kg * s.reps;
      }
    }
  }

  return {
    totalWorkouts: workouts.length,
    workoutsThisYear,
    workoutsLast30Days,
    totalHours: Math.round((totalHoursMs / 3_600_000) * 10) / 10,
    totalVolumeKg: Math.round(totalVolumeKg),
  };
}

export type HeatmapDay = { date: string; minutes: number };

/**
 * One entry per day for the last `weeks` weeks (oldest first, week-aligned
 * to Sunday so a grid renders cleanly), shaded later by minutes trained
 * (sum of workout durations that day).
 */
export function consistencyHeatmap(workouts: HevyWorkoutRow[], weeks = 52): HeatmapDay[] {
  const minutesByDate = new Map<string, number>();
  for (const w of workouts) {
    if (!w.endTime) continue;
    const key = w.startTime.toISOString().slice(0, 10);
    const minutes = Math.max(0, (w.endTime.getTime() - w.startTime.getTime()) / 60000);
    minutesByDate.set(key, (minutesByDate.get(key) ?? 0) + minutes);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDow = today.getDay(); // 0 = Sunday
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - todayDow)); // round out to end of this week (Saturday)
  const start = new Date(end);
  start.setDate(start.getDate() - weeks * 7 + 1);

  const days: HeatmapDay[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, minutes: Math.round(minutesByDate.get(key) ?? 0) });
  }
  return days;
}

export type MuscleGroupSets = { muscleGroup: string; sets: number };

/** Working sets per `primary_muscle_group` over the trailing `weeksBack` weeks. */
export function muscleBalance(
  workouts: HevyWorkoutRow[],
  templates: HevyTemplateRow[],
  weeksBack = 8
): MuscleGroupSets[] {
  const muscleByTemplateId = new Map(
    templates.map((t) => [t.hevyExerciseTemplateId, t.primaryMuscleGroup ?? "Other"])
  );
  const since = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000);
  const counts = new Map<string, number>();

  for (const w of workouts) {
    if (w.startTime < since) continue;
    for (const ex of exercisesOf(w)) {
      const nonWarmup = ex.sets.filter((s) => s.type !== "warmup").length;
      if (nonWarmup === 0) continue;
      const group = muscleByTemplateId.get(ex.exercise_template_id) ?? "Other";
      counts.set(group, (counts.get(group) ?? 0) + nonWarmup);
    }
  }

  return Array.from(counts.entries())
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
    .sort((a, b) => b.sets - a.sets);
}
