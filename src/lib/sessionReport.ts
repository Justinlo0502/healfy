// Planned-vs-done analysis for Comeback Block sessions. One algorithm, two
// readers: scripts/healfy-update.ts (the `update:` workflow) and the program
// page, which renders it under each logged session. The plan is the Hevy
// routine as it stood on the day (the push script never rewrites past
// sessions), so past results stay honest after program.ts is revised.
import type { HevyExercise, HevySet } from "@/lib/hevy";
import { epley1RM } from "@/lib/hevyInsights";
import { kgToLb } from "@/lib/format";
import { sessionKey, sessionOf, type SessionRef } from "@/lib/sessions";
import { PROGRAM_DAYS, dayDate, exercisesFor, type DayKey, type ProgramExercise } from "@/lib/program";

const LB_TO_KG = 0.45359237;
const r1 = (n: number) => Math.round(n * 10) / 10;
export const lbOf = (kg: number | null) => (kg == null ? 0 : r1(kgToLb(kg)));

export type LoggedSet = { lb: number; reps: number };

export type ExerciseResult = {
  name: string;
  tier: string;
  planned: string; // e.g. "5 × 3+ @ 205 lb"
  plannedSets: number;
  plannedReps: number;
  plannedLb: number | null;
  /** Working sets in the order logged. */
  sets: LoggedSet[];
  status: "hit" | "exceeded" | "short" | "not-done";
  /** Reps on the final working set when the prescription is an AMRAP ("3+"). */
  amrapReps: number | null;
  topE1RM: number | null;
  notes: string | null;
};

export type Substitution = { dropped: string; added: string; muscle: string | null };

export type SessionReport = {
  key: string;
  week: number;
  day: DayKey;
  date: string;
  title: string;
  minutes: number | null;
  results: ExerciseResult[];
  /** Planned moves with no working sets logged. */
  dropped: string[];
  /** Logged moves that are not in the plan. */
  added: { name: string; sets: LoggedSet[]; muscle: string | null; notes: string | null }[];
  substitutions: Substitution[];
  /** Logged moves that are neither planned nor a same-muscle swap for a dropped move. */
  extras: string[];
};

export function isAmrap(ex: ProgramExercise | undefined, week: number): boolean {
  return ex?.rx(week).repsLabel?.endsWith("+") === true;
}

export const setValue = (s: HevySet) => s.reps ?? s.duration_seconds ?? s.distance_meters ?? 0;
export const workingSets = (e: HevyExercise | undefined) =>
  (e?.sets ?? []).filter(
    (s) => s.type !== "warmup" && (s.reps != null || s.duration_seconds != null || s.distance_meters != null)
  );

/**
 * Grades one exercise against what the session's routine prescribed. The routine
 * row in the database is frozen once the session date passes (the push script
 * never updates past sessions), so it is the plan as it stood on the day, even
 * if program.ts has been revised since.
 */
export function analyse(
  name: string,
  ex: ProgramExercise | undefined,
  week: number,
  planned: HevyExercise | undefined,
  logged: HevyExercise | undefined
): ExerciseResult {
  const plan = workingSets(planned);
  const plannedReps = plan.length ? Math.min(...plan.map(setValue)) : 0;
  const plannedLb = plan.length && plan[0].weight_kg != null ? lbOf(plan[0].weight_kg) : null;
  const sets: LoggedSet[] = workingSets(logged).map((s) => ({ lb: lbOf(s.weight_kg), reps: setValue(s) }));

  let status: ExerciseResult["status"] = "not-done";
  if (sets.length > 0) {
    const enough = sets.length >= plan.length;
    const repsOk = sets.every((s) => s.reps >= plannedReps);
    const loadOk = plannedLb == null || sets.every((s) => s.lb >= plannedLb - 0.5);
    const heavier = plannedLb != null && sets.some((s) => s.lb > plannedLb + 0.5);
    status = !enough || !repsOk || !loadOk ? "short" : heavier ? "exceeded" : "hit";
  }

  const lifted = sets.filter((s) => s.lb > 0 && s.reps > 0 && s.reps <= 10);
  const topE1RM = lifted.length ? r1(Math.max(...lifted.map((s) => lbOf(epley1RM(s.lb * LB_TO_KG, s.reps))))) : null;

  return {
    name,
    tier: ex?.tier ?? "T3",
    planned: `${plan.length} × ${plannedReps}${isAmrap(ex, week) ? "+" : ""}${plannedLb != null ? ` @ ${plannedLb} lb` : ""}`,
    plannedSets: plan.length,
    plannedReps,
    plannedLb,
    sets,
    status,
    amrapReps: isAmrap(ex, week) && sets.length ? sets[sets.length - 1].reps : null,
    topE1RM,
    notes: logged?.notes?.trim() || null,
  };
}

export type SessionInputs = {
  workouts: { title: string; startTime: Date; endTime: Date | null; exercises: unknown }[];
  routines: { title: string; exercises: unknown }[];
  templates: { title: string; primaryMuscleGroup: string | null }[];
};

/** One report per Comeback Block session that has a logged workout (the latest workout wins), oldest first. */
export function buildSessionReports({ workouts: allWorkouts, routines: routineRows, templates }: SessionInputs): Map<string, SessionReport> {
  const muscleOf = new Map(templates.map((t) => [t.title, t.primaryMuscleGroup]));
  const routines = new Map(routineRows.map((r) => [r.title, r]));
  const workouts = [...allWorkouts].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const bySession = new Map<string, { ref: SessionRef; workout: (typeof workouts)[number] }>();
  for (const w of workouts) {
    const ref = sessionOf(w.title, w.startTime);
    if (ref) bySession.set(sessionKey(ref.week, ref.day), { ref, workout: w });
  }

  const reports: SessionReport[] = [];
  for (const [key, { ref, workout }] of bySession) {
    const day = PROGRAM_DAYS.find((d) => d.key === ref.day)!;
    const routine = routines.get(workout.title);
    const logged = (workout.exercises as HevyExercise[] | null) ?? [];
    const loggedByTitle = new Map(logged.map((e) => [e.title, e]));
    // The plan as it stood on the day: the frozen routine, else today's program.
    const plannedEx: HevyExercise[] = routine
      ? (routine.exercises as HevyExercise[])
      : exercisesFor(day, ref.week).map(
          (e) =>
            ({
              title: e.hevyTitle,
              sets: [{ type: "normal", reps: e.rx(ref.week).reps ?? null, weight_kg: e.rx(ref.week).weightLb }],
            }) as unknown as HevyExercise
        );
    // Warm-up moves (some early routines stored them as normal sets) are not part of the analysis.
    const warmupTitles = new Set(day.warmup.flatMap((w) => [w.hevyTitle, ...(w.primer ?? []).map((p) => p.hevyTitle)]));
    for (const e of day.exercises) for (const p of e.primer ?? []) warmupTitles.add(p.hevyTitle);
    const withWork = plannedEx.filter((e) => workingSets(e).length > 0 && !warmupTitles.has(e.title));
    // Program entry for tier/AMRAP info, matched by Hevy title within the day (moves since removed have none).
    const programFor = (title: string) => day.exercises.find((e) => e.hevyTitle === title);
    const nameOf = (title: string) => programFor(title)?.name ?? title;

    const results = withWork.map((p) =>
      analyse(nameOf(p.title), programFor(p.title), ref.week, p, loggedByTitle.get(p.title))
    );
    const plannedTitles = new Set(plannedEx.map((e) => e.title));
    const droppedTitles = withWork.filter((p) => !workingSets(loggedByTitle.get(p.title)).length).map((p) => p.title);
    const added = logged
      .filter((e) => !plannedTitles.has(e.title) && !warmupTitles.has(e.title) && workingSets(e).length > 0)
      .map((e) => ({
        name: e.title,
        sets: workingSets(e).map((s) => ({ lb: lbOf(s.weight_kg), reps: setValue(s) })),
        muscle: muscleOf.get(e.title) ?? null,
        notes: e.notes?.trim() || null,
      }));

    // Pair each dropped move with an added one that trains the same primary muscle group.
    const substitutions: Substitution[] = [];
    const pool = [...added];
    for (const title of droppedTitles) {
      const muscle = muscleOf.get(title) ?? null;
      const i = pool.findIndex((a) => muscle != null && a.muscle === muscle);
      if (i >= 0) substitutions.push({ dropped: nameOf(title), added: pool.splice(i, 1)[0].name, muscle });
    }

    const minutes =
      workout.endTime != null ? Math.round((workout.endTime.getTime() - workout.startTime.getTime()) / 60000) : null;
    reports.push({
      key,
      week: ref.week,
      day: ref.day,
      date: dayDate(ref.week, day),
      title: workout.title,
      minutes,
      results,
      dropped: droppedTitles.map(nameOf),
      added,
      substitutions,
      extras: pool.map((a) => a.name),
    });
  }
  return new Map([...reports].sort((a, b) => a.date.localeCompare(b.date)).map((r) => [r.key, r]));
}
