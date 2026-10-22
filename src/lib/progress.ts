// Expected vs actual estimated 1RM across the Comeback Block. Pure calculations
// over the program definition and synced Hevy workouts.
//
// "Expected" is what the ORIGINAL (Oct 5) prescription implies if you only hit
// the minimum reps at the planned load: Epley(baseline load, 3 reps). Beating
// it means ahead of schedule. The baseline is frozen here on purpose: when the
// live plan in program.ts is revised after a session, the expectation must not
// move with it, or the page could never show over- or under-performance.
// Week 6 bench is a max test with no planned load, so its expected value
// carries forward from week 5.

import { PROGRAM_DAYS, PROGRAM_WEEKS, type DayKey } from "@/lib/program";
import { epley1RM, type HevyWorkoutRow } from "@/lib/hevyInsights";
import { kgToLb } from "@/lib/format";
import type { HevyExercise } from "@/lib/hevy";

type TrackedLift = { key: string; label: string; day: DayKey; exerciseName: string; baselineLb: (number | null)[] };

const BASELINE_REPS = 3;

export const TRACKED_LIFTS: TrackedLift[] = [
  { key: "bench", label: "Bench Press", day: "Fri", exerciseName: "Bench Press · heavy", baselineLb: [150, 155, 160, 165, 170, null] },
  { key: "squat", label: "Back Squat", day: "Mon", exerciseName: "Back Squat", baselineLb: [160, 175, 185, 190, 200, 205] },
  { key: "deadlift", label: "Deadlift", day: "Fri", exerciseName: "Deadlift (conventional)", baselineLb: [190, 200, 210, 220, 230, 240] },
  { key: "pullup", label: "Weighted Pull-up (added load)", day: "Sun", exerciseName: "Weighted Pull-up", baselineLb: [25, 30, 35, 40, 45, 50] },
];

export type ProgressRow = {
  week: number;
  /** Current (possibly revised) load from program.ts. */
  plannedLoadLb: number | null;
  plannedReps: number | null;
  /** Original Oct 5 load the expectation is based on. */
  baselineLb: number | null;
  expected1RM: number | null;
  actualTop: { weightLb: number; reps: number } | null;
  actual1RM: number | null;
  /** actual − expected, in lb; null until the session is logged. */
  delta: number | null;
};

export type LiftProgress = {
  key: string;
  label: string;
  rows: ProgressRow[];
  endExpected: number | null;
  latestActual: number | null;
  /** End-of-block estimate if the current gap to plan stays the same. */
  onPaceFor: number | null;
};

type WorkoutRow = HevyWorkoutRow & { title: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

function sessionTopSet(
  workouts: WorkoutRow[],
  week: number,
  day: DayKey,
  hevyTitle: string
): { weightLb: number; reps: number; oneRm: number } | null {
  const prefix = `CB W${week} ${day}`;
  let best: { weightLb: number; reps: number; oneRm: number } | null = null;
  for (const w of workouts) {
    if (!w.title.startsWith(prefix)) continue;
    for (const ex of (w.exercises as HevyExercise[] | null) ?? []) {
      if (ex.title !== hevyTitle) continue;
      for (const s of ex.sets) {
        if (s.type === "warmup" || s.weight_kg == null || s.reps == null) continue;
        if (s.weight_kg <= 0 || s.reps > 10) continue;
        const oneRm = kgToLb(epley1RM(s.weight_kg, s.reps));
        if (!best || oneRm > best.oneRm) best = { weightLb: kgToLb(s.weight_kg), reps: s.reps, oneRm };
      }
    }
  }
  return best;
}

export function liftProgress(workouts: WorkoutRow[]): LiftProgress[] {
  return TRACKED_LIFTS.map((lift) => {
    const day = PROGRAM_DAYS.find((d) => d.key === lift.day)!;
    const ex = day.exercises.find((e) => e.name === lift.exerciseName)!;
    let carried: number | null = null;
    const rows: ProgressRow[] = [];
    for (let week = 1; week <= PROGRAM_WEEKS; week++) {
      const rx = ex.rx(week);
      const base = lift.baselineLb[week - 1];
      const planned = base != null ? epley1RM(base, BASELINE_REPS) : null;
      const expected = planned ?? carried;
      if (planned != null) carried = planned;
      const top = sessionTopSet(workouts, week, lift.day, ex.hevyTitle);
      rows.push({
        week,
        plannedLoadLb: rx.weightLb,
        plannedReps: rx.reps ?? null,
        baselineLb: base,
        expected1RM: expected == null ? null : round2(expected),
        actualTop: top ? { weightLb: round2(top.weightLb), reps: top.reps } : null,
        actual1RM: top ? round2(top.oneRm) : null,
        delta: top && expected != null ? round2(top.oneRm - expected) : null,
      });
    }
    const logged = rows.filter((r) => r.actual1RM != null);
    const last = logged[logged.length - 1];
    const endExpected = rows[rows.length - 1].expected1RM;
    return {
      key: lift.key,
      label: lift.label,
      rows,
      endExpected,
      latestActual: last?.actual1RM ?? null,
      onPaceFor: last?.delta != null && endExpected != null ? round2(endExpected + last.delta) : null,
    };
  });
}
