// Per-session performance briefings for the current block (Regressive
// Underload), written by the healfy-update skill after each sync (see
// .claude/skills/healfy-update). Keyed by sessionKey(week, day), e.g. "W3-Mon".
// The program page shows the briefing under the day's check mark. The
// Comeback Block's briefings are in src/lib/archive/comebackBriefings.ts.

export type BriefingVerdict = "ahead" | "on-plan" | "mixed" | "behind";

export type Briefing = {
  /** Date the briefing was written (YYYY-MM-DD). */
  date: string;
  verdict: BriefingVerdict;
  /** One or two sentences: how the session went overall. */
  summary: string;
  /** Per-lift detail: sets vs prescription, AMRAPs, estimated 1RM vs expected, notes, swaps. */
  highlights: string[];
};

export const BRIEFINGS: Record<string, Briefing> = {
  "W1-Wed": {
    date: "2026-11-24",
    verdict: "mixed",
    summary:
      "The session ran 86 minutes, 11 over the cap. Paused bench replaced close-grip and went well, but no squat was logged: barbell lunges stood in for it.",
    highlights: [
      "Bench: paused bench 165 × 5, 5, 5, 4 in place of close-grip 4 × 6 at 140. It is 25 lb over the planned load with one rep short on the last set, so 165 repeats in week 2. Wednesday is now paused bench for the rest of the block, as you asked.",
      "Squat: not logged. You did barbell lunges 95 × 8 × 4 instead. A main-lift swap is not changed automatically, so squat stays programmed and its ladder holds at 200 for week 2.",
      "Smith incline 100 × 8, 8, 8 against 3 × 8–10 at 100: on plan. It stays at 100 until all three sets hit 10.",
      "The DB overhead triceps extension became the cable single-arm pushdown (20 × 10, 25 × 10, 25 × 6) and the leg curl was dropped. Hip adduction (40 × 10, 12, 10) and hip abduction (90 × 12, then 110 × 12, 12) were added. All first-time changes with no note, so the plan keeps its accessories. The hip work is unplanned and is part of why the session ran long.",
    ],
  },
  "W1-Fri": {
    date: "2026-11-24",
    verdict: "mixed",
    summary:
      "74 minutes. Bench went 10 lb over the plan but every set was a rep short, the heavy deadlift was skipped, and the pull-up max set was a new best at 18.",
    highlights: [
      "Bench heavy: 185 × 4, 4, 4, 4, 4 against 5 × 5+ at 175. The e1RM is 209.7 against an expected 204.2 (+5.5), so you are ahead of the curve, but all five sets missed 5, so 185 repeats in week 2. The ladder then goes 190, 190, 195.",
      "Deadlift heavy: not logged (the session was marked skipped). A skipped lift never advances the ladder, so week 2 starts at 255 and the later weeks shift one step.",
      "Pull-up volume: 18, 8, 5, 4, 4, 3, which is 42 reps against a total of 40. The 18 is a new best (14 on Aug 5), but the sets after it fell to 3–5 against 6. Planned totals stay, and you finish a total in smaller sets if sets of 6 stop being possible.",
      "Back extension 90 × 10, 10, 10 hit the top of the range, so it goes to 95. Hammer curl 25 × 9, 9, 9 stays at 25s while it builds to 12.",
    ],
  },
  "W1-Sun": {
    date: "2026-11-24",
    verdict: "mixed",
    summary:
      "64 minutes. The weighted pull-up fell just short of the plan, while the rows and the other accessories were at or above it.",
    highlights: [
      "Weighted pull-up: +65 × 3, 3, 2 then +62.5 × 3, 3 against 5 × 3+ at +65. One set of 2 and two sets dropped to 62.5, so +65 repeats in week 2. The e1RM is 71.5, exactly the expected 71.5.",
      "Upper back row 140 × 6, 6, 6 (e1RM 168) against 3 × 8–12 at 130: 10 lb over the plan but below 8 reps. It stays at 140 and the range is now 6–10.",
      "Single-arm cable row 66 × 8, 8, 8, lateral raise 20s × 11, 11, 11 and decline sit-up 45 × 11, 11, 11 were all inside their ranges, so they stay and add reps.",
      "The pec fly and the cable push-pull were not logged. A seated incline curl (20s × 9, 8, 8) and weighted Russian twists (10 × 6 × 3) were added. First time for each, so the plan stays.",
    ],
  },
  "W2-Mon": {
    date: "2026-11-24",
    verdict: "mixed",
    summary:
      "79 minutes, 4 over the cap, with unplanned hip work. Bench beat the plan, but no deadlift was logged.",
    highlights: [
      "Bench volume: 160 × 8 × 5 against 5 × 8 at 155. That is 5 lb over the plan with every rep there (e1RM 202.7), so the ladder now climbs from 160: 4 × 8 at 165, 5 × 8 at 165, 5 × 8 at 170.",
      "Deadlift volume: not logged. Machine hip thrust 140 × 8 × 3 was done instead. Week 3 repeats 230 rather than advancing to 235.",
      "DB shoulder press 50s × 6, 7, 7 against 3 × 8–10 at 45s: 5 lb heavier than planned and below the range, so it stays at 50s until all three sets hit 8.",
      "Rear delt fly and triceps: you did the Nautilus rear delt fly (50 × 7 × 3) and the cable pushdown (50 × 7 × 3) for the second week running, so they replace the cable fly and the machine extension for the rest of the block.",
      "Hip adduction (40 × 10, 12) and hip abduction (110 × 10, 12) were added again. They are unplanned, and they and the hip thrust are what pushed the session past 75 minutes.",
    ],
  },
  "W1-Mon": {
    date: "2026-11-16",
    verdict: "ahead",
    summary:
      "A clean first session of the block in 68 minutes: every bench and deadlift set hit 8, and bench went up at 155 instead of the planned 150. Both superset accessories were swapped for machine moves done heavier for fewer reps.",
    highlights: [
      "Bench volume: 155 × 8, 8, 8, 8 against 4 × 8 at 150, so 5 lb over the plan with every rep there (e1RM 196). Next week is 5 × 8 at 155: Monday adds a set before it adds weight, and the ladder now climbs from 155 (160 in weeks 3–4, 165 in week 5).",
      "Deadlift volume: 225 × 8, 8, 8, exactly the plan (e1RM 285), up from 225 × 6, 7, 8 on Nov 13. Next week 230 × 8 × 3 as planned.",
      "DB shoulder press: 45s × 9, 9, 9 against 3 × 8–10. Inside the range but not at the top, so it stays at 45s next week. All three sets at 10 moves it to 50s.",
      "Rear delt: the cable reverse fly (10 lb × 12–15) was swapped for the Nautilus rear delt fly at 50 × 6, 6, 6. That is a first swap with no note, so the plan keeps the cable fly for now.",
      "Triceps: the Nautilus extension (60 × 10–12) was swapped for the cable pushdown at 45 × 8, then 50 × 6, 6. Again a first swap with no note, so the plan stays. No elbow pain was logged.",
      "No notes were logged on any exercise. Hevy's \"update routine\" prompt was accepted at the end, which overwrote this routine with the logged sets, so the plan-vs-done view for this day shows the logged numbers as the plan.",
    ],
  },
};
