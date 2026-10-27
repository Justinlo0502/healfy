// Manual log of changes to the Comeback Block, newest first. Each entry says
// what moved and which logged sets it was based on.

export type ProgramLogEntry = { date: string; title: string; changes: string[] };

export const PROGRAM_LOG: ProgramLogEntry[] = [
  {
    date: "2026-10-26",
    title: "Briefings added for Weeks 1 to 3, no plan changes",
    changes: [
      "Hevy sync found no new workouts since the Week 3 Friday session (Oct 23), so no loads were changed. The Week 4 plan below stands.",
      "Wrote briefings for all ten logged sessions (W1 Mon through W3 Fri). Sessions over the 75 min cap: W1 Mon 81, W1 Wed 77, W1 Fri 82, W2 Wed 83.",
      "Wednesday face pull has been swapped for the Nautilus rear delt fly twice (Oct 14, Oct 21), and the plan already uses it. Friday hammer curl was added twice (Oct 9, Oct 16) and is not programmed, because it has bothered the elbow.",
    ],
  },
  {
    date: "2026-10-26",
    title: "Week 4: lower-back injury, no squat or deadlift",
    changes: [
      "Week 4 only: no barbell squat or deadlift. Monday's squat is a leg press (4 × 8–10 @ 180 lb), Wednesday's squat volume is a leg extension (3 × 10–12 @ 130 lb), and Friday's deadlift is a glute bridge (4 × 12–15, bodyweight). Loads are conservative starts from your 2022–2023 machine logs, since there is nothing recent.",
      "Also dropped for the week because they load or twist the spine: Friday's back extension (now a side plank, 3 × 20 s / side) and Sunday's cable woodchop (now a dead bug, 3 × 8 / side). Suitcase carry goes from 55 to 45 lb.",
      "Squat and deadlift come back in week 5 with their ladders unchanged (Monday squat 215, Wednesday squat 165, deadlift 255 on the old ladder; drop these back a step if the back isn't right). Revisit both once you know how the back feels.",
      "Friday Oct 23: bench 170 × 3, 3 then 175 × 3, 3, 3, so the plan stands (175 in week 4). No deadlift was logged, so its ladder steps are skipped.",
      "Friday pull-up: BW × 11, 11, 11 without the +5, so +5 lb starts in week 4 (+5 / 5 / 10 / 15).",
      "Sunday Oct 25 weighted pull-up was skipped again, so week 4 repeats +50 (then +50 / 55 / 60).",
    ],
  },
  {
    date: "2026-10-21",
    title: "After Week 3 Monday and Wednesday",
    changes: [
      "Wednesday now has the Smith incline press (A1) superset with an overhead cable triceps extension (A2), replacing the rope pushdown that day. Extension starts at 28 lb, which is what you did (10, 8, 8).",
      "Wednesday's face pull is replaced by the Nautilus rear delt fly (40 lb × 10–15), superset with the forearm rotation (B). You swapped it in on both Oct 14 and Oct 21.",
      "Smith incline: 80 × 10, 10, 10 hit the top of the range, so it starts at 85 lb.",
      "Forearm rotation: 10 lb × 15, 15 beat the 12-rep target, so it goes to 12 lb.",
      "Wednesday squat: 155 × 10, 10, 10 (planned 150). The ladder is now 160 / 165 for weeks 4–5, then 135 in week 6.",
      "Monday squat: 205 × 3, 3, 3, 3, 5 against a planned 195. The ladder is now 210 / 215 / 220 for weeks 4–6.",
      "Monday bench 140 × 8 × 4 and Wednesday paused bench 135 × 5 × 4 hit their targets, so the plan stands (145 and 140 next).",
      "Monday pushdown: 44 lb × 6, 8, 8 against a planned 35, so it starts at 44 and builds to 12 reps.",
      "DB shoulder press: 40s × 10, 10 (only two sets), so it stays at 40s until all 3 sets hit 10. Leg curl and reverse wrist curl were not logged Monday.",
      "Chest-supported row make-up done Monday (110 × 10, 120 × 8, 8), so the Sunday row now starts at 120 lb.",
    ],
  },
  {
    date: "2026-10-18",
    title: "After Week 2 Wednesday and Friday, Sunday skipped",
    changes: [
      "Accessories are now supersets (never the main lifts): Mon pushdown + reverse wrist curl, Wed pushdown + forearm rotation, Fri back extension + wrist curl, Sun lateral raise + incline curl and Pallof + woodchop. Rest comes after the second move.",
      "Sunday Oct 18 skipped. The weighted pull-up ladder repeats +50 in week 3 (+45 / 50 / 50 / 55 / 60 / 65). Week 3 Monday gets an optional chest-supported row (3 × 8–12 @ 100 lb) as a one-off make-up.",
      "Bench heavy: 160 × 3, 3, 3, 3, 7, a second 7-rep AMRAP, so the extra +5 lb rule applies: 170 / 175 / 180 for weeks 3–5.",
      "Deadlift: none logged on Oct 16, so week 2's 235 was skipped. Week 3 repeats 235, then 245 / 255 / 260.",
      "Friday pull-up: BW × 11, 11, 8 and no weight added, so +5 lb starts in week 3 (+5 / 10 / 15 / 20).",
      "Wednesday squat: 145 × 10, 10, 10 against a planned 135. The ladder is now 150 / 155 / 160 for weeks 3–5, then 135 in week 6.",
      "Paused bench 130 × 5 × 4 and Smith incline 80 × 8, 8, 8 hit their targets, so no change. Incline stays at 80 until 3 × 10.",
      "Forearm rotation: 10 lb × 12, 12 on Oct 14, so it starts at 10 lb (was 8).",
      "Wrist curl: 20 × 6, 6 was too heavy for the 15-rep target, so it stays at 15 lb.",
    ],
  },
  {
    date: "2026-10-14",
    title: "After Week 1 Sunday and Week 2 Monday",
    changes: [
      "Squat 5×3+: 185 × 3, 3, 3, 3, 8 on Oct 12 against a planned 175. The ladder is now 185 / 195 / 200 / 210 / 215 for weeks 2–6.",
      "Bench volume: 135 × 8, 8, 8, 8 hit every set, so week 3 goes to 140 as planned.",
      "Sunday weighted pull-up: +45 × 3, 3, 3, 3 on Oct 11 against a planned +25 (the 5th set was logged as a +25 × 1 warm-up, so no AMRAP). The ladder now runs +45 / 50 / 55 / 60 / 65 / 70, back to your Aug 10 best of +70 × 3.",
      "Seated leg curl: 110 × 10, 10, 6, so it now starts at 110 lb (was 100).",
      "Triceps rope pushdown (Mon and Wed): 33 × 12, 12, 12 hit the top of the range, so both days start at 35 lb (was 25).",
      "Reverse wrist curl: 10 lb × 12, 12 on Oct 12, so it stays at 10 lb until all 3 sets hit 15.",
      "Seated DB shoulder press 40s × 8, 8, 8: unchanged, build to 10 reps before moving to 45s.",
    ],
  },
  {
    date: "2026-10-12",
    title: "Monday lateral raise swapped for triceps pushdown",
    changes: [
      "Monday no longer has DB lateral raises: they landed the day after Sunday's, so the side delts never got a day off. Sunday keeps them as the week's only lateral raise work.",
      "Triceps rope pushdown 3 × 8–12 @ 25 lb takes the slot on Monday.",
      "Seated DB shoulder press target raised from 6 to 8 reps at 40s: Oct 2 was 40 × 8, 8, 8, and Oct 5's 6, 6, 6 only matched the routine's target.",
    ],
  },
  {
    date: "2026-10-09",
    title: "After Week 1 Friday (bench heavy · deadlift · pull-up)",
    changes: [
      "Bench heavy: 150 × 3, 3, 3, 3, 7. The 7-rep AMRAP triggered the +5 lb rule, so Friday goes 160 / 165 / 170 / 175 for weeks 2–5.",
      "Deadlift: 225 × 3, 3, 3, 3, 6 against a planned 190. The ladder restarts at 225: 235 / 245 / 255 / 260 / 265 for weeks 2–6.",
      "Pull-up: BW × 10, 10, 10 hit every rep, so week 2 stays at +5 lb as planned.",
      "Back extension: logged 45 lb × 10, 10, so it now starts at 45 lb for 3 × 10–15.",
      "Wednesday squat 3 × 10: week 1 had 2 of 3 sets at 135, so week 2 repeats 135 (then 145 / 150 / 160 / 135).",
      "Warm-ups replaced with row, cat-camel, thread the needle, bird dog and fire hydrants, plus banded pull aparts on bench days. Scapular pull-ups now sit right before pull-ups.",
    ],
  },
];
