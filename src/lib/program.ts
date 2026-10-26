// The "Comeback Block" — a fixed 6-week lifting program (Oct 5 – Nov 15, 2026).
//
// This file is the single source of truth for the program: the
// /dashboard/program page renders it, and scripts/push-comeback-block.ts
// turns it into Hevy routines. Loads are in pounds (how the athlete trains);
// the Hevy push converts to kg. Kept dependency-free so the push script can
// import it with a plain relative path.
//
// Bench follows the day order from Zourdos et al. 2016 (volume → lighter
// middle day → heavy) at 3×/week; squat, deadlift and pull-up use GZCLP's
// T1 (5×3+) / T2 (3×10) tiers. Starting loads come from the athlete's Hevy
// logs between Sep 18 and Oct 2, 2026.

export const PROGRAM_NAME = "Comeback Block";
export const PROGRAM_START = "2026-10-05"; // Monday of week 1
export const PROGRAM_WEEKS = 6;
export const HEVY_FOLDER_TITLE = "Comeback Block";

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
  /** Accessories sharing a tag (adjacent in the list) are done as a superset: A1, A2, A1, A2... Never used on the main lifts. */
  superset?: string;
  /** Only programmed in these weeks (a one-off make-up). Omitted = every week. */
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
  note: string;
  warmup: ProgramExercise[];
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

// ---------------------------------------------------------------------------
// Bench, 3 days a week (Zourdos 2016 day order)
// ---------------------------------------------------------------------------

/** Monday volume: [sets, reps, lb]. */
const BENCH_VOLUME: [number, number, number][] = [
  [4, 8, 135], [4, 8, 135], [4, 8, 140], [3, 8, 145], [3, 8, 150], [2, 5, 140],
];
/** Wednesday paused: [sets, reps, lb]. */
const BENCH_PAUSED: [number, number, number][] = [
  [4, 5, 130], [4, 5, 130], [4, 5, 135], [4, 4, 140], [3, 4, 145], [3, 3, 135],
];
/** Friday heavy 5×3+; week 6 is a max test. Week 1 AMRAP was 7 reps (+5 lb from week 2) and week 2 was 160 × 7 again, so the 6+ rep rule adds another 5 lb from week 3. */
const BENCH_HEAVY: (number | null)[] = [150, 160, 170, 175, 180, null];

/** Wednesday squat 3×10: held at 135 in week 2 because only 2 of 3 sets were done in week 1; week 2 was 145 × 10, 10, 10 (planned 135) and week 3 was 155 × 10, 10, 10 (planned 150), so +5 a week from there. */
const SQUAT_VOLUME = [135, 145, 155, 160, 165, 135];

/** Friday deadlift 5×3+: week 1 was 225 × 3, 3, 3, 3, 6, well above the planned 190, so the ladder restarted from there. Week 2's 235 was skipped (no deadlift logged Oct 16), so week 3 repeats 235 and the ladder ends at 260. */
const DEADLIFT_T1 = [225, 235, 235, 245, 255, 260];

/** Friday pull-up 3×10, added load in lb: week 2 stayed bodyweight (11, 11, 8) and week 3 was BW × 11, 11, 11 (the +5 was not added), so +5 starts in week 4. */
const PULLUP_T2 = [0, 0, 5, 5, 10, 15];

/** Sunday weighted pull-up 5×3+, added load in lb: week 1 was +45; weeks 2 and 3 were skipped, so week 4 repeats +50. */
const PULLUP_T1 = [45, 50, 50, 50, 55, 60];

/** Monday squat 5×3+: week 1 was 160 with an 8-rep AMRAP, so week 2 jumped; week 2 was 185 (planned 175) with another 8-rep AMRAP, week 3 was 205 (planned 195) with a 5-rep AMRAP, so +5 a week from there. */
const SQUAT_T1 = [160, 185, 205, 210, 215, 220];

const BENCH_TEST_RAMP: RampSet[] = [
  { weightLb: BAR, reps: 10 },
  { weightLb: 135, reps: 3 },
  { weightLb: 165, reps: 1 },
];

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
const FIRE_HYDRANT = prep("Fire Hydrant", "Fire Hydrants", 1, 8, "8 / side",
  "On all fours, lift the knee out to the side without rotating the hips. Wakes up the glutes before squats and pulls.");
const PULL_APART = prep("Banded Pull Apart", "Band Pullaparts", 1, 15, "15",
  "Arms straight, pull the band to your chest by squeezing the shoulder blades. Wakes up the rear delts before pressing.");
const DEAD_BUG = prep("Dead Bug", "Dead Bug", 1, 6, "6 / side",
  "Low back flat on the floor, extend the opposite arm and leg slowly. Bracing practice for heavy pulls.");
const SCAP_PULLUP = prep("Scapular Pull-up", "Scapular Pull Ups", 1, 8, "8",
  "Hang from the bar, arms straight, pull the shoulder blades down without bending the elbows. Primes the lats right before pull-ups.");

// Gym warm-up: row, then the same four floor moves every day. Bench days add the banded pull apart.
const GYM_WARMUP = [EASY_ROW, CAT_CAMEL, THREAD_NEEDLE, BIRD_DOG, FIRE_HYDRANT];
const MON_WARMUP = [...GYM_WARMUP, PULL_APART];
const WED_WARMUP = [...GYM_WARMUP, PULL_APART];
const THU_WARMUP = [BIRD_DOG, DEAD_BUG];
const FRI_WARMUP = [...GYM_WARMUP, PULL_APART];
const SUN_WARMUP = GYM_WARMUP;

/** The one-line warm-up summary shown above a day's exercises. */
function warmupNote(warmup: ProgramExercise[]): string {
  const list = warmup
    .filter((ex) => ex !== EASY_ROW)
    .map((ex) => `${ex.name} ${ex.rx(1).repsLabel}`)
    .join(" · ");
  return `Warm-up (≈5 min, 1 set each): 2 min easy row or bike → ${list} → 1–2 ramp sets on the first lift.`;
}

/** Hevy sets for a warm-up move, one per prescribed set. */
export function warmupSets(ex: ProgramExercise): RampSet[] {
  const { sets, reps, seconds } = ex.rx(1);
  return Array.from({ length: sets }, () => ({ weightLb: null, reps, seconds }));
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export const PROGRAM_DAYS: ProgramDay[] = [
  {
    key: "Mon", offset: 0, title: "Bench volume · Squat · DB press", paddle: true, minutes: 65, repeatsWeekly: false,
    note: warmupNote(MON_WARMUP),
    warmup: MON_WARMUP,
    exercises: [
      {
        name: "Bench Press · volume", hevyTitle: "Bench Press (Barbell)", tier: "T1", restSeconds: 120,
        rx: (w) => {
          const [sets, reps, load] = BENCH_VOLUME[w - 1];
          return { sets, reps, weightLb: load, loadLabel: lb(load) };
        },
        ramp: (w) => barRamp(BENCH_VOLUME[w - 1][2]),
        cue: (w) =>
          w === 6
            ? "Taper week: lighter and fewer reps so you're fresh for Friday's test."
            : w === 2
              ? "You did 135 × 8, 8, 8, 5 on Oct 5, so the 4th set was short. Repeat 135 and get all four sets to 8 before going up. (Done: 135 × 8, 8, 8, 8 on Oct 12.)"
              : w === 3
                ? "All four sets hit 8 at 135 on Oct 12, so +5 lb. Aim for 8 on every set. If a set drops to 6–7, keep the weight next week until every set hits 8."
                : "Aim for 8 on every set. If a set drops to 6–7, keep the weight next week until every set hits 8.",
      },
      {
        name: "Leg Press · back-injury sub", hevyTitle: "Leg Press (Machine)", tier: "T2", restSeconds: 120, weeks: [4],
        rx: fixed({ sets: 4, reps: 10, repsLabel: "8–10", weightLb: 180, loadLabel: "start 180 lb" }),
        ramp: () => [{ weightLb: 90, reps: 10 }],
        cue: "Replaces the back squat this week for the lower back. Back and hips flat on the pad, feet mid-platform, lower only until the hips would start to tuck under, then press. Stop 3 reps shy and keep every rep pain-free: if the back goes over 3/10, drop the weight. 180 is a conservative start from your 2022 logs (220 × 12), so tell me how it felt and I'll adjust.",
      },
      {
        name: "Back Squat", hevyTitle: "Squat (Barbell)", tier: "T1", restSeconds: 150, weeks: [1, 2, 3, 5, 6],
        rx: (w) => ({ sets: 5, reps: 3, repsLabel: "3+", weightLb: SQUAT_T1[w - 1], loadLabel: lb(SQUAT_T1[w - 1]) }),
        ramp: (w) => barRamp(SQUAT_T1[w - 1]),
        cue: (w) =>
          w === 2
            ? "You did 160 × 3, 3, 3, 3, 8 on Oct 5, then 185 × 3, 3, 3, 3, 8 on Oct 12 (10 lb above the plan). Brace before every rep, hit depth. Last set AMRAP, stopping 1 rep shy."
            : w === 3
              ? "You did 205 × 3, 3, 3, 3, 5 on Oct 19 (10 lb above the plan). Brace before every rep, hit depth, drive up. Last set AMRAP, stopping 1 rep shy. If you get fewer than 3 on the last set, repeat the weight next week."
              : w === 4
                ? "205 × 5 on the AMRAP was the right call, so +5 lb a week from here. Brace before every rep, hit depth, drive up. Last set AMRAP, stopping 1 rep shy. If you get fewer than 3 on the last set, repeat the weight next week."
                : "Brace before every rep, hit depth, drive up. Last set AMRAP, stopping 1 rep shy. If you get fewer than 3 on the last set, repeat the weight next week.",
      },
      {
        name: "Seated DB Shoulder Press", hevyTitle: "Shoulder Press (Dumbbell)", tier: "T2", restSeconds: 120,
        rx: fixed({ sets: 3, reps: 8, repsLabel: "8–10", weightLb: 40, loadLabel: "start 40s" }),
        cue: "Bench at 80–90°, back on the pad. Dumbbells let your wrists and elbows rotate naturally, which is easier on the elbow than a barbell. You did 40s × 8, 8, 8 on Oct 12, then 40s × 10, 10 on Oct 19 (only two sets). Get all 3 sets to 10 at 40s, then go to 45s.",
      },
      {
        name: "Chest-Supported Row · make-up", hevyTitle: "Nautilus Upper Back Row", tier: "T2", restSeconds: 90, weeks: [3],
        rx: fixed({ sets: 3, reps: 8, repsLabel: "8–12", weightLb: 100, loadLabel: "100 lb" }),
        cue: "One-off make-up for the skipped Oct 18 Sunday row (done: 110 × 10, then 120 × 8, 8 on Oct 19). Chest on the pad.",
      },
      {
        name: "Seated Leg Curl", hevyTitle: "Seated Leg Curl (Machine)", tier: "T3", restSeconds: 75,
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10–15", weightLb: 110, loadLabel: "start 110 lb" }),
        cue: "Hamstrings and knee health. 2 s squeeze, slow return. You did 100 × 10 × 3 on Oct 5, then 110 × 10, 10, 6 on Oct 12. Stay at 110 until all 3 sets hit 10.",
      },
      {
        name: "Triceps Rope Pushdown", hevyTitle: "Triceps Rope Pushdown", tier: "T3", restSeconds: 0, superset: "A",
        rx: fixed({ sets: 3, reps: 8, repsLabel: "8–12", weightLb: 44, loadLabel: "start 44 lb" }),
        cue: "Superset with the reverse wrist curl: pushdown, then straight into the wrist curl, rest 60 s. Elbows pinned to the ribs, taking the lateral raise's slot. You did 33 × 12, 12, 12 on Oct 12, then 44 × 6, 8, 8 on Oct 19, so stay at 44 and build reps to 12 before adding weight. Stop the set if the elbow goes over 3/10.",
      },
      {
        name: "Reverse Wrist Curl", hevyTitle: "Reverse Wrist Curl", tier: "ELBOW", restSeconds: 60, superset: "A",
        rx: fixed({ sets: 3, reps: 15, weightLb: 10, loadLabel: "start 10 lb" }),
        cue: "Forearm on thigh, palm down. Superset with the pushdown. Lift in 1 s, lower in 3 s. Wrist extensors. Pain ≤3/10. You did 10 lb × 10 × 3 on Oct 5, then 10 × 12, 12 on Oct 12. Get all 3 sets to 15 before adding weight.",
      },
    ],
  },
  {
    key: "Wed", offset: 2, title: "Paused bench · Squat volume", paddle: true, minutes: 60, repeatsWeekly: false,
    note: warmupNote(WED_WARMUP),
    warmup: WED_WARMUP,
    exercises: [
      {
        name: "Paused Bench Press", hevyTitle: "Paused Bench Press (Barbell)", tier: "T1", restSeconds: 120,
        rx: (w) => {
          const [sets, reps, load] = BENCH_PAUSED[w - 1];
          return { sets, reps, weightLb: load, loadLabel: lb(load) };
        },
        ramp: (w) => barRamp(BENCH_PAUSED[w - 1][2]),
        cue: (w) =>
          w === 6
            ? "Light week before Friday's test. Crisp pauses, nothing hard."
            : "Full 2 s pause on the chest with no sinking or bounce, then press. Builds strength off the chest, where most bench misses happen. You did paused 115 × 10 × 3 in February.",
      },
      {
        name: "Leg Extension · back-injury sub", hevyTitle: "Leg Extension (Machine)", tier: "T2", restSeconds: 90, weeks: [4],
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10–12", weightLb: 130, loadLabel: "start 130 lb" }),
        cue: "Replaces the squat volume this week: quads with no load on the spine. 1 s squeeze at the top, 3 s down. You last logged 170 × 10 in 2023 and 150 × 10 in 2022, so 130 is an easy re-entry. Leave 2 in the tank, since you paddle tonight.",
      },
      {
        name: "Back Squat", hevyTitle: "Squat (Barbell)", tier: "T2", restSeconds: 150, weeks: [1, 2, 3, 5, 6],
        rx: (w) => ({ sets: 3, reps: 10, weightLb: SQUAT_VOLUME[w - 1], loadLabel: lb(SQUAT_VOLUME[w - 1]) }),
        ramp: () => [{ weightLb: BAR, reps: 10 }],
        cue: (w) =>
          w === 2
            ? "You did 135 × 10, 10 on Oct 7, then 145 × 10, 10, 10 on Oct 14 and 155 × 10, 10, 10 on Oct 21. Leave 2 in the tank, since you paddle tonight."
            : "Leave 2 in the tank, since you paddle tonight. Get all 3 sets of 10 before the weight goes up.",
      },
      {
        name: "Smith Incline Press", hevyTitle: "Incline Bench Press (Smith Machine)", tier: "T2", restSeconds: 0, superset: "A",
        rx: fixed({ sets: 3, reps: 8, repsLabel: "8–10", weightLb: 85, loadLabel: "start 85 lb" }),
        cue: "Superset with the overhead triceps extension: press, then straight into the extension, rest 90 s. Upper chest, a different angle from flat bench. You did 80 × 8, 8, 8 on Oct 14, then 80 × 10, 10, 10 on Oct 21, so +5 lb. When all 3 sets hit 10 again, add 5 lb. Incline DB press (50s) also works.",
      },
      {
        name: "Overhead Triceps Extension", hevyTitle: "Overhead Triceps Extension (Cable)", tier: "T3", restSeconds: 90, superset: "A",
        rx: fixed({ sets: 3, reps: 8, repsLabel: "8–12", weightLb: 28, loadLabel: "start 28 lb" }),
        cue: "Replaces the rope pushdown on Wednesdays. Superset with the incline press. Elbows high and still, full stretch behind the head. You did 28 × 10, 8, 8 on Oct 21, so stay at 28 and build to 12 before adding weight. Stop the set if the elbow goes over 3/10.",
      },
      {
        name: "Rear Delt Fly", hevyTitle: "Nautilus Rear Delt Fly", tier: "T3", restSeconds: 0, superset: "B",
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10–15", weightLb: 40, loadLabel: "start 40 lb" }),
        cue: "Replaces the face pull (you swapped it in on Oct 14 and Oct 21). Superset with the forearm rotation. Chest on the pad, lead with the elbows. You did 30–40 × 10 on Oct 14 and 40 × 10, 10, 10 on Oct 21, so build to 15 before adding weight. Rear delt and scapular work keeps the shoulders healthy under 3 bench days.",
      },
      {
        name: "DB Forearm Rotation", hevyTitle: "Kettle Bell Wrist Rotation", tier: "ELBOW", restSeconds: 60, superset: "B",
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12 / way", weightLb: 12, loadLabel: "start 12 lb" }),
        cue: "Superset with the rear delt fly. Hold a DB at one end, elbow at 90°. Rotate palm up then palm down, 3 s each way. Choke up to make it easier. You did 10 lb × 12, 12 on Oct 14, then 10 lb × 15, 15 on Oct 21, so 12 lb. Get all 3 sets to 12 before adding weight.",
      },
    ],
  },
  {
    key: "Thu", offset: 3, title: "Home mobility + elbow", paddle: false, minutes: 40, repeatsWeekly: true,
    note: "Start with bird dog and dead bug (1 set each, 6 per side) to wake up the trunk. You need a mat, a strap or towel, and a light DB or band. A foam roller is optional.",
    warmup: THU_WARMUP,
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
    key: "Fri", offset: 4, title: "Bench heavy · Deadlift · Pull-up", paddle: false, minutes: 65, repeatsWeekly: false,
    note: warmupNote(FRI_WARMUP),
    warmup: FRI_WARMUP,
    exercises: [
      {
        name: "Bench Press · heavy", hevyTitle: "Bench Press (Barbell)", tier: "T1", restSeconds: 120,
        rx: (w) => {
          const load = BENCH_HEAVY[w - 1];
          return load === null
            ? { sets: 1, reps: 1, repsLabel: "1 (test)", weightLb: null, loadLabel: "top single" }
            : { sets: 5, reps: 3, repsLabel: "3+", weightLb: load, loadLabel: lb(load) };
        },
        ramp: (w) => {
          const load = BENCH_HEAVY[w - 1];
          return load === null ? BENCH_TEST_RAMP : barRamp(load);
        },
        cue: (w) =>
          w === 6
            ? "Opener ≈95% of the max estimated from Week 5's AMRAP set (weight × (1 + reps ÷ 30)), then 1–2 attempts of +5–10 lb. Your spring best is 225."
            : w === 2
              ? "You did 150 × 3, 3, 3, 3, 7 on Oct 9, then 160 × 3, 3, 3, 3, 7 on Oct 16. Both 7-rep AMRAPs triggered the +5 lb rule. Last set AMRAP, 1 clean rep left."
              : w === 3
                ? "Second 7-rep AMRAP in a row at 160, so the +5 lb rule adds an extra 5: 170 this week, then 175 / 180. Last set AMRAP, 1 clean rep left."
                : w === 4
                  ? "You did 170 × 3, 3 then 175 × 3, 3, 3 on Oct 23, so the plan stands at 175. With the sore back, keep the arch modest, feet planted and glutes on the bench. Last set AMRAP, 1 clean rep left. If the back complains, stop at 5 × 3 with no AMRAP."
                : "Last set AMRAP, 1 clean rep left. If you get 6+ reps, add an extra 5 lb to every bench number from next week. If you miss reps, repeat the weight as 6 × 2.",
      },
      {
        name: "Glute Bridge · back-injury sub", hevyTitle: "Glute Bridge", tier: "T2", restSeconds: 90, weeks: [4],
        rx: fixed({ sets: 4, reps: 12, repsLabel: "12–15", weightLb: null, loadLabel: "bodyweight" }),
        cue: "Replaces the deadlift this week. Feet flat, ribs down, squeeze the glutes to lift the hips until the body is in a straight line (don't arch the low back), 2 s hold, lower slowly. Keeps the glutes and hamstrings working without loading the spine. When 4 × 15 is easy, hold a dumbbell on the hips.",
      },
      {
        name: "Deadlift (conventional)", hevyTitle: "Deadlift (Barbell)", tier: "T1", restSeconds: 150, weeks: [1, 2, 3, 5, 6],
        rx: (w) => ({ sets: 5, reps: 3, repsLabel: "3+", weightLb: DEADLIFT_T1[w - 1], loadLabel: lb(DEADLIFT_T1[w - 1]) }),
        ramp: (w) => dlRamp(DEADLIFT_T1[w - 1]),
        cue: (w) =>
          w === 2
            ? "You did 225 × 3, 3, 3, 3, 6 on Oct 9. No deadlift was logged on Oct 16, so this step was skipped. Reset every rep: bar over mid-foot, lats tight, push the floor away. Last set AMRAP, 1 clean rep left."
            : w === 3
              ? "Repeat 235 since week 2's deadlift was skipped. Reset every rep: bar over mid-foot, lats tight, push the floor away. Last set AMRAP, 1 clean rep left. If the AMRAP is under 3, repeat the weight as 6 × 2."
              : "Reset every rep: bar over mid-foot, lats tight, push the floor away. Last set AMRAP, 1 clean rep left. If the AMRAP is under 3, repeat the weight as 6 × 2.",
      },
      {
        name: "Pull-up", hevyTitle: "Pull Up (Weighted)", tier: "T2", restSeconds: 120,
        rx: (w) => ({ sets: 3, reps: 10, weightLb: PULLUP_T2[w - 1], loadLabel: belt(PULLUP_T2[w - 1]) }),
        primer: [SCAP_PULLUP],
        cue: (w) =>
          w === 2
            ? "You did BW × 10, 10, 10 on Oct 9, then BW × 11, 11, 8 on Oct 16 (the +5 lb was not added). Do the scapular pull-ups first, then overhand, dead hang to chin over the bar."
            : w === 3
              ? "Third set dropped to 8 last week, so +5 lb starts now: aim for 10 on every set. Scapular pull-ups first, then overhand, dead hang to chin over the bar. If you miss reps, keep the weight as 3 × 8."
              : w === 4
                ? "You did BW × 11, 11, 11 on Oct 23 without the planned +5, so +5 lb starts now. Scapular pull-ups first, then overhand, dead hang to chin over the bar, no swinging or kipping with the sore back. If you miss reps, keep the weight as 3 × 8."
                : "Scapular pull-ups first, then overhand, dead hang to chin over the bar. +5 lb a week. If you miss reps, keep the weight as 3 × 8.",
      },
      {
        name: "Side Plank · back-injury sub", hevyTitle: "Side Plank", tier: "CORE", restSeconds: 0, superset: "A", weeks: [4],
        rx: fixed({ sets: 3, seconds: 20, repsLabel: "20 s / side", weightLb: null, loadLabel: "bodyweight" }),
        cue: "Replaces the back extension this week. Superset with the wrist curl: side plank both sides, then straight into the wrist curl, rest 60 s. Knees bent is fine. Hips stacked and lifted, neutral spine. One of the McGill Big 3 for low-back endurance.",
      },
      {
        name: "45° Back Extension", hevyTitle: "Back Extension (Weighted Hyperextension)", tier: "T3", restSeconds: 0, superset: "A", weeks: [1, 2, 3, 5, 6],
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10–15", weightLb: 45, loadLabel: "start 45 lb" }),
        cue: "Superset with the wrist curl: back extension, then straight into the wrist curl, rest 60 s. Hinge at the hips with a neutral spine and a 2 s hold at the top. You did 45 × 10, 10 on Oct 9, then 45 × 11, 11, 11 on Oct 16. Build to 3 × 15 before adding weight. Back endurance for the boat.",
      },
      {
        name: "Wrist Curl", hevyTitle: "Wrist Curl", tier: "ELBOW", restSeconds: 60, superset: "A",
        rx: fixed({ sets: 3, reps: 15, weightLb: 15, loadLabel: "start 15 lb" }),
        cue: "Superset with the back extension. Forearm on thigh, palm up. Lift in 1 s, lower in 3 s. Wrist flexors. Physio had you at 15 × 12 in February. You did 20 × 6, 6 on Oct 16, which was too heavy for this rep range, so go back to 15 and get 3 × 15.",
      },
    ],
  },
  {
    key: "Sun", offset: 6, title: "Pull-up heavy · Row", paddle: false, minutes: 60, repeatsWeekly: false,
    note: warmupNote(SUN_WARMUP),
    warmup: SUN_WARMUP,
    exercises: [
      {
        name: "Weighted Pull-up", hevyTitle: "Pull Up (Weighted)", tier: "T1", restSeconds: 120,
        rx: (w) => ({ sets: 5, reps: 3, repsLabel: "3+", weightLb: PULLUP_T1[w - 1], loadLabel: belt(PULLUP_T1[w - 1]) }),
        ramp: () => pullUpRamp(),
        primer: [SCAP_PULLUP],
        cue: (w) =>
          w === 1
            ? "You did +45 × 3, 3, 3, 3 on Oct 11 (20 lb above the plan) and skipped the AMRAP set, so the ladder starts from +45."
            : w === 2
              ? "Skipped on Oct 18, so week 3 repeats this +50. Scapular pull-ups first. Dead hang, shoulders down first, chin clearly over. Last set AMRAP, 1 clean rep left."
              : w === 4
                ? "Skipped again on Oct 25, so week 4 repeats +50. Scapular pull-ups first, controlled reps with no swinging, since the lower back is sore. Dead hang, shoulders down first, chin clearly over. Last set AMRAP, 1 clean rep left. If the belt or the hang bothers the back, drop the load and do 3 × 5 at bodyweight."
                : "Your #2 lift. Scapular pull-ups first. Dead hang, shoulders down first, chin clearly over. Last set AMRAP, 1 clean rep left. You did +45 × 3, 3, 3, 3 on Oct 11 and skipped the AMRAP, so do the 5th set this time. +5 lb a week; your Aug 10 best was +70 × 3.",
      },
      {
        name: "Chest-Supported Row (Nautilus Upper Back Row)", hevyTitle: "Nautilus Upper Back Row", tier: "T2", restSeconds: 120,
        rx: fixed({ sets: 3, reps: 8, repsLabel: "8–12", weightLb: 120, loadLabel: "start 120 lb" }),
        cue: "Chest on the pad so the lower back rests before Monday. You did 100 × 10 × 3 on Sep 28, then 110 × 10 and 120 × 8, 8 on Oct 19. Start at 120 and build to 12 reps on all 3 sets before going up.",
      },
      {
        name: "DB Lateral Raise", hevyTitle: "Lateral Raise (Dumbbell)", tier: "T3", restSeconds: 0, superset: "A",
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12–15", weightLb: 15, loadLabel: "start 15s" }),
        cue: "Superset with the incline curl: raise, then straight into the curl, rest 60 s. The only lateral raise day of the week (not on Monday, so the side delts get a full day off after this). Bench covers your front delts. You did 15s × 12 × 3 on Oct 5. Build to 15s × 15, then go up.",
      },
      {
        name: "Incline DB Curl", hevyTitle: "Seated Incline Curl (Dumbbell)", tier: "T3", restSeconds: 60, superset: "A",
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10–15", weightLb: 15, loadLabel: "start 15s" }),
        cue: "Superset with the lateral raise. Slow 3 s lowering, no swinging. Stop the set if the elbow goes over 3/10.",
      },
      {
        name: "Half-Kneeling Pallof Press", hevyTitle: "Cable Core Pallof Press", tier: "CORE", restSeconds: 0, superset: "B",
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12 / side", weightLb: null, loadLabel: "light cable" }),
        cue: "Superset with the woodchop. Press out, hold 3 s, and don't let the cable twist you. Resists rotation.",
      },
      {
        name: "Dead Bug · back-injury sub", hevyTitle: "Dead Bug", tier: "CORE", restSeconds: 45, superset: "B", weeks: [4],
        rx: fixed({ sets: 3, reps: 8, repsLabel: "8 / side", weightLb: null, loadLabel: "bodyweight" }),
        cue: "Replaces the woodchop this week, since loaded rotation is the wrong thing for a sore back. Superset with the Pallof press. Low back flat on the floor, extend the opposite arm and leg slowly.",
      },
      {
        name: "Cable Woodchop (high → low)", hevyTitle: "Cable Twist (Up to down)", tier: "CORE", restSeconds: 45, superset: "B", weeks: [1, 2, 3, 5, 6],
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10 / side", weightLb: null, loadLabel: "moderate" }),
        cue: "Superset with the Pallof press. Turn from the hips with the spine braced. It's the paddle stroke pattern done with control.",
      },
      {
        name: "Suitcase Carry", hevyTitle: "Suitcase Carry (Dumbbell)", tier: "CORE", restSeconds: 60,
        rx: (w) => ({ sets: 3, meters: 40, repsLabel: "40 m / side", weightLb: w === 4 ? 45 : 55, loadLabel: w === 4 ? "45 lb (lighter)" : "start 55 lb" }),
        cue: (w) =>
          w === 4
            ? "Lighter this week (45 lb) for the sore back. Walk tall with no lean. If the back goes over 3/10, skip it."
            : "Walk tall with no lean. Works side-to-side stability and grip.",
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
  return day.repeatsWeekly ? `CB ${day.key} · ${day.title}` : `CB W${week} ${day.key} · ${day.title}`;
}
