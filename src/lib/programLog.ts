// Manual log of changes to the current block (Regressive Underload), newest
// first. Each entry says what moved and which logged sets it was based on. The
// Comeback Block's log is in src/lib/archive/comebackLog.ts.

export type ProgramLogEntry = { date: string; title: string; changes: string[] };

export const PROGRAM_LOG: ProgramLogEntry[] = [
  {
    date: "2026-11-27",
    title: "After Week 2 Wed and Fri",
    changes: [
      "Paused bench: 170 × 5 × 4 on Nov 25, every set, so week 3 is 4 × 5 at 175, week 4 at 175 and week 5 at 180.",
      "Squat: 225 × 5, 5 on Nov 25 (2 of 5 sets, 25 lb over the plan). 225 repeats as a full 5 × 5 in week 3, then 230 and 235.",
      "Friday bench heavy: 185 × 5 × 5 on Nov 27, every set, so week 3 is 190 as already planned.",
      "Friday deadlift: 255 × 5, 5 on Nov 27 (2 of 5 sets). 255 repeats in week 3, then 265 and 270.",
      "Friday pull-ups keep the planned totals (17, 6, 5, 5, 5, 3, 5 is 46 on Nov 27). Rest goes from 60 s to 90 s, with 2 min after the max set, since the sets after a max kept falling to 3–5.",
      "Smith incline to 110 (110 × 7, 7, 7 on Nov 25). Back extension stays at 95 and hammer curl at 25s to add reps.",
      "The overhead DB triceps extension is replaced by the cable single-arm pushdown at 25 lb, after you swapped to it on Nov 18 and Nov 25. The leg curl no longer pairs with it.",
      "Sessions ran 84 minutes on Wednesday and 109 on Friday. The leg curl has been dropped twice with no replacement and is waiting on your answer.",
    ],
  },
  {
    date: "2026-11-24",
    title: "After Week 1 Wed, Fri, Sun and Week 2 Mon",
    changes: [
      "Wednesday goes back to paused bench, at your request, replacing close-grip. It is 4 × 5 at 165 (165 × 5, 5, 5, 4 on Nov 18), then 170, 170, 175, with a 145 deload.",
      "Monday bench rebased to 160 (160 × 8 × 5 on Nov 23, 155 × 8 × 4 on Nov 16): 4 × 8 at 165 in week 3, 5 × 8 at 165 in week 4, 5 × 8 at 170 in week 5.",
      "Friday bench heavy repeats 185 in week 2 (185 × 4 × 5 on Nov 20, a rep short on every set), then 190, 190, 195.",
      "Not logged, so the ladders hold: squat stays at 200 in week 2 (lunges on Nov 18), Friday deadlift at 255 in week 2 (skipped Nov 20) and Monday deadlift at 230 in week 3 (nothing on Nov 23). Later weeks shift one step. The plan keeps these lifts until you say why they were swapped.",
      "Sunday weighted pull-up repeats +65 in week 2 (+65 × 3, 3, 2 then +62.5 × 3, 3 on Nov 22), then +70, +75, +75.",
      "Friday pull-ups keep their planned totals. 18, 8, 5, 4, 4, 3 on Nov 20 gave 42 reps and a new best max set of 18.",
      "Accessories: DB press to 50s (50s × 6, 7, 7 on Nov 23). Back extension to 95 (90 × 10, 10, 10 on Nov 20). Upper back row to 140 with a 6–10 range (140 × 6, 6, 6 on Nov 22). Hammer curl, single-arm row, lateral raise, decline sit-up and Smith incline stay and add reps.",
      "Rear delt fly and triceps extension replaced by the Nautilus rear delt fly (50 lb) and the cable pushdown (50 lb), both 3 × 8–12, after you swapped to them on Nov 16 and Nov 23.",
      "Unplanned hip work (adduction, abduction, machine hip thrust) appeared on Nov 18 and Nov 23 and sessions ran 86 and 79 minutes. Not programmed yet.",
    ],
  },
  {
    date: "2026-11-16",
    title: "After Week 1 Mon",
    changes: [
      "Monday bench: 155 × 8, 8, 8, 8 on Nov 16 (planned 4 × 8 at 150). The ladder now climbs from 155: week 2 is 5 × 8 at 155, week 3 4 × 8 at 160, week 4 5 × 8 at 160, week 5 5 × 8 at 165. Week 6 deload unchanged at 3 × 5 at 135.",
      "Monday deadlift: 225 × 8, 8, 8 on Nov 16, on plan. Week 2 stays 230 × 8 × 3. Cue updated to the latest sets.",
      "DB shoulder press: 45s × 9, 9, 9 on Nov 16, short of the top of 8–10, so it stays at 45s. The report suggested 50s, but this is a rep-range move: it goes up after all three sets hit 10.",
      "Rear delt fly (cable 10 lb) and triceps extension (Nautilus 60 lb) were swapped once, with no note, for the Nautilus rear delt fly (50 × 6, 6, 6) and the cable pushdown (45 × 8, 50 × 6, 6). The plan is unchanged for now.",
    ],
  },
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
