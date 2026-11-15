// Expected vs actual estimated 1RM across the current block (Regressive
// Underload). Pure calculations over the program definition and synced Hevy
// workouts.
//
// "Expected" is what the ORIGINAL (Nov 15) prescription implies if you only hit
// the minimum reps at the planned load: Epley(baseline load, baseline reps).
// Beating it means ahead of schedule. The baseline is frozen here on purpose:
// when the live plan in program.ts is revised after a session, the expectation
// must not move with it, or the page could never show over- or
// under-performance. Week 6 is a deload (baseline null): it is shown but not
// compared, and it does not move the end-of-block pace.

import { PROGRAM_DAYS, PROGRAM_WEEKS, ROUTINE_PREFIX, type DayKey } from "@/lib/program";
import { epley1RM, type HevyWorkoutRow } from "@/lib/hevyInsights";
import { kgToLb } from "@/lib/format";
import type { HevyExercise } from "@/lib/hevy";

type TrackedLift = {
  key: string;
  label: string;
  day: DayKey;
  exerciseName: string;
  /** Reps per set the baseline load was prescribed for. */
  baselineReps: number;
  /** Planned load per week as of Nov 15; null = not compared (deload). */
  baselineLb: (number | null)[];
};

export const TRACKED_LIFTS: TrackedLift[] = [
  { key: "bench", label: "Bench Press", day: "Fri", exerciseName: "Bench Press · heavy", baselineReps: 5, baselineLb: [175, 180, 185, 185, 190, null] },
  { key: "squat", label: "Back Squat", day: "Wed", exerciseName: "Back Squat", baselineReps: 5, baselineLb: [200, 205, 210, 215, 220, null] },
  { key: "deadlift", label: "Deadlift", day: "Fri", exerciseName: "Deadlift · heavy", baselineReps: 3, baselineLb: [255, 265, 270, 275, 280, null] },
  { key: "pullup", label: "Weighted Pull-up (added load)", day: "Sun", exerciseName: "Weighted Pull-up", baselineReps: 3, baselineLb: [65, 70, 75, 75, 80, null] },
];

export type ProgressRow = {
  week: number;
  /** Current (possibly revised) load from program.ts. */
  plannedLoadLb: number | null;
  plannedReps: number | null;
  /** Rep target as written, e.g. "5+" or "5". */
  plannedRepsLabel: string | null;
  /** Reps the frozen baseline load was prescribed for. */
  baselineReps: number;
  /** Original Nov 15 load the expectation is based on. */
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
  const prefix = `${ROUTINE_PREFIX} W${week} ${day}`;
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
    const rows: ProgressRow[] = [];
    for (let week = 1; week <= PROGRAM_WEEKS; week++) {
      const rx = ex.rx(week);
      const base = lift.baselineLb[week - 1];
      const expected = base != null ? epley1RM(base, lift.baselineReps) : null;
      const top = sessionTopSet(workouts, week, lift.day, ex.hevyTitle);
      rows.push({
        week,
        plannedLoadLb: rx.weightLb,
        plannedReps: rx.reps ?? null,
        plannedRepsLabel: rx.repsLabel ?? (rx.reps != null ? String(rx.reps) : null),
        baselineReps: lift.baselineReps,
        baselineLb: base,
        expected1RM: expected == null ? null : round2(expected),
        actualTop: top ? { weightLb: round2(top.weightLb), reps: top.reps } : null,
        actual1RM: top ? round2(top.oneRm) : null,
        delta: top && expected != null ? round2(top.oneRm - expected) : null,
      });
    }
    // Pace comes from the latest compared week; the deload is shown but never moves it.
    const compared = rows.filter((r) => r.delta != null);
    const last = compared[compared.length - 1];
    const endExpected = [...rows].reverse().find((r) => r.expected1RM != null)?.expected1RM ?? null;
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
