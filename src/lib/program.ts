// "Regressive Underload": a fixed 6-week volume block (Nov 16 – Dec 27, 2026),
// run straight after the Comeback Block (Oct 5 – Nov 15) and its bench test.
//
// This file is the single source of truth for the program: the
// /dashboard/program page renders it, and scripts/push-program.ts turns it
// into Hevy routines in the block's Hevy folder. Loads are in pounds (how the
// athlete trains); the Hevy push converts to kg. Kept dependency-free so the
// push script can import it with a plain relative path.
//
// Structure, with sources on the program page:
//  - Bench 3×/week in the Zourdos et al. 2016 day order (volume → lighter
//    middle day → heavy): Mon 5×8, Wed paused bench 4×5, Fri 5×5+.
//  - Deadlift 2×/week as GZCLP's T1/T2 pair: Fri 5×3+ heavy, Mon 3×8.
//  - Squat once, on Wednesday (5×5).
//  - Weighted pull-up 5×3+ on Sunday; Friday bodyweight pull-ups train for an
//    AMRAP test: one max set, then sub-max sets to a weekly rep total
//    (Armstrong program / 7 Weeks to 50 Pull-Ups).
//  - It is a volume block: weeks 1–5 add sets first, then load (as in 5/3/1
//    Boring But Big and Candito's opening weeks). Week 6 is a deload.
// Starting loads come from the athlete's Hevy logs between Nov 2 and Nov 15, 2026.

export const PROGRAM_NAME = "Regressive Underload";
export const PROGRAM_START = "2026-11-16"; // Monday of week 1
export const PROGRAM_WEEKS = 6;
export const HEVY_FOLDER_TITLE = "Regressive Underload";
/** Every Hevy routine of this block starts with this; it links logged workouts back to sessions. */
export const ROUTINE_PREFIX = "RU";
/** Week 6 is a deload: fewer sets, lighter, and the bodyweight pull-up max test on Friday. */
export const DELOAD_WEEK = 6;

export type Tier = "T1" | "T2" | "T3" | "ELBOW" | "CORE" | "MOBILITY";
export type DayKey = "Mon" | "Wed" | "Thu" | "Fri" | "Sun";

/** One prescription for one week. `reps` is the per-set target (the bottom of a range). */
export type Prescription = {
  sets: number;
  reps?: number;
  /** Display override for the reps part, e.g. "3+", "6–10", "12 / side". */
  repsLabel?: string;
  seconds?: number;
  meters?: number;
  /** Working-set load in lb. Added load for weighted bodyweight moves (0 = bodyweight). Null = not loaded / pick on the day. */
  weightLb: number | null;
  loadLabel: string;
};

export type RampSet = { weightLb: number | null; reps?: number; seconds?: number };

export type ProgramExercise = {
  name: string;
  /** Exact Hevy exercise-template title the push script resolves. */
  hevyTitle: string;
  tier: Tier;
  restSeconds: number;
  rx: (week: number) => Prescription;
  cue: string | ((week: number) => string);
  ramp?: (week: number) => RampSet[];
  /** Prep moves done right before this exercise (e.g. scapular pull-ups before pull-ups). */
  primer?: ProgramExercise[];
  /** Accessories sharing a tag (adjacent in the list) are done as a superset: A1, A2, A1, A2... Never used on the T1 lifts. */
  superset?: string;
  /** Only programmed in these weeks (a one-off make-up or substitute). Omitted = every week. */
  weeks?: number[];
};

export type ProgramDay = {
  key: DayKey;
  /** Day offset from the Monday of the week. */
  offset: number;
  title: string;
  paddle: boolean;
  minutes: number;
  /** Same every week (the Thursday home session) — pushed to Hevy once instead of per week. */
  repeatsWeekly: boolean;
  /** One-line intro shown above the exercises (the warm-up for gym days). */
  note: (week: number) => string;
  /** The warm-up for a given week (rotates; the shoulder pair stays). */
  warmup: (week: number) => ProgramExercise[];
  exercises: ProgramExercise[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BAR = 45;
const r5 = (x: number) => Math.round(x / 5) * 5;
const lb = (v: number) => `${v} lb`;
const belt = (v: number) => (v === 0 ? "BW" : `+${v} lb`);

/** Bar ramp: one set of 10 with the bar, plus one ~70% single-triple only when the work weight is heavy. */
function barRamp(work: number): RampSet[] {
  const sets: RampSet[] = [{ weightLb: BAR, reps: 10 }];
  const v = r5(work * 0.7);
  if (work >= 155 && v > BAR && v < work) sets.push({ weightLb: v, reps: 3 });
  return sets;
}

/** Deadlift ramp: 135 × 5, then one ~80% double. */
function dlRamp(work: number): RampSet[] {
  const sets: RampSet[] = [{ weightLb: 135, reps: 5 }];
  const v = r5(work * 0.8);
  if (v > 135 && v < work) sets.push({ weightLb: v, reps: 2 });
  return sets;
}

const pullUpRamp = (): RampSet[] => [{ weightLb: 0, reps: 5 }];

const fixed = (p: Prescription) => () => p;


/** Week 6 deload: accessories drop to 2 sets at the same load. */
const acc = (week: number, sets = 3) => (week === DELOAD_WEEK ? 2 : sets);

// ---------------------------------------------------------------------------
// Ladders: [sets, reps, lb] per week, weeks 1–6. Week 6 is the deload.
// The planned climb assumes every set is hit; the update workflow follows the
// lifter (a miss repeats the load, a beaten plan rebases from what was lifted).
// ---------------------------------------------------------------------------

type Step = [number, number, number];

/** Monday bench volume: add a set, then add 5 lb. Logged 155 × 8 × 4 (Nov 16) and 160 × 8 × 5 (Nov 23), 5 lb over the plan both times, so weeks 3–5 climb from 160. */
const BENCH_VOLUME: Step[] = [[4, 8, 150], [5, 8, 155], [4, 8, 165], [5, 8, 165], [5, 8, 170], [3, 5, 135]];
/** Wednesday paused bench 4 × 5. Logged 165 × 5, 5, 5, 4 (Nov 18) and 170 × 5 × 4 (Nov 25, all sets), so it climbs 5 lb from 170. */
const PAUSED_BENCH: Step[] = [[4, 5, 165], [4, 5, 170], [4, 5, 175], [4, 5, 175], [4, 5, 180], [3, 5, 145]];
/** Friday bench heavy 5 × 5+ (last set AMRAP). Logged 185 × 4 × 5 on Nov 20, 10 lb over the plan but a rep short on every set, so 185 repeats. */
const BENCH_HEAVY: Step[] = [[5, 5, 175], [5, 5, 185], [5, 5, 190], [5, 5, 190], [5, 5, 195], [3, 3, 155]];
/** Wednesday squat 5 × 5, the only squat day. Logged 225 × 5, 5 on Nov 25 (25 lb over the plan, 2 of 5 sets), so 225 repeats as a full 5 × 5 before it climbs. */
const SQUAT: Step[] = [[5, 5, 200], [5, 5, 200], [5, 5, 225], [5, 5, 230], [5, 5, 235], [3, 5, 185]];
/** Monday deadlift 3 × 8 (GZCLP T2). Logged 225 × 8, 8, 8 on Nov 16; not logged on Nov 23, so week 3 repeats 230. */
const DEADLIFT_VOLUME: Step[] = [[3, 8, 225], [3, 8, 230], [3, 8, 230], [3, 8, 235], [3, 8, 235], [2, 5, 205]];
/** Friday deadlift 5 × 3+ (GZCLP T1). Skipped Nov 20; 255 × 5, 5 on Nov 27 was only 2 of 5 sets, so 255 repeats in week 3. Before that: 275 × 3, 2, 2 (Nov 6), which missed reps. */
const DEADLIFT_HEAVY: Step[] = [[5, 3, 255], [5, 3, 255], [5, 3, 255], [5, 3, 265], [5, 3, 270], [3, 3, 225]];
/** Sunday weighted pull-up 5 × 3+, added lb. Logged +65 × 3, 3, 2 then +62.5 × 3, 3 on Nov 22 (a miss), so +65 repeats. */
const PULLUP_HEAVY: Step[] = [[5, 3, 65], [5, 3, 65], [5, 3, 70], [5, 3, 75], [5, 3, 75], [3, 3, 45]];

/** Friday bodyweight pull-ups, weeks 1–5: one max set, then sets of `size` until the rep total is reached. */
const PULLUP_VOLUME: { total: number; size: number; sets: number }[] = [
  { total: 40, size: 6, sets: 6 },
  { total: 45, size: 6, sets: 7 },
  { total: 50, size: 7, sets: 7 },
  { total: 55, size: 7, sets: 8 },
  { total: 60, size: 7, sets: 8 },
];

const BENCH_HEAVY_RAMP_W6: RampSet[] = [
  { weightLb: BAR, reps: 10 },
  { weightLb: 115, reps: 3 },
];

function ladderRx(ladder: Step[], week: number, amrap = false, load: (v: number) => string = lb): Prescription {
  const [sets, reps, weight] = ladder[week - 1];
  const plus = amrap && week !== DELOAD_WEEK;
  return { sets, reps, repsLabel: plus ? `${reps}+` : undefined, weightLb: weight, loadLabel: load(weight) };
}

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

/** One warm-up move: mobility or activation, kept to 1–2 sets. */
function prep(
  name: string, hevyTitle: string, sets: number, reps: number, repsLabel: string, cue: string
): ProgramExercise {
  return {
    name, hevyTitle, tier: "MOBILITY", restSeconds: 0,
    rx: fixed({ sets, reps, repsLabel, weightLb: null, loadLabel: "" }),
    cue,
  };
}

const EASY_ROW: ProgramExercise = {
  name: "Easy row or bike", hevyTitle: "Rowing Machine", tier: "MOBILITY", restSeconds: 0,
  rx: fixed({ sets: 1, seconds: 120, weightLb: null, loadLabel: "easy" }),
  cue: "2 minutes, easy pace. Just raise your temperature.",
};

const CAT_CAMEL = prep("Cat-Camel", "Cat-Camel", 1, 8, "8",
  "On all fours, round the back up then sag it down, slowly. Warms up the spine before loading it.");
const THREAD_NEEDLE = prep("Thread the Needle", "Thread the Needle", 1, 6, "6 / side",
  "On all fours, slide one arm under the body and rotate the upper back. Opens the thoracic spine for bench and the paddle stroke.");
const BIRD_DOG = prep("Bird Dog", "Bird Dog", 1, 6, "6 / side",
  "Reach the opposite arm and leg out long, hips level, 3 s hold. Trunk control for rowing and carries.");
const PULL_APART = prep("Banded Pull Apart", "Band Pullaparts", 1, 15, "15",
  "Arms straight, pull the band to your chest by squeezing the shoulder blades. Wakes up the rear delts before pressing.");
const DEAD_BUG = prep("Dead Bug", "Dead Bug", 1, 6, "6 / side",
  "Low back flat on the floor, extend the opposite arm and leg slowly. Bracing practice for heavy pulls.");
const SCAP_PULLUP = prep("Scapular Pull-up", "Scapular Pull Ups", 1, 8, "8",
  "Hang from the bar, arms straight, pull the shoulder blades down without bending the elbows. Primes the lats right before pull-ups.");

/** A timed warm-up hold (stretch or position), 1 set. */
function hold(name: string, hevyTitle: string, seconds: number, repsLabel: string, cue: string): ProgramExercise {
  return {
    name, hevyTitle, tier: "MOBILITY", restSeconds: 0,
    rx: fixed({ sets: 1, seconds, repsLabel, weightLb: null, loadLabel: "" }),
    cue,
  };
}

// The shoulder pair stays in every gym warm-up. Everything after it rotates by day and week.
const DISLOCATORS = prep("Shoulder Dislocators", "Shoulder Dislocators", 1, 10, "10",
  "Wide grip on a band, dowel or towel. Arms straight, slowly sweep overhead and behind you, then back. Widen the grip until it is smooth and pain-free. Shoulder range for bench and pull-ups.");
const ELEPHANT_WALK = hold("Elephant Walk", "Elephant Walk", 45, "45 s",
  "Hands on the floor (or on shins), hips high, legs nearly straight. Slowly alternate bending one knee and pressing the other heel down, so the hamstrings floss back and forth. Short, slow steps. Do it before the lifts, and stretch the hamstrings a little deeper each week.");
const GREATEST_STRETCH = prep("World's Greatest Stretch", "World's Greatest Stretch", 1, 5, "5 / side",
  "Deep lunge, same-side hand inside the front foot. Rotate the other arm up to the ceiling, then sit back and straighten the front leg. Hips, hamstrings and upper back in one move.");
const HIP_FLEXOR_STRETCH = hold("Half-Kneeling Hip Flexor Stretch", "Half-Kneeling Hip Flexor Stretch", 30, "30 s / side",
  "Straight out of the greatest stretch: drop the back knee, squeeze that glute and tuck the pelvis. No arching of the low back.");
const PIGEON = hold("Pigeon Pose", "Pigeon Pose", 30, "30 s / side",
  "Front shin across the body, back leg long, hips square. Fold forward only as far as is comfortable. Opens the glutes and outer hip for squat and deadlift depth.");
const DEEP_SQUAT_HOLD = hold("Deep Squat Hold", "Deep Squat Hold", 30, "30 s",
  "Heels down, toes slightly out, elbows pressing the knees out, chest tall. Rock gently side to side. Squat depth with no load on the spine.");
const INCHWORM = prep("Inchworm", "Inchworm", 1, 6, "6",
  "Stand, hinge down, walk the hands out to a plank, then walk the feet back in. Straight legs where you can. Warms the hamstrings, shoulders and trunk together.");
const LATERAL_LUNGE = prep("Lateral Lunge", "Lateral Lunge", 1, 6, "6 / side",
  "Big step out to the side, sit back on that hip, keep the other leg straight and both feet flat. Groin and glute mobility for squats.");
const SPIDERMAN = prep("Spiderman Lunge", "Spiderman", 1, 5, "5 / side",
  "Step into a deep lunge with the foot outside the same-side hand, elbow driving toward the instep. Hips and adductors.");
const NINETY_NINETY = prep("90/90 Switches", "90/90s", 1, 5, "5 / side",
  "Sit with both knees bent at 90°, then rotate the knees across to the other side without using the hands. Hip internal and external rotation.");
const LIZARD = prep("Lizard Lunge", "Lizard Lunges", 1, 5, "5 / side",
  "Deep lunge with both hands inside the front foot. Hold the bottom for a breath, then drop the front knee out and in. Hips and groin.");
const OPEN_BOOK = prep("Open Book", "Open Book Rotation", 1, 6, "6 / side",
  "Lying on your side, knees stacked. Rotate the top arm open and follow it with the eyes. Upper back rotation for the paddle.");
const ANKLE_ROCKS = prep("Ankle Rocks", "Ankle Dorsiflexion Rocks", 1, 8, "8 / side",
  "Half-kneeling, heel flat, knee glides over the toes. Ankle range for squat depth.");

// Gym warm-up: 2 min row → band pull apart → shoulder dislocators (every day) → three rotating mobility moves.
// Elephant walk is in every one. The two lists per day alternate: odd weeks use the first, even weeks the second.
const ROTATING_WARMUP: Record<"Mon" | "Wed" | "Fri" | "Sun", ProgramExercise[][]> = {
  Mon: [
    [ELEPHANT_WALK, GREATEST_STRETCH, CAT_CAMEL],
    [ELEPHANT_WALK, PIGEON, INCHWORM],
  ],
  Wed: [
    [ELEPHANT_WALK, DEEP_SQUAT_HOLD, LATERAL_LUNGE],
    [ELEPHANT_WALK, SPIDERMAN, ANKLE_ROCKS],
  ],
  Fri: [
    [ELEPHANT_WALK, GREATEST_STRETCH, HIP_FLEXOR_STRETCH],
    [ELEPHANT_WALK, NINETY_NINETY, CAT_CAMEL],
  ],
  Sun: [
    [ELEPHANT_WALK, THREAD_NEEDLE, OPEN_BOOK],
    [ELEPHANT_WALK, LIZARD, THREAD_NEEDLE],
  ],
};
function gymWarmup(key: keyof typeof ROTATING_WARMUP, week: number): ProgramExercise[] {
  const rotation = ROTATING_WARMUP[key][(week - 1) % 2];
  return [EASY_ROW, PULL_APART, DISLOCATORS, ...rotation];
}
const THU_WARMUP = [BIRD_DOG, DEAD_BUG, ELEPHANT_WALK];

/** Every warm-up move a day can have in any week (used to tell warm-up sets apart from work in logs). */
export function allWarmupTitles(day: ProgramDay): string[] {
  const titles = new Set<string>();
  for (let w = 1; w <= PROGRAM_WEEKS; w++) {
    for (const ex of day.warmup(w)) {
      titles.add(ex.hevyTitle);
      for (const p of ex.primer ?? []) titles.add(p.hevyTitle);
    }
  }
  return [...titles];
}

/** The one-line warm-up summary shown above a day's exercises. */
function warmupNote(warmup: ProgramExercise[]): string {
  const list = warmup
    .filter((ex) => ex !== EASY_ROW)
    .map((ex) => {
      const rx = ex.rx(1);
      return `${ex.name} ${rx.repsLabel ?? (rx.seconds ? `${rx.seconds} s` : rx.reps)}`;
    })
    .join(" · ");
  return `Warm-up (≈6 min, 1 set each): 2 min easy row or bike → ${list} → 1–2 ramp sets on the first lift.`;
}

/** Hevy sets for a warm-up move, one per prescribed set. */
export function warmupSets(ex: ProgramExercise): RampSet[] {
  const { sets, reps, seconds } = ex.rx(1);
  return Array.from({ length: sets }, () => ({ weightLb: null, reps, seconds }));
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

const DELOAD_CUE = "Deload week: lighter and fewer sets. Leave at least 3 reps in the tank on every set.";
const deload = (week: number, cue: string) => (week === DELOAD_WEEK ? DELOAD_CUE : cue);

export const PROGRAM_DAYS: ProgramDay[] = [
  {
    key: "Mon", offset: 0, title: "Bench volume · Deadlift volume · DB press", paddle: true, minutes: 65, repeatsWeekly: false,
    note: (w) => warmupNote(gymWarmup("Mon", w)),
    warmup: (w) => gymWarmup("Mon", w),
    exercises: [
      {
        name: "Bench Press · volume", hevyTitle: "Bench Press (Barbell)", tier: "T1", restSeconds: 120,
        rx: (w) => ladderRx(BENCH_VOLUME, w),
        ramp: (w) => barRamp(BENCH_VOLUME[w - 1][2]),
        cue: (w) =>
          deload(w,
            w === 1
              ? "You did 150 × 8, 8, 8 on Nov 2. This block adds sets before weight: 4 × 8 this week, 5 × 8 next. Same setup every set: modest arch, shoulder blades pinned (your Nov 2 note says the shoulder slipped on the first set), touch and press. If a set drops to 6–7, repeat the week."
              : "You did 155 × 8, 8, 8, 8 on Nov 16 and 160 × 8, 8, 8, 8, 8 on Nov 23, 5 lb over the plan with every rep there both times. The ladder climbs from 160: 4 × 8 at 165, 5 × 8 at 165, then 5 × 8 at 170. A clean week moves to the next step (a set first, then 5 lb). If a set drops to 6–7, repeat this load and set count next week. Shoulder blades pinned, modest arch."),
      },
      {
        name: "Deadlift · volume", hevyTitle: "Deadlift (Barbell)", tier: "T2", restSeconds: 150,
        rx: (w) => ladderRx(DEADLIFT_VOLUME, w),
        ramp: (w) => dlRamp(DEADLIFT_VOLUME[w - 1][2]),
        cue: (w) =>
          deload(w,
            "GZCLP's T2 deadlift: the second, lighter pull of the week (Friday is the heavy one). You did 225 × 8, 8, 8 on Nov 16, all three sets clean, and no deadlift was logged on Nov 23, so week 3 repeats 230. Leave 2 reps in the tank, since you paddle tonight. Reset every rep: bar over mid-foot, lats tight, push the floor away. All 3 sets at 8 → +5 lb next week. If the back goes over 3/10, stop and tell me."),
      },
      {
        name: "Seated DB Shoulder Press", hevyTitle: "Shoulder Press (Dumbbell)", tier: "T2", restSeconds: 120,
        rx: (w) => ({ sets: acc(w), reps: 8, repsLabel: "8–10", weightLb: 50, loadLabel: "50s" }),
        cue: "Bench at 80–90°, back on the pad, elbows slightly forward. You did 45s × 9, 9, 9 on Nov 16, then 50s × 6, 7, 7 on Nov 23. Stay at 50s until all 3 sets hit 8, then build to 10 before going up.",
      },
      {
        name: "Nautilus Rear Delt Fly", hevyTitle: "Nautilus Rear Delt Fly", tier: "T3", restSeconds: 0, superset: "A",
        rx: (w) => ({ sets: acc(w), reps: 8, repsLabel: "8–12", weightLb: 50, loadLabel: "50 lb" }),
        cue: "Superset with the pushdown: fly, then straight into the pushdown, rest 60 s. Lead with the elbows, no shrugging. You swapped to this machine on Nov 16 and Nov 23: 50 × 6, 6, 6, then 50 × 7, 7, 7. Build to 12 before adding weight.",
      },
      {
        name: "Triceps Pushdown", hevyTitle: "Triceps Pushdown", tier: "T3", restSeconds: 60, superset: "A",
        rx: (w) => ({ sets: acc(w), reps: 8, repsLabel: "8–12", weightLb: 50, loadLabel: "50 lb" }),
        cue: "Cable pushdown, superset with the rear delt fly. Elbows pinned to the sides, full lockout, 2 s down. You swapped to this on Nov 16 and Nov 23: 45 × 8, 50 × 6, 6, then 50 × 7, 7, 7. Build to 12 before adding weight. Stop the set if the elbow goes over 3/10.",
      },
    ],
  },
  {
    key: "Wed", offset: 2, title: "Paused bench · Squat · Incline", paddle: true, minutes: 70, repeatsWeekly: false,
    note: (w) => warmupNote(gymWarmup("Wed", w)),
    warmup: (w) => gymWarmup("Wed", w),
    exercises: [
      {
        name: "Paused Bench Press", hevyTitle: "Paused Bench Press (Barbell)", tier: "T2", restSeconds: 120,
        rx: (w) => ladderRx(PAUSED_BENCH, w),
        ramp: (w) => barRamp(PAUSED_BENCH[w - 1][2]),
        cue: (w) =>
          deload(w,
            "Back on Wednesday at your request, since the 225 attempt on Nov 13 stalled near the end of the rep. Touch the chest, hold a still 1 s pause, then press: no bounce, same bar path every rep. You did 165 × 5, 5, 5, 4 on Nov 18, so 165 repeats until all 4 sets hit 5, then +5 lb. Stop if the elbow goes over 3/10."),
      },
      {
        name: "Back Squat", hevyTitle: "Squat (Barbell)", tier: "T1", restSeconds: 150,
        rx: (w) => ladderRx(SQUAT, w),
        ramp: (w) => barRamp(SQUAT[w - 1][2]),
        cue: (w) =>
          deload(w,
            "The week's only squat day, so this is the main squat effort. No squat was logged on Nov 18 (barbell lunges 95 × 8 × 4 instead), so it starts at 200 as planned. Before that: 215 × 3, 3, 3, 3, 6 on Nov 2 and 185 × 8, 8, 8 on Nov 11. If you swapped because something hurt, tell me and I will rework the lower-body days. Brace into the belt before every rep, hit depth, drive up. Leave 1–2 in the tank since you paddle tonight. All 5 sets at 5 → +5 lb; a missed set repeats the load."),
      },
      {
        name: "Smith Incline Press", hevyTitle: "Incline Bench Press (Smith Machine)", tier: "T2", restSeconds: 90,
        rx: (w) => ({ sets: acc(w), reps: 8, repsLabel: "8–10", weightLb: 110, loadLabel: "110 lb" }),
        cue: "Upper chest, a different angle from flat bench. You did 100 × 8, 8, 8 on Nov 18, then 110 × 7, 7, 7 on Nov 25. Stay at 110 until all 3 sets hit 8, then build to 10 before adding 5 lb. The incline machine is a fine swap.",
      },
      {
        name: "Single-Arm Triceps Pushdown (Cable)", hevyTitle: "Single Arm Triceps Pushdown (Cable)", tier: "T3", restSeconds: 60,
        rx: (w) => ({ sets: acc(w), reps: 6, repsLabel: "6–10 / arm", weightLb: 25, loadLabel: "25 lb" }),
        cue: "Replaces the overhead DB extension, which you swapped out on Nov 18 and Nov 25. Elbow pinned to the side, full lockout, 2 s down. You did 20 × 10, 25 × 10, 25 × 6 on Nov 18, then 25 × 6, 6, 6 on Nov 25. Stay at 25 until all 3 sets hit 8, then build to 10. Stop the set if the elbow goes over 3/10.",
      },
      {
        name: "Seated Leg Curl", hevyTitle: "Seated Leg Curl (Machine)", tier: "T3", restSeconds: 75,
        rx: (w) => ({ sets: acc(w), reps: 8, repsLabel: "8–10", weightLb: 120, loadLabel: "120 lb" }),
        cue: "Hamstrings and knee health. 2 s squeeze, slow return. You did 120 × 7, 7, 7 on Nov 9. Build all 3 sets to 10 before going up.",
      },
    ],
  },
  {
    key: "Thu", offset: 3, title: "Home mobility + elbow", paddle: false, minutes: 40, repeatsWeekly: true,
    note: () => "Start with bird dog and dead bug (1 set each, 6 per side) to wake up the trunk, then an elephant walk for the hamstrings. You need a mat, a strap or towel, and a light DB or band. A foam roller is optional.",
    warmup: () => THU_WARMUP,
    exercises: [
      {
        name: "Isometric Wrist Extension", hevyTitle: "Isometric Wrist Extension", tier: "ELBOW", restSeconds: 0,
        rx: fixed({ sets: 3, seconds: 45, weightLb: null, loadLabel: "light DB or band" }),
        cue: "Forearm on thigh, palm down. Hold a DB or press up into a band, hard but ≤3/10 pain. Alternate with the next exercise instead of resting.",
      },
      {
        name: "Isometric Wrist Flexion", hevyTitle: "Isometric Wrist Flexion", tier: "ELBOW", restSeconds: 30,
        rx: fixed({ sets: 3, seconds: 45, weightLb: null, loadLabel: "light DB or band" }),
        cue: "Same setup with the palm up.",
      },
      {
        name: "Wrist Extensor + Flexor Stretch", hevyTitle: "Wrist Extensor & Flexor Stretch", tier: "ELBOW", restSeconds: 0,
        rx: fixed({ sets: 3, seconds: 30, repsLabel: "30 s each", weightLb: null, loadLabel: "" }),
        cue: "Arm straight. Gently bend the wrist down, then up, with the other hand.",
      },
      {
        name: "Half-Kneeling Hip Flexor Stretch", hevyTitle: "Half-Kneeling Hip Flexor Stretch", tier: "MOBILITY", restSeconds: 0,
        rx: fixed({ sets: 2, seconds: 60, repsLabel: "60 s / side", weightLb: null, loadLabel: "" }),
        cue: "Squeeze the back-leg glute and tuck the pelvis. Undoes the time sitting in the boat.",
      },
      {
        name: "Supine Hamstring Strap Stretch", hevyTitle: "Supine Hamstring Strap Stretch", tier: "MOBILITY", restSeconds: 0,
        rx: fixed({ sets: 2, seconds: 60, repsLabel: "60 s / side", weightLb: null, loadLabel: "" }),
        cue: "Keep the other leg flat on the floor.",
      },
      {
        name: "90/90 Hip Hold", hevyTitle: "90/90 Hip Hold", tier: "MOBILITY", restSeconds: 0,
        rx: fixed({ sets: 2, seconds: 60, repsLabel: "60 s / side", weightLb: null, loadLabel: "" }),
        cue: "Sit tall, lean over the front shin.",
      },
      {
        name: "Open Book T-Spine Rotation", hevyTitle: "Open Book Rotation", tier: "MOBILITY", restSeconds: 0,
        rx: fixed({ sets: 2, reps: 8, repsLabel: "8 / side, 3 s hold", weightLb: null, loadLabel: "" }),
        cue: "Lying on your side, knees stacked. Rotate the top arm open. This is paddle rotation.",
      },
      {
        name: "Doorway Pec Stretch", hevyTitle: "Doorway Pec Stretch", tier: "MOBILITY", restSeconds: 0,
        rx: fixed({ sets: 2, seconds: 60, repsLabel: "60 s / side", weightLb: null, loadLabel: "" }),
        cue: "Elbow at shoulder height. Counters the bench and paddling posture.",
      },
      {
        name: "Lat Stretch (hands on a chair, hips back)", hevyTitle: "Lat Stretch", tier: "MOBILITY", restSeconds: 0,
        rx: fixed({ sets: 2, seconds: 60, weightLb: null, loadLabel: "" }),
        cue: "Overhead range for pull-ups and the bench arch.",
      },
      {
        name: "Knee-to-Wall Ankle Stretch", hevyTitle: "Knee-to-Wall Ankle Stretch", tier: "MOBILITY", restSeconds: 0,
        rx: fixed({ sets: 2, seconds: 60, repsLabel: "60 s / side", weightLb: null, loadLabel: "" }),
        cue: "Heel down, knee over the toes. Squat depth.",
      },
    ],
  },
  {
    key: "Fri", offset: 4, title: "Bench heavy · Deadlift heavy · Pull-up volume", paddle: false, minutes: 75, repeatsWeekly: false,
    note: (w) => warmupNote(gymWarmup("Fri", w)),
    warmup: (w) => gymWarmup("Fri", w),
    exercises: [
      {
        name: "Bench Press · heavy", hevyTitle: "Bench Press (Barbell)", tier: "T1", restSeconds: 150,
        rx: (w) => ladderRx(BENCH_HEAVY, w, true),
        ramp: (w) => (w === DELOAD_WEEK ? BENCH_HEAVY_RAMP_W6 : barRamp(BENCH_HEAVY[w - 1][2])),
        cue: (w) =>
          deload(w,
            w === 1
              ? "Heavy day, now 5s instead of 3s for more volume. 175 is about 82% of the 210–215 you think your max is (225 was missed on Nov 13), and your last heavy sets were 185 × 3 × 5 on Nov 6. Last set AMRAP, 1 clean rep left. Every set at 5+ → +5 lb; AMRAP of 8+ → an extra +5. A missed set repeats the load."
              : "You did 185 × 4, 4, 4, 4, 4 on Nov 20, then 185 × 5 × 5 on Nov 27 (e1RM 216), every set at target, so +5 lb now. Last set AMRAP, 1 clean rep left. Every set at 5+ → +5 lb; AMRAP of 8+ → an extra +5. A missed set repeats the load. Feet planted, glutes on the bench."),
      },
      {
        name: "Deadlift · heavy", hevyTitle: "Deadlift (Barbell)", tier: "T1", restSeconds: 150,
        rx: (w) => ladderRx(DEADLIFT_HEAVY, w, true),
        ramp: (w) => dlRamp(DEADLIFT_HEAVY[w - 1][2]),
        cue: (w) =>
          deload(w,
            w === 1
              ? "GZCLP T1. You did 275 × 3, 2, 2 on Nov 6 (missed reps, e1RM 302) and 225 × 6, 7, 8 on Nov 13, so the ladder restarts at 255 and climbs 10, then 5 a week. Reset every rep: bar over mid-foot, lats tight, push the floor away. Last set AMRAP, 1 clean rep left. A set under 3 repeats the load."
              : "No heavy deadlift was logged on Nov 20, and you did 255 × 5, 5 on Nov 27 (e1RM 297, but only 2 of 5 sets), so 255 repeats in week 3. Last heavy sets: 275 × 3, 2, 2 on Nov 6, and 225 × 8, 8, 8 on Nov 16 (Monday volume). Reset every rep: bar over mid-foot, lats tight, push the floor away. Last set AMRAP, 1 clean rep left. Every set at 3+ → next step; a set under 3 repeats the load. If something hurt, tell me and I will change the plan."),
      },
      {
        name: "Pull-up · volume", hevyTitle: "Pull Up", tier: "T2", restSeconds: 90,
        rx: (w) => {
          if (w === DELOAD_WEEK) return { sets: 1, repsLabel: "max (test)", weightLb: 0, loadLabel: "BW" };
          const v = PULLUP_VOLUME[w - 1];
          return { sets: v.sets, reps: v.size, repsLabel: `${v.size}, set 1 max`, weightLb: 0, loadLabel: `BW · ${v.total} reps total` };
        },
        primer: [SCAP_PULLUP],
        cue: (w) => {
          if (w === DELOAD_WEEK)
            return "Pull-up AMRAP test: one all-out set after scapular pull-ups. Bench and deadlift are light this week, so you come in fresh. Dead hang at the bottom, chin over the bar, no kipping. Best recent sets: 18 (Nov 20) and 14 (Aug 5). Log the number; it sets up the next block.";
          const v = PULLUP_VOLUME[w - 1];
          return `Training for the AMRAP test (Armstrong / 7 Weeks to 50 style). Set 1 is a max set: dead hang, chin over the bar, stop when form breaks. Then sets of ${v.size} with 90 s rest (take a full 2 min after the max set) until you reach ${v.total} reps in total, max set included; log however many sets that takes. If a set falls short of ${v.size}, finish the total in smaller sets. You did 18, 8, 5, 4, 4, 3 on Nov 20 (42 reps) and 17, 6, 5, 5, 5, 3, 5 on Nov 27 (46 reps against 45).`;
        },
      },
      {
        name: "45° Back Extension", hevyTitle: "Back Extension (Weighted Hyperextension)", tier: "T3", restSeconds: 0, superset: "A",
        rx: (w) => ({ sets: acc(w), reps: 8, repsLabel: "8–10", weightLb: 95, loadLabel: "95 lb" }),
        cue: "Superset with the hammer curl: back extension, then straight into the curl, rest 60 s. Hinge at the hips with a neutral spine and a 2 s hold at the top. You did 90 × 10, 10, 10 on Nov 20, then 95 × 8, 8, 8 on Nov 27. Build to 3 × 10 at 95 before adding weight. If the session is past 75 min, this pair is the first to go.",
      },
      {
        name: "Hammer Curl", hevyTitle: "Hammer Curl (Dumbbell)", tier: "T3", restSeconds: 60, superset: "A",
        rx: (w) => ({ sets: acc(w), reps: 8, repsLabel: "8–12", weightLb: 25, loadLabel: "25s" }),
        cue: "Superset with the back extension. Back to 25s: 30 × 5, 5 on Nov 13 was a grind, and heavy hammer curls have flared the elbow before. Slow 3 s lowering, no swinging. You did 25 × 9, 9, 9 on Nov 20, then 25 × 10, 10, 10 on Nov 27. Build all 3 sets to 12 at 25s before trying 30s again. Stop the set if the elbow goes over 3/10.",
      },
    ],
  },
  {
    key: "Sun", offset: 6, title: "Weighted pull-up · Rows · Shoulders · Core", paddle: false, minutes: 70, repeatsWeekly: false,
    note: (w) => warmupNote(gymWarmup("Sun", w)),
    warmup: (w) => gymWarmup("Sun", w),
    exercises: [
      {
        name: "Weighted Pull-up", hevyTitle: "Pull Up (Weighted)", tier: "T1", restSeconds: 120,
        rx: (w) => ladderRx(PULLUP_HEAVY, w, true, belt),
        ramp: () => pullUpRamp(),
        primer: [SCAP_PULLUP],
        cue: (w) =>
          deload(w,
            w === 1
              ? "Your #2 lift. You did +60 × 3, 3, 3, 3, 3 on Nov 15, all five sets, so +65 now. Scapular pull-ups first. Dead hang, shoulders down first, chin clearly over. Last set AMRAP, 1 clean rep left. Every set at 3+ → +5; a miss repeats. Your Aug 10 best is +70 × 3."
              : "You did +65 × 3, 3, 2 then +62.5 × 3, 3 on Nov 22: one set short and two sets dropped, so +65 repeats. Scapular pull-ups first. Dead hang, shoulders down first, chin clearly over. Last set AMRAP, 1 clean rep left. Every set at 3+ → +5; a miss repeats. Your Aug 10 best is +70 × 3."),
      },
      {
        name: "Chest-Supported Row (Nautilus Upper Back Row)", hevyTitle: "Nautilus Upper Back Row", tier: "T2", restSeconds: 0, superset: "A",
        rx: (w) => ({ sets: acc(w), reps: 6, repsLabel: "6–10", weightLb: 140, loadLabel: "140 lb" }),
        cue: "Superset with the single-arm row: upper back row, then straight into the single-arm row, rest 90 s. Chest on the pad so the lower back rests before Monday. You did 130 × 8, 8, 8 on Nov 15, then 140 × 6, 6, 6 on Nov 22. Stay at 140 until all 3 sets hit 10, then add weight.",
      },
      {
        name: "Single-Arm Cable Row", hevyTitle: "Single Arm Cable Row", tier: "T3", restSeconds: 90, superset: "A",
        rx: (w) => ({ sets: acc(w), reps: 8, repsLabel: "8–10 / arm", weightLb: 66, loadLabel: "66 lb" }),
        cue: "Superset with the upper back row. Reach long, then pull the elbow to the hip without twisting. You did 66 × 8, 8, 8 on Nov 22, so stay at 66 until all 3 sets hit 10. The single-arm machine row (120 × 8, 8 on Nov 8) is a fine swap.",
      },
      {
        name: "DB Lateral Raise", hevyTitle: "Lateral Raise (Dumbbell)", tier: "T3", restSeconds: 0, superset: "B",
        rx: (w) => ({ sets: acc(w), reps: 10, repsLabel: "10–15", weightLb: 20, loadLabel: "20s" }),
        cue: "Superset with the pec fly: raise, then straight into the fly, rest 60 s. You did 20s × 11, 11, 11 on Nov 22. Build to 15 before going up. Drop to 15s if form breaks.",
      },
      {
        name: "Pec Fly", hevyTitle: "Nautilus Pec Fly", tier: "T3", restSeconds: 60, superset: "B",
        rx: (w) => ({ sets: acc(w), reps: 10, repsLabel: "10–12", weightLb: 50, loadLabel: "50 lb" }),
        cue: "Takes the place of an incline press: chest work that leaves the triceps and elbow fresh for Monday's bench volume, the next day. Slight elbow bend, 1 s squeeze, stop the stretch before the shoulder feels pulled. You did 50 × 8, 8, 10 on Oct 23. Build to 12, then 55.",
      },
      {
        name: "Decline Sit-up + Press", hevyTitle: "Decline Crunch (Weighted)", tier: "CORE", restSeconds: 0, superset: "C",
        rx: (w) => ({ sets: acc(w), reps: 10, repsLabel: "10–12", weightLb: 45, loadLabel: "45 lb plate" }),
        cue: "Superset with the cable push-pull. Hold the plate on the chest, sit up under control, then press it overhead at the top. You did 45 × 11, 11, 11 on Nov 22. Build to 12 at 45.",
      },
      {
        name: "Cable Push Pull", hevyTitle: "Cable Push Pull", tier: "CORE", restSeconds: 60, superset: "C",
        rx: (w) => ({ sets: acc(w), reps: 10, weightLb: 20, loadLabel: "20 lb" }),
        cue: "Superset with the decline sit-up. Stay braced and turn from the trunk with control, the paddle pattern. You did 20 × 8, 8, 8 on Nov 15. Build to 10, then 25.",
      },
    ],
  },
];

/** The exercises a day actually has in a given week (drops week-limited make-ups from other weeks). */
export function exercisesFor(day: ProgramDay, week: number): ProgramExercise[] {
  return day.exercises.filter((ex) => !ex.weeks || ex.weeks.includes(week));
}

/** Label like "A1" / "A2" for an exercise inside a superset group, or null when it is not in one. */
export function supersetPosition(list: ProgramExercise[], index: number): string | null {
  const tag = list[index].superset;
  if (!tag) return null;
  let n = 1;
  for (let i = index - 1; i >= 0 && list[i].superset === tag; i--) n++;
  return `${tag}${n}`;
}

/** Custom Hevy exercises this program needs that aren't in Hevy's built-in library. */
export const CUSTOM_HEVY_EXERCISES: {
  title: string;
  type: "reps_only" | "duration";
  primary_muscle_group: string;
  equipment: string;
}[] = [
  { title: "Isometric Wrist Extension", type: "duration", primary_muscle_group: "forearms", equipment: "dumbbell" },
  { title: "Isometric Wrist Flexion", type: "duration", primary_muscle_group: "forearms", equipment: "dumbbell" },
  { title: "Wrist Extensor & Flexor Stretch", type: "duration", primary_muscle_group: "forearms", equipment: "none" },
  { title: "Half-Kneeling Hip Flexor Stretch", type: "duration", primary_muscle_group: "quadriceps", equipment: "none" },
  { title: "Supine Hamstring Strap Stretch", type: "duration", primary_muscle_group: "hamstrings", equipment: "other" },
  { title: "90/90 Hip Hold", type: "duration", primary_muscle_group: "glutes", equipment: "none" },
  { title: "Open Book Rotation", type: "reps_only", primary_muscle_group: "upper_back", equipment: "none" },
  { title: "Doorway Pec Stretch", type: "duration", primary_muscle_group: "chest", equipment: "none" },
  { title: "Lat Stretch", type: "duration", primary_muscle_group: "lats", equipment: "none" },
  { title: "Knee-to-Wall Ankle Stretch", type: "duration", primary_muscle_group: "calves", equipment: "none" },
  { title: "World's Greatest Stretch", type: "reps_only", primary_muscle_group: "full_body", equipment: "none" },
  { title: "Pigeon Pose", type: "duration", primary_muscle_group: "glutes", equipment: "none" },
  { title: "Deep Squat Hold", type: "duration", primary_muscle_group: "quadriceps", equipment: "none" },
  { title: "Inchworm", type: "reps_only", primary_muscle_group: "full_body", equipment: "none" },
];

// ---------------------------------------------------------------------------
// Display helpers (shared by the page and the Hevy notes)
// ---------------------------------------------------------------------------

export function schemeLabel(p: Prescription): string {
  const reps = p.repsLabel ?? (p.seconds ? `${p.seconds} s` : p.meters ? `${p.meters} m` : String(p.reps ?? ""));
  return `${p.sets} × ${reps}`;
}

export function rampLabel(sets: RampSet[]): string {
  return sets
    .map((s) => {
      const w = s.weightLb === BAR ? "bar" : s.weightLb === 0 ? "BW" : s.weightLb == null ? "" : String(s.weightLb);
      return `${w}×${s.reps ?? `${s.seconds}s`}`;
    })
    .join(" · ");
}

export function cueFor(ex: ProgramExercise, week: number): string {
  return typeof ex.cue === "function" ? ex.cue(week) : ex.cue;
}

export function restLabel(seconds: number): string {
  if (seconds === 0) return "";
  if (seconds >= 150) return "2:30";
  if (seconds >= 120) return "2 min";
  if (seconds >= 75) return "60–90 s";
  return `${seconds} s`;
}

/** Calendar date for a day of a week, as YYYY-MM-DD (no timezone math — the program is date-based). */
export function dayDate(week: number, day: ProgramDay): string {
  const [y, m, d] = PROGRAM_START.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + (week - 1) * 7 + day.offset));
  return date.toISOString().slice(0, 10);
}

/** Which program week a calendar date (YYYY-MM-DD) falls in: 0 before the start, 7 after the end. */
export function weekForDate(isoDate: string): number {
  const start = Date.parse(`${PROGRAM_START}T00:00:00Z`);
  const days = Math.floor((Date.parse(`${isoDate}T00:00:00Z`) - start) / 86_400_000);
  if (days < 0) return 0;
  return Math.min(PROGRAM_WEEKS + 1, Math.floor(days / 7) + 1);
}

export function hevyRoutineTitle(week: number, day: ProgramDay): string {
  return day.repeatsWeekly
    ? `${ROUTINE_PREFIX} ${day.key} · ${day.title}`
    : `${ROUTINE_PREFIX} W${week} ${day.key} · ${day.title}`;
}
