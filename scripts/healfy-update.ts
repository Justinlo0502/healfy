// Analysis half of the `update:` workflow (.claude/skills/healfy-update).
// Syncs Hevy, then prints a report of what was actually done in each logged
// Comeback Block session versus what that session's routine prescribed:
//   1. per-session results (sets vs prescription, AMRAPs, e1RM, your notes)
//   2. substitutions (planned moves dropped, unplanned moves added)
//   3. proposed loads for the next session of each day, from the program's
//      progression rules (the algorithm lives in proposeNext below)
//   4. expected-vs-actual 1RM and PR outlook (src/lib/progress.ts)
// It changes nothing: the skill applies edits to program.ts, programLog.ts and
// briefings.ts after reading this.
//
//   npx tsx scripts/healfy-update.ts            # sync, then report unbriefed sessions
//   npx tsx scripts/healfy-update.ts --no-sync  # skip the Hevy sync
//   npx tsx scripts/healfy-update.ts --all      # report every logged session, not just unbriefed ones
//   npx tsx scripts/healfy-update.ts --json     # machine-readable
import "dotenv/config";
import { db } from "../src/lib/db";
import { syncHevyForAthlete } from "../src/lib/hevy";
import { epley1RM } from "../src/lib/hevyInsights";
import { kgToLb } from "../src/lib/format";
import { liftProgress, TRACKED_LIFTS } from "../src/lib/progress";
import { BRIEFINGS } from "../src/lib/briefings";
import { sessionKey } from "../src/lib/sessions";
import {
  buildSessionReports,
  isAmrap,
  type ExerciseResult,
  type LoggedSet,
} from "../src/lib/sessionReport";
import {
  PROGRAM_DAYS,
  PROGRAM_START,
  PROGRAM_WEEKS,
  dayDate,
  exercisesFor,
  type DayKey,
  type ProgramExercise,
} from "../src/lib/program";

const args = new Set(process.argv.slice(2));
const AS_JSON = args.has("--json");
const ALL = args.has("--all");

const NL = String.fromCharCode(10);
const r1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Proposal = {
  day: DayKey;
  exercise: string;
  basedOn: string; // session key
  forWeek: number;
  currentPlanLb: number | null;
  proposedLb: number | null;
  action: "on-plan" | "advance" | "rebase-up" | "lower" | "repeat" | "no-data";
  rule: string;
  reason: string;
};

// ---------------------------------------------------------------------------
// Session analysis
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Progression rules (the "algorithm")
// ---------------------------------------------------------------------------
// Taken from the Rules panel on /dashboard/program and the program log:
//  - T1 5×3+ (Mon squat, Fri deadlift, Sun pull-up, Fri bench heavy): every set
//    at 3+ reps → next load = load lifted + step (squat 5, deadlift 10, pull-up
//    5, bench 5). A miss on any set repeats the load. Bench heavy: an AMRAP of
//    6+ adds an extra 5 lb.
//  - Fixed-rep compounds (bench volume 4×8, paused bench 4×5, squat volume
//    3×10, Fri pull-up 3×10): every set at target reps → +5 lb; otherwise repeat.
//  - Accessories with a rep range: every set at the top of the range → the
//    smallest jump (2 lb under 40 lb, else 5). Otherwise stay at the load lifted.
// In every case the load lifted is the new base ("rebase"), because the log
// shows the athlete usually beats the plan and the ladder follows the lifter.
// Skipped sessions never advance the ladder.

const T1_STEP: Record<string, number> = {
  "Squat (Barbell)": 5,
  "Deadlift (Barbell)": 10,
  "Pull Up (Weighted)": 5,
  "Bench Press (Barbell)": 5,
};

function topOfRange(ex: ProgramExercise, week: number): number {
  const label = ex.rx(week).repsLabel;
  const m = label ? /(\d+)\s*(?:–|-)\s*(\d+)/.exec(label) : null;
  if (m) return Number(m[2]);
  const rx = ex.rx(week);
  return rx.reps ?? rx.seconds ?? rx.meters ?? 0;
}

/** Modal working load of a session's sets (the load the athlete actually trained at). */
function workingLoad(result: ExerciseResult): number {
  const counts = new Map<number, number>();
  for (const s of result.sets) counts.set(s.lb, (counts.get(s.lb) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

function proposeNext(
  ex: ProgramExercise,
  day: DayKey,
  fromWeek: number,
  forWeek: number,
  result: ExerciseResult,
  key: string
): Proposal {
  const base = { day, exercise: ex.name, basedOn: key, forWeek };
  const currentPlanLb = ex.rx(forWeek).weightLb;
  const keep = (reason: string): Proposal => ({
    ...base,
    currentPlanLb,
    proposedLb: currentPlanLb,
    action: "no-data",
    rule: "none",
    reason,
  });
  if (result.status === "not-done" || result.sets.length === 0) return keep("Not logged, so the plan stands.");
  if (result.plannedLb == null || currentPlanLb == null) return keep("No loaded prescription: judge by the logged sets.");

  const lifted = workingLoad(result);
  const allSets = result.sets.length >= result.plannedSets;
  const clean = allSets && result.sets.every((s) => s.reps >= result.plannedReps);
  const jump = lifted < 40 ? 2 : 5;
  let next: number;
  let rule: string;
  let reason: string;

  if (ex.tier === "T1" && isAmrap(ex, fromWeek)) {
    const step = T1_STEP[ex.hevyTitle] ?? 5;
    if (clean) {
      const bonus = ex.hevyTitle === "Bench Press (Barbell)" && (result.amrapReps ?? 0) >= 6 ? 5 : 0;
      next = lifted + step + bonus;
      rule = bonus ? "T1 AMRAP + bench 6+ bonus" : "T1 AMRAP";
      reason = `${result.sets.map((s) => `${s.lb}×${s.reps}`).join(", ")}: every set reached 3+${bonus ? `, AMRAP ${result.amrapReps} adds +5 lb` : ""}. ${lifted} + ${step}${bonus ? " + 5" : ""}.`;
    } else {
      next = lifted;
      rule = "T1 AMRAP miss";
      reason = "A set fell short of 3 reps (or a set is missing), so repeat the load.";
    }
  } else if (ex.tier === "T1" || ex.tier === "T2") {
    next = clean ? lifted + 5 : lifted;
    rule = clean ? "fixed-rep compound" : "fixed-rep compound miss";
    reason = clean
      ? `All ${result.plannedSets} sets hit ${result.plannedReps}+ at ${lifted} lb, so +5.`
      : `Not every set reached ${result.plannedReps}, so repeat ${lifted} lb.`;
  } else {
    const top = topOfRange(ex, fromWeek);
    const atTop = allSets && result.sets.every((s) => s.reps >= top);
    next = atTop ? lifted + jump : lifted;
    rule = "double progression";
    reason = atTop
      ? `Every set reached ${top} at ${lifted} lb, so +${jump}.`
      : `Sets ${result.sets.map((s) => s.reps).join(", ")} vs top of range ${top}: stay at ${lifted} lb and add reps.`;
  }

  const planned = currentPlanLb ?? next;
  const action: Proposal["action"] =
    next === planned
      ? clean
        ? "on-plan"
        : "repeat"
      : next > planned
        ? lifted > result.plannedLb + 0.5
          ? "rebase-up"
          : "advance"
        : "lower";
  return { ...base, currentPlanLb, proposedLb: next, action, rule, reason };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const athlete = await db.athlete.findFirst();
  if (!athlete) throw new Error("No athlete in the database");

  let syncNote = "sync skipped";
  if (!args.has("--no-sync")) {
    try {
      const res = await syncHevyForAthlete(athlete.id);
      syncNote = `synced Hevy: ${JSON.stringify(res)}`;
    } catch (err) {
      syncNote = `Hevy sync FAILED (${err instanceof Error ? err.message : err}); analysing what is already stored`;
    }
  }

  const [workouts, templates, routineRows] = await Promise.all([
    db.hevyWorkout.findMany({ where: { athleteId: athlete.id }, orderBy: { startTime: "asc" } }),
    db.hevyExerciseTemplate.findMany({ where: { athleteId: athlete.id } }),
    db.hevyRoutine.findMany({ where: { athleteId: athlete.id, title: { startsWith: "CB " } } }),
  ]);
  const templateTitles = new Set(templates.map((t) => t.title));

  const bySession = buildSessionReports({ workouts, routines: routineRows, templates });
  const reports = [...bySession.values()].map((r) => ({ ...r, briefed: r.key in BRIEFINGS }));
  const shown = ALL ? reports : reports.filter((r) => !r.briefed);

  // Past sessions with nothing logged.
  const today = new Date().toLocaleDateString("en-CA"); // local date, YYYY-MM-DD
  const missed: string[] = [];
  for (let week = 1; week <= PROGRAM_WEEKS; week++)
    for (const day of PROGRAM_DAYS) {
      const date = dayDate(week, day);
      if (date < today && !bySession.has(sessionKey(week, day.key))) missed.push(`W${week} ${day.key} (${date})`);
    }

  // Substitution history per day: repeated swaps are a preference, one-offs are noise.
  const swapTally = new Map<string, { day: DayKey; dropped: string; added: string; sessions: string[]; fullSets: boolean }>();
  for (const r of reports)
    for (const s of r.substitutions) {
      const id = `${r.day}|${s.dropped}|${s.added}`;
      const addedSets = r.added.find((a) => a.name === s.added)?.sets.length ?? 0;
      const t = swapTally.get(id) ?? { day: r.day, dropped: s.dropped, added: s.added, sessions: [], fullSets: true };
      t.sessions.push(r.key);
      if (addedSets < 2) t.fullSets = false;
      swapTally.set(id, t);
    }
  const swaps = [...swapTally.values()].map((t) => ({
    ...t,
    inLibrary: templateTitles.has(t.added),
    occurrences: t.sessions.length,
  }));

  // Proposals: per day, the most recent session's results feed the next session of that day that
  // is still to come (not logged and not in the past). Skipped sessions don't progress the ladder.
  const proposals: Proposal[] = [];
  const gaps: string[] = [];
  for (const day of PROGRAM_DAYS) {
    if (day.repeatsWeekly) continue;
    const last = reports.filter((r) => r.day === day.key).sort((a, b) => b.week - a.week)[0];
    if (!last) continue;
    for (const result of last.results) {
      const ex = day.exercises.find((e) => e.name === result.name);
      if (!ex) continue; // removed from the program since
      let forWeek = last.week + 1;
      while (
        forWeek <= PROGRAM_WEEKS &&
        (bySession.has(sessionKey(forWeek, day.key)) ||
          dayDate(forWeek, day) < today ||
          !exercisesFor(day, forWeek).some((e) => e.name === ex.name))
      )
        forWeek++;
      if (forWeek > PROGRAM_WEEKS) continue;
      const notProgrammed = Array.from({ length: forWeek - last.week - 1 }, (_, i) => last.week + 1 + i).filter(
        (w) => !exercisesFor(day, w).some((e) => e.name === ex.name)
      );
      if (notProgrammed.length)
        gaps.push(
          `${day.key} ${ex.name}: not programmed in week(s) ${notProgrammed.join(", ")}, so W${forWeek} follows W${last.week} directly`
        );
      proposals.push(proposeNext(ex, day.key, last.week, forWeek, result, last.key));
    }
  }

  // Expected vs actual, and PR outlook.
  const cbWorkouts = workouts.filter((w) => w.title.startsWith("CB W"));
  const progress = liftProgress(cbWorkouts);
  const blockStart = new Date(`${PROGRAM_START}T00:00:00Z`);
  const outlook = progress.map((p) => {
    const tracked = TRACKED_LIFTS.find((t) => t.key === p.key)!;
    const day = PROGRAM_DAYS.find((d) => d.key === tracked.day)!;
    const hevyTitle = day.exercises.find((e) => e.name === tracked.exerciseName)!.hevyTitle;
    let before = 0;
    let during = 0;
    for (const w of workouts)
      for (const e of (w.exercises as HevyExercise[] | null) ?? []) {
        if (e.title !== hevyTitle) continue;
        for (const s of e.sets) {
          if (s.type === "warmup" || s.weight_kg == null || s.reps == null || s.weight_kg <= 0 || s.reps > 10) continue;
          const v = kgToLb(epley1RM(s.weight_kg, s.reps));
          if (w.startTime < blockStart) before = Math.max(before, v);
          else during = Math.max(during, v);
        }
      }
    const best = Math.max(before, during);
    return {
      lift: p.label,
      endOfBlockPlan: p.endExpected,
      latestActual: p.latestActual,
      onPaceFor: p.onPaceFor,
      bestBeforeBlock: r1(before),
      bestInBlock: r1(during),
      prExpected: p.onPaceFor != null && p.onPaceFor > best,
      marginOverBest: p.onPaceFor != null ? r1(p.onPaceFor - best) : null,
      rows: p.rows
        .filter((r) => r.actual1RM != null)
        .map((r) => ({ week: r.week, expected: r.expected1RM, actual: r.actual1RM, delta: r.delta })),
    };
  });

  if (AS_JSON) {
    console.log(JSON.stringify({ syncNote, today, shown, missed, swaps, proposals, gaps, outlook }, null, 2));
    return;
  }

  // ---- text report ----
  const setStr = (sets: LoggedSet[]) => sets.map((s) => `${s.lb}×${s.reps}`).join(", ") || "—";
  const out: string[] = [];
  out.push(`# healfy update · ${today}`, `(${syncNote})`, "");
  out.push(`## Sessions to brief (${shown.length}${ALL ? ", all" : ", no briefing yet"})`);
  if (!shown.length) out.push("None. Every logged session already has a briefing.");
  for (const r of shown) {
    out.push("", `### ${r.key} · ${r.date} · ${r.title}${r.minutes != null ? ` · ${r.minutes} min` : ""}`);
    for (const x of r.results) {
      const extra = [
        x.amrapReps != null ? `AMRAP ${x.amrapReps}` : "",
        x.topE1RM != null && (x.tier === "T1" || x.tier === "T2") ? `e1RM ${x.topE1RM}` : "",
        x.notes ? `NOTE: ${x.notes}` : "",
      ].filter(Boolean);
      out.push(
        `- [${x.status.toUpperCase()}] ${x.name} (${x.tier}) plan ${x.planned} → did ${setStr(x.sets)}${extra.length ? ` | ${extra.join(" | ")}` : ""}`
      );
    }
    for (const a of r.added)
      out.push(
        `- [ADDED, not in plan] ${a.name}${a.muscle ? ` (${a.muscle})` : ""}: ${setStr(a.sets)}${a.notes ? ` | NOTE: ${a.notes}` : ""}`
      );
    if (r.substitutions.length)
      out.push(`- Swaps: ${r.substitutions.map((s) => `${s.dropped} → ${s.added} (${s.muscle})`).join("; ")}`);
  }

  out.push("", "## Substitution history (all sessions)");
  if (!swaps.length) out.push("None.");
  for (const s of swaps)
    out.push(
      `- ${s.day}: ${s.dropped} → ${s.added} ×${s.occurrences} (${s.sessions.join(", ")}) · full sets: ${s.fullSets ? "yes" : "no"} · Hevy exercise exists: ${s.inLibrary ? "yes" : "NO"}`
    );
  const lonelyDrops = reports.flatMap((r) =>
    r.dropped.filter((d) => !r.substitutions.some((s) => s.dropped === d)).map((d) => `${r.key}: ${d}`)
  );
  if (lonelyDrops.length) out.push(`- Dropped with no replacement: ${lonelyDrops.join("; ")}`);
  const extraTally = new Map<string, string[]>();
  for (const r of reports)
    for (const name of r.extras) extraTally.set(`${r.day}|${name}`, [...(extraTally.get(`${r.day}|${name}`) ?? []), r.key]);
  for (const [id, sessions] of extraTally) {
    const [dayKey, name] = id.split("|");
    out.push(`- Unplanned add-on: ${dayKey} ${name} ×${sessions.length} (${sessions.join(", ")})`);
  }
  if (missed.length) out.push(`- Sessions with nothing logged: ${missed.join(", ")}`);

  out.push("", "## Proposed loads for the next session of each day");
  for (const p of proposals)
    out.push(
      `- ${p.day} W${p.forWeek} ${p.exercise}: plan ${p.currentPlanLb ?? "—"} → ${p.proposedLb ?? "—"} lb [${p.action}] · ${p.rule} · ${p.reason} (from ${p.basedOn})`
    );
  for (const g of gaps) out.push(`- NOTE ${g}`);

  out.push("", "## Expected vs actual 1RM and PR outlook (lb)");
  for (const o of outlook) {
    out.push(
      `- ${o.lift}: block-end plan ${o.endOfBlockPlan ?? "—"} · latest actual ${o.latestActual ?? "—"} · on pace for ${o.onPaceFor ?? "—"} · best before block ${o.bestBeforeBlock} / in block ${o.bestInBlock} · ${o.prExpected ? `PR EXPECTED (+${o.marginOverBest})` : "no PR on current pace"}`
    );
    if (o.rows.length)
      out.push(
        `    weekly: ${o.rows.map((r) => `W${r.week} ${r.actual} vs ${r.expected} (${r.delta! >= 0 ? "+" : ""}${r.delta})`).join(" · ")}`
      );
  }
  console.log(out.join(NL));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
