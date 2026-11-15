// Manual log of changes to the current block (Regressive Underload), newest
// first. Each entry says what moved and which logged sets it was based on. The
// Comeback Block's log is in src/lib/archive/comebackLog.ts.

export type ProgramLogEntry = { date: string; title: string; changes: string[] };

export const PROGRAM_LOG: ProgramLogEntry[] = [
  {
    date: "2026-11-15",
    title: "Regressive Underload built from the end of the Comeback Block",
    changes: [
      "New 6-week volume block, Nov 16 – Dec 27. Weeks 1–5 build, mostly by adding sets rather than weight. Week 6 (Christmas week) is a deload, with a bodyweight pull-up max test on Friday.",
      "Bench: Monday volume 5 × 8 (4 × 8 in week 1) at 150, from 150 × 8, 8, 8 on Nov 2. Wednesday is close-grip bench 4 × 6 at 140, replacing paused bench. Friday heavy is 5 × 5+ at 175 (about 82% of a 210–215 max, since 225 was missed on Nov 13).",
      "Deadlift now twice a week, as in GZCLP's T1/T2 split: Monday 3 × 8 at 225 (from 225 × 6, 7, 8 on Nov 13), Friday 5 × 3+ at 255. That resets below 275 × 3, 2, 2 on Nov 6, which missed reps.",
      "Squat once a week, on Wednesday: 5 × 5 at 200. Recent sets were 215 × 3, 3, 3, 3, 6 on Nov 2 and 185 × 8, 8, 8 on Nov 11.",
      "Friday pull-ups train for the AMRAP test: one max set, then sets of 6–7 to a rep total of 40 / 45 / 50 / 55 / 60, the method used by Armstrong and 7 Weeks to 50 Pull-Ups. Best recent sets were BW × 12 (Oct 30) and 14 (Aug 5).",
      "Sunday weighted pull-up 5 × 3+ starts at +65, since all five sets hit 3 at +60 on Nov 15.",
      "Sunday incline bench replaced by a pec fly at 50 lb (50 × 8, 8, 10 on Oct 23). It lands the day before Monday's bench volume.",
      "Gym elbow work (wrist curls, forearm rotation) removed: it was skipped in most sessions. The Thursday home elbow routine stays. Hammer curl is back to 25s (30 × 5, 5 on Nov 13 was a grind).",
      "Accessory starting loads: DB press 45s, cable rear delt fly 10, Nautilus triceps extension 60, Smith incline 100, leg curl 120, back extension 90, upper back row 130, single-arm cable row 66, lateral raise 20s, decline crunch 45, cable push-pull 20.",
    ],
  },
];
