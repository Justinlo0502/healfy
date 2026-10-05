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
const lin = (start: number, step: number) => (w: number) => start + step * (w - 1);
const lb = (v: number) => `${v} lb`;
const belt = (v: number) => (v === 0 ? "BW" : `+${v} lb`);

function barRamp(work: number): RampSet[] {
  const sets: RampSet[] = [{ weightLb: BAR, reps: 10 }];
  for (const [pct, reps] of [[0.5, 5], [0.7, 3], [0.85, 1]] as const) {
    const v = r5(work * pct);
    if (v > BAR && v < work) sets.push({ weightLb: v, reps });
  }
  return sets;
}

function dlRamp(work: number): RampSet[] {
  const sets: RampSet[] = [{ weightLb: 135, reps: 5 }];
  for (const [pct, reps] of [[0.7, 3], [0.85, 1]] as const) {
    const v = r5(work * pct);
    if (v > (sets[sets.length - 1].weightLb ?? 0) && v < work) sets.push({ weightLb: v, reps });
  }
  return sets;
}

const pullUpRamp = (added: number): RampSet[] =>
  added >= 10 ? [{ weightLb: 0, reps: 5 }, { weightLb: r5(added / 2), reps: 2 }] : [{ weightLb: 0, reps: 5 }];

const fixed = (p: Prescription) => () => p;

// ---------------------------------------------------------------------------
// Bench, 3 days a week (Zourdos 2016 day order)
// ---------------------------------------------------------------------------

/** Monday volume: [sets, reps, lb]. */
const BENCH_VOLUME: [number, number, number][] = [
  [4, 8, 135], [4, 8, 140], [3, 8, 145], [3, 8, 150], [3, 8, 155], [2, 5, 150],
];
/** Wednesday paused: [sets, reps, lb]. */
const BENCH_PAUSED: [number, number, number][] = [
  [4, 5, 130], [4, 5, 135], [4, 4, 140], [4, 4, 145], [3, 4, 150], [3, 3, 140],
];
/** Friday heavy 5×3+; week 6 is a max test. */
const BENCH_HEAVY: (number | null)[] = [150, 155, 160, 165, 170, null];

const BENCH_TEST_RAMP: RampSet[] = [
  { weightLb: BAR, reps: 10 },
  { weightLb: 95, reps: 5 },
  { weightLb: 135, reps: 3 },
  { weightLb: 155, reps: 1 },
  { weightLb: 175, reps: 1 },
];

// ---------------------------------------------------------------------------
// Shared blocks
// ---------------------------------------------------------------------------

const GYM_WARMUP: ProgramExercise[] = [
  {
    name: "Easy row or bike", hevyTitle: "Rowing Machine", tier: "MOBILITY", restSeconds: 0,
    rx: fixed({ sets: 1, seconds: 180, weightLb: null, loadLabel: "easy" }),
    cue: "3 minutes, easy pace. Just raise your temperature.",
  },
  {
    name: "McGill curl-up", hevyTitle: "McGill Curl-Up", tier: "CORE", restSeconds: 0,
    rx: fixed({ sets: 3, reps: 6, repsLabel: "6 · 4 · 2", weightLb: null, loadLabel: "10 s holds" }),
    cue: "One knee bent, hands under the low back. Lift head and shoulders a little and hold 10 s. Do 6 holds, then 4, then 2.",
  },
  {
    name: "Side bridge", hevyTitle: "Side Plank", tier: "CORE", restSeconds: 0,
    rx: fixed({ sets: 3, seconds: 10, repsLabel: "6 · 4 · 2 / side", weightLb: null, loadLabel: "10 s holds" }),
    cue: "Elbow under the shoulder, straight line from ear to ankle. 10 s holds per side: 6, then 4, then 2.",
  },
  {
    name: "Bird dog", hevyTitle: "Bird Dog", tier: "CORE", restSeconds: 0,
    rx: fixed({ sets: 3, reps: 6, repsLabel: "6 · 4 · 2 / side", weightLb: null, loadLabel: "10 s holds" }),
    cue: "Reach the opposite arm and leg out long, hips level. 10 s holds per side: 6, then 4, then 2.",
  },
];

const GYM_NOTE =
  "Warm-up (≈8 min): 3 min easy row or bike → McGill Big 3 (curl-up, side bridge, bird dog), each 6 · 4 · 2 reps of 10 s holds → ramp sets on the first lift.";

/** Hevy sets for the warm-up pyramid (6 · 4 · 2). */
export function warmupPyramid(ex: ProgramExercise): RampSet[] {
  if (ex.hevyTitle === "Rowing Machine") return [{ weightLb: null, seconds: 180 }];
  if (ex.hevyTitle === "Side Plank") return [60, 40, 20].map((seconds) => ({ weightLb: null, seconds }));
  return [6, 4, 2].map((reps) => ({ weightLb: null, reps }));
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------

export const PROGRAM_DAYS: ProgramDay[] = [
  {
    key: "Mon", offset: 0, title: "Bench volume · Squat · DB press", paddle: true, minutes: 65, repeatsWeekly: false,
    note: GYM_NOTE,
    warmup: GYM_WARMUP,
    exercises: [
      {
        name: "Bench Press · volume", hevyTitle: "Bench Press (Barbell)", tier: "T1", restSeconds: 150,
        rx: (w) => {
          const [sets, reps, load] = BENCH_VOLUME[w - 1];
          return { sets, reps, weightLb: load, loadLabel: lb(load) };
        },
        ramp: (w) => barRamp(BENCH_VOLUME[w - 1][2]),
        cue: (w) =>
          w === 6
            ? "Taper week: lighter and fewer reps so you're fresh for Friday's test."
            : w === 1
              ? "Week 1 uses the 135 you just did, now for 4 sets of 8 instead of 3 sets. Aim for 8 on every set. If a set drops to 6–7, keep the weight next week until every set hits 8."
              : "Aim for 8 on every set. If a set drops to 6–7, keep the weight next week until every set hits 8.",
      },
      {
        name: "Back Squat", hevyTitle: "Squat (Barbell)", tier: "T1", restSeconds: 210,
        rx: (w) => ({ sets: 5, reps: 3, repsLabel: "3+", weightLb: lin(160, 10)(w), loadLabel: lb(lin(160, 10)(w)) }),
        ramp: (w) => barRamp(lin(160, 10)(w)),
        cue: "Brace before every rep, hit depth, drive up. Last set AMRAP, stopping 1 rep shy. Your last back squat was 185 × 6 in July, so week 1 is your check-in.",
      },
      {
        name: "Seated DB Shoulder Press", hevyTitle: "Shoulder Press (Dumbbell)", tier: "T2", restSeconds: 120,
        rx: fixed({ sets: 3, reps: 6, repsLabel: "6–10", weightLb: 40, loadLabel: "start 40s" }),
        cue: "Bench at 80–90°, back on the pad. Dumbbells let your wrists and elbows rotate naturally, which is easier on the elbow than a barbell. You did 40s × 8 × 3 on Oct 2. When all 3 sets hit 10, go to 45s.",
      },
      {
        name: "Seated Leg Curl", hevyTitle: "Seated Leg Curl (Machine)", tier: "T3", restSeconds: 75,
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10–15", weightLb: 100, loadLabel: "start 100 lb" }),
        cue: "Hamstrings and knee health. 2 s squeeze, slow return.",
      },
      {
        name: "DB Lateral Raise", hevyTitle: "Lateral Raise (Dumbbell)", tier: "T3", restSeconds: 60,
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12–15", weightLb: 15, loadLabel: "start 15s" }),
        cue: "Lead with the elbows, stop at shoulder height. You did 15s × 12, 10, 10 on Sep 24. Build to 15s × 15, then go up.",
      },
      {
        name: "Reverse Wrist Curl", hevyTitle: "Reverse Wrist Curl", tier: "ELBOW", restSeconds: 60,
        rx: fixed({ sets: 3, reps: 15, weightLb: 10, loadLabel: "start 10 lb" }),
        cue: "Forearm on thigh, palm down. Lift in 1 s, lower in 3 s. Wrist extensors. Pain ≤3/10. Physio had you at 15 × 8 in February.",
      },
    ],
  },
  {
    key: "Wed", offset: 2, title: "Paused bench · Squat volume", paddle: true, minutes: 60, repeatsWeekly: false,
    note: GYM_NOTE,
    warmup: GYM_WARMUP,
    exercises: [
      {
        name: "Paused Bench Press", hevyTitle: "Paused Bench Press (Barbell)", tier: "T1", restSeconds: 150,
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
        name: "Back Squat", hevyTitle: "Squat (Barbell)", tier: "T2", restSeconds: 150,
        rx: (w) => ({ sets: 3, reps: 10, weightLb: lin(135, 10)(w), loadLabel: lb(lin(135, 10)(w)) }),
        ramp: (w) => [{ weightLb: BAR, reps: 10 }, { weightLb: r5(lin(135, 10)(w) * 0.65), reps: 5 }],
        cue: "Leave 2 in the tank, since you paddle tonight.",
      },
      {
        name: "Incline DB Press (30°) or Smith Incline", hevyTitle: "Incline Bench Press (Dumbbell)", tier: "T2", restSeconds: 120,
        rx: fixed({ sets: 3, reps: 6, repsLabel: "6–10", weightLb: 50, loadLabel: "start 50s" }),
        cue: "Upper chest, a different angle from flat bench. You did 50s × 6, 8, 5 on Sep 30. Keep 50s and add reps each week. When all 3 sets hit 10, go to 55s. On the Smith, start around 115.",
      },
      {
        name: "Triceps Rope Pushdown", hevyTitle: "Triceps Rope Pushdown", tier: "T3", restSeconds: 60,
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12–15", weightLb: 35, loadLabel: "start 35 lb" }),
        cue: "Elbows pinned to the ribs. Higher reps here because it's easier on your elbow. You did 35 × 10 and 40 × 8 on Sep 25.",
      },
      {
        name: "Face Pull", hevyTitle: "Face Pull", tier: "T3", restSeconds: 60,
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12–15", weightLb: 30, loadLabel: "start 30 lb" }),
        cue: "Rope to the forehead, thumbs back. Rotator cuff and scapular work help the elbow and keep the shoulders healthy under 3 bench days.",
      },
      {
        name: "DB Forearm Rotation", hevyTitle: "Kettle Bell Wrist Rotation", tier: "ELBOW", restSeconds: 45,
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12 / way", weightLb: 8, loadLabel: "start 8 lb" }),
        cue: "Hold a DB at one end, elbow at 90°. Rotate palm up then palm down, 3 s each way. Choke up to make it easier.",
      },
    ],
  },
  {
    key: "Thu", offset: 3, title: "Home mobility + elbow", paddle: false, minutes: 40, repeatsWeekly: true,
    note: "Start with the McGill Big 3 (curl-up, side bridge, bird dog), the same as the gym warm-up. You need a mat, a strap or towel, and a light DB or band. A foam roller is optional.",
    warmup: GYM_WARMUP.slice(1),
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
    note: GYM_NOTE,
    warmup: GYM_WARMUP,
    exercises: [
      {
        name: "Bench Press · heavy", hevyTitle: "Bench Press (Barbell)", tier: "T1", restSeconds: 210,
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
            : "Last set AMRAP, 1 clean rep left. If you get 6+ reps, add an extra 5 lb to every bench number from next week. If you miss reps, repeat the weight as 6 × 2.",
      },
      {
        name: "Deadlift (conventional)", hevyTitle: "Deadlift (Barbell)", tier: "T1", restSeconds: 210,
        rx: (w) => ({ sets: 5, reps: 3, repsLabel: "3+", weightLb: lin(190, 10)(w), loadLabel: lb(lin(190, 10)(w)) }),
        ramp: (w) => dlRamp(lin(190, 10)(w)),
        cue: "Reset every rep: bar over mid-foot, lats tight, push the floor away. Last set AMRAP, 1 clean rep left. You did 205 × 5, 5 on Oct 2.",
      },
      {
        name: "Pull-up", hevyTitle: "Pull Up (Weighted)", tier: "T2", restSeconds: 150,
        rx: (w) => ({ sets: 3, reps: 10, weightLb: lin(0, 5)(w), loadLabel: belt(lin(0, 5)(w)) }),
        cue: "Overhand, dead hang to chin over the bar. Week 1 is bodyweight (you did BW × 10, 10, 6 on Sep 18), then +5 lb a week. If you miss reps, keep the weight as 3 × 8.",
      },
      {
        name: "45° Back Extension", hevyTitle: "Back Extension (Weighted Hyperextension)", tier: "T3", restSeconds: 75,
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12–15", weightLb: 0, loadLabel: "start BW" }),
        cue: "Hinge at the hips with a neutral spine and a 2 s hold at the top. At 3 × 15, hold a plate. Back endurance for the boat.",
      },
      {
        name: "Wrist Curl", hevyTitle: "Wrist Curl", tier: "ELBOW", restSeconds: 60,
        rx: fixed({ sets: 3, reps: 15, weightLb: 15, loadLabel: "start 15 lb" }),
        cue: "Forearm on thigh, palm up. Lift in 1 s, lower in 3 s. Wrist flexors. Physio had you at 15 × 12 in February.",
      },
    ],
  },
  {
    key: "Sun", offset: 6, title: "Pull-up heavy · Row", paddle: false, minutes: 60, repeatsWeekly: false,
    note: GYM_NOTE,
    warmup: GYM_WARMUP,
    exercises: [
      {
        name: "Weighted Pull-up", hevyTitle: "Pull Up (Weighted)", tier: "T1", restSeconds: 210,
        rx: (w) => ({ sets: 5, reps: 3, repsLabel: "3+", weightLb: lin(25, 5)(w), loadLabel: belt(lin(25, 5)(w)) }),
        ramp: (w) => pullUpRamp(lin(25, 5)(w)),
        cue: "Your #2 lift. Dead hang, shoulders down first, chin clearly over. Last set AMRAP, 1 clean rep left. You did +25 × 8, 8, 5 on Sep 30.",
      },
      {
        name: "Chest-Supported Row (Nautilus Upper Back Row)", hevyTitle: "Nautilus Upper Back Row", tier: "T2", restSeconds: 120,
        rx: fixed({ sets: 3, reps: 8, repsLabel: "8–12", weightLb: 100, loadLabel: "start 100 lb" }),
        cue: "Chest on the pad so the lower back rests before Monday. You did 100 × 10 × 3 on Sep 28. When all 3 sets hit 12, go up.",
      },
      {
        name: "DB Lateral Raise", hevyTitle: "Lateral Raise (Dumbbell)", tier: "T3", restSeconds: 60,
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12–15", weightLb: 15, loadLabel: "start 15s" }),
        cue: "Second delt session of the week. Bench covers your front delts, so this is the only shoulder isolation besides face pulls.",
      },
      {
        name: "Incline DB Curl", hevyTitle: "Seated Incline Curl (Dumbbell)", tier: "T3", restSeconds: 60,
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10–15", weightLb: 15, loadLabel: "start 15s" }),
        cue: "Slow 3 s lowering, no swinging. Stop the set if the elbow goes over 3/10.",
      },
      {
        name: "Half-Kneeling Pallof Press", hevyTitle: "Cable Core Pallof Press", tier: "CORE", restSeconds: 45,
        rx: fixed({ sets: 3, reps: 12, repsLabel: "12 / side", weightLb: null, loadLabel: "light cable" }),
        cue: "Press out, hold 3 s, and don't let the cable twist you. Resists rotation.",
      },
      {
        name: "Cable Woodchop (high → low)", hevyTitle: "Cable Twist (Up to down)", tier: "CORE", restSeconds: 45,
        rx: fixed({ sets: 3, reps: 10, repsLabel: "10 / side", weightLb: null, loadLabel: "moderate" }),
        cue: "Turn from the hips with the spine braced. It's the paddle stroke pattern done with control.",
      },
      {
        name: "Suitcase Carry", hevyTitle: "Suitcase Carry (Dumbbell)", tier: "CORE", restSeconds: 60,
        rx: fixed({ sets: 3, meters: 40, repsLabel: "40 m / side", weightLb: 55, loadLabel: "start 55 lb" }),
        cue: "Walk tall with no lean. Works side-to-side stability and grip.",
      },
    ],
  },
];

/** Custom Hevy exercises this program needs that aren't in Hevy's built-in library. */
export const CUSTOM_HEVY_EXERCISES: {
  title: string;
  type: "reps_only" | "duration";
  primary_muscle_group: string;
  equipment: string;
}[] = [
  { title: "McGill Curl-Up", type: "reps_only", primary_muscle_group: "abdominals", equipment: "none" },
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
  if (seconds >= 180) return "3–4 min";
  if (seconds >= 150) return "2–3 min";
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
