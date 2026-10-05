// Pushes the Comeback Block (src/lib/program.ts) to Hevy as routines in a
// "Comeback Block" folder: one routine per gym day per week (24), plus the
// Thursday home session once. Creates any custom exercises the program needs
// first. Safe to re-run: folders, custom exercises and routines that already
// exist locally (by title) are skipped, so a failed run can just be retried.
//
//   npx tsx scripts/push-comeback-block.ts --dry-run   # print what would be created
//   npx tsx scripts/push-comeback-block.ts             # create in Hevy
import "dotenv/config";
import { db } from "../src/lib/db";
import {
  pushNewExerciseTemplateIfMissing,
  pushNewRoutine,
  pushNewRoutineFolderIfMissing,
  type RoutineWritePayload,
} from "../src/lib/hevy";
import {
  CUSTOM_HEVY_EXERCISES,
  HEVY_FOLDER_TITLE,
  PROGRAM_DAYS,
  PROGRAM_NAME,
  PROGRAM_WEEKS,
  cueFor,
  dayDate,
  hevyRoutineTitle,
  rampLabel,
  restLabel,
  schemeLabel,
  warmupPyramid,
  type ProgramDay,
  type ProgramExercise,
  type RampSet,
} from "../src/lib/program";

const DRY_RUN = process.argv.includes("--dry-run");
const LB_TO_KG = 0.45359237;
const toKg = (lb: number) => Math.round(lb * LB_TO_KG * 1000) / 1000;

type HevySet = RoutineWritePayload["exercises"][number]["sets"][number];

/** Builds one Hevy set with only the fields its exercise type accepts. */
function hevySet(type: string, kind: "warmup" | "normal", s: RampSet & { meters?: number }): HevySet {
  const weight_kg = s.weightLb == null ? null : toKg(s.weightLb);
  switch (type) {
    case "weight_reps":
    case "bodyweight_weighted":
      return { type: kind, weight_kg, reps: s.reps ?? null };
    case "reps_only":
      return { type: kind, reps: s.reps ?? null };
    case "duration":
    case "distance_duration":
      return { type: kind, duration_seconds: s.seconds ?? null };
    case "short_distance_weight":
      return { type: kind, weight_kg, distance_meters: s.meters ?? null };
    default:
      throw new Error(`Unhandled Hevy exercise type "${type}"`);
  }
}

function exerciseNotes(ex: ProgramExercise, week: number): string {
  const rx = ex.rx(week);
  const rest = restLabel(ex.restSeconds);
  const head = [schemeLabel(rx), rx.loadLabel, rest ? `rest ${rest}` : ""].filter(Boolean).join(" · ");
  const ramp = ex.ramp ? ` Ramp: ${rampLabel(ex.ramp(week))}.` : "";
  return `${ex.tier} · ${head}. ${cueFor(ex, week)}${ramp}`;
}

function buildPayload(
  week: number,
  day: ProgramDay,
  templates: Map<string, { id: string; type: string }>,
  folderId: number
): RoutineWritePayload {
  const resolve = (title: string) => {
    const t = templates.get(title);
    if (!t) throw new Error(`No Hevy exercise template titled "${title}"`);
    return t;
  };

  const warmup = day.warmup.map((ex) => {
    const t = resolve(ex.hevyTitle);
    return {
      exercise_template_id: t.id,
      rest_seconds: 0,
      notes: `Warm-up · ${schemeLabel(ex.rx(week))} · ${ex.rx(week).loadLabel}. ${cueFor(ex, week)}`,
      sets: warmupPyramid(ex).map((s) => hevySet(t.type, "warmup", s)),
    };
  });

  const main = day.exercises.map((ex) => {
    const t = resolve(ex.hevyTitle);
    const rx = ex.rx(week);
    const ramp = (ex.ramp?.(week) ?? []).map((s) => hevySet(t.type, "warmup", s));
    const work = Array.from({ length: rx.sets }, () =>
      hevySet(t.type, "normal", { weightLb: rx.weightLb, reps: rx.reps, seconds: rx.seconds, meters: rx.meters })
    );
    return {
      exercise_template_id: t.id,
      rest_seconds: ex.restSeconds,
      notes: exerciseNotes(ex, week),
      sets: [...ramp, ...work],
    };
  });

  const when = day.repeatsWeekly ? "every Thursday" : `Week ${week} · ${day.key} ${dayDate(week, day)}`;
  return {
    title: hevyRoutineTitle(week, day),
    folder_id: folderId,
    notes: `${PROGRAM_NAME} · ${when} · ≈${day.minutes} min.${day.paddle ? " Paddle tonight." : ""}`,
    exercises: [...warmup, ...main],
  };
}

async function main() {
  const account = await db.hevyAccount.findFirst();
  if (!account) throw new Error("No connected Hevy account");
  const athleteId = account.athleteId;

  // 1. Custom exercises the built-in Hevy library doesn't have.
  for (const ex of CUSTOM_HEVY_EXERCISES) {
    const existing = await db.hevyExerciseTemplate.findFirst({ where: { athleteId, title: ex.title } });
    if (existing) continue;
    if (DRY_RUN) {
      console.log(`[dry-run] would create custom exercise "${ex.title}"`);
      continue;
    }
    await pushNewExerciseTemplateIfMissing(athleteId, ex);
    console.log(`created custom exercise "${ex.title}"`);
  }

  const templateRows = await db.hevyExerciseTemplate.findMany({ where: { athleteId } });
  const templates = new Map(templateRows.map((t) => [t.title, { id: t.hevyExerciseTemplateId, type: t.type }]));
  if (DRY_RUN) {
    for (const ex of CUSTOM_HEVY_EXERCISES) {
      if (!templates.has(ex.title)) templates.set(ex.title, { id: `<new:${ex.title}>`, type: ex.type });
    }
  }

  // 2. Folder.
  let folderId = -1;
  if (!DRY_RUN) {
    const { hevyFolderId } = await pushNewRoutineFolderIfMissing(athleteId, HEVY_FOLDER_TITLE);
    folderId = Number(hevyFolderId);
  }
  const localFolder = DRY_RUN
    ? null
    : await db.hevyRoutineFolder.findFirst({ where: { athleteId, hevyFolderId: String(folderId) } });

  // 3. Routines, in training order so the folder reads top to bottom.
  let created = 0;
  for (let week = 1; week <= PROGRAM_WEEKS; week++) {
    for (const day of PROGRAM_DAYS) {
      if (day.repeatsWeekly && week > 1) continue;
      const payload = buildPayload(week, day, templates, folderId);
      const existing = await db.hevyRoutine.findFirst({ where: { athleteId, title: payload.title } });
      if (existing) {
        console.log(`skip (exists): ${payload.title}`);
        continue;
      }
      if (DRY_RUN) {
        console.log(`[dry-run] ${payload.title}`);
        for (const e of payload.exercises) {
          const title = templateRows.find((t) => t.hevyExerciseTemplateId === e.exercise_template_id)?.title ?? e.exercise_template_id;
          const sets = e.sets
            .map((s) => `${s.type === "warmup" ? "w" : ""}${s.weight_kg != null ? Math.round(s.weight_kg / LB_TO_KG) : ""}x${s.reps ?? s.duration_seconds ?? s.distance_meters ?? "-"}`)
            .join(" ");
          console.log(`    ${title} | ${sets}`);
        }
        continue;
      }
      await pushNewRoutine(athleteId, payload, localFolder?.id ?? null);
      created++;
      console.log(`created: ${payload.title}`);
    }
  }
  console.log(DRY_RUN ? "dry run complete" : `done: ${created} routine(s) created`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
