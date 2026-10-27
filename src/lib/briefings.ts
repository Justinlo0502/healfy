// Per-session performance briefings for the Comeback Block, written by the
// healfy-update skill after each sync (see .claude/skills/healfy-update).
// Keyed by sessionKey(week, day), e.g. "W3-Mon". The program page shows the
// briefing under the day's check mark.

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
  "W1-Mon": {
    date: "2026-10-26",
    verdict: "mixed",
    summary: "Squat beat the plan with an 8-rep AMRAP, but the last bench set fell to 5 and the session ran 81 min, over the 75 min cap.",
    highlights: [
      "Bench volume: 135 × 8, 8, 8, 5 against 4 × 8. The fourth set was 3 reps short (e1RM 171).",
      "Back squat: 160 × 3, 3, 3, 3 then an 8-rep AMRAP at 160 (e1RM 202.7 against an expected 176).",
      "Seated DB shoulder press: 40s × 6, 6, 6, as prescribed.",
      "Reverse wrist curl: 10 lb × 10, 10, 10 against 3 × 15, so it stays at 10 lb until the reps are there.",
    ],
  },
  "W1-Wed": {
    date: "2026-10-26",
    verdict: "mixed",
    summary: "Paused bench and the incline press were on or above plan, but only two of three squat sets were logged and the session ran 77 min.",
    highlights: [
      "Paused bench: 130 × 5, 5, 5, as prescribed (e1RM 151.7).",
      "Back squat (T2): 135 × 10, 10, only 2 of 3 sets logged (e1RM 180).",
      "Smith incline press: 70 × 10, then 80 × 10 and 80 × 8 against 3 × 8 @ 70. You went up in load on your own (e1RM 106.7).",
      "DB forearm rotation: 10 × 10 and 8 × 12 against 2 × 10 @ 10 lb.",
    ],
  },
  "W1-Fri": {
    date: "2026-10-26",
    verdict: "ahead",
    summary: "Both big lifts beat the curve: bench AMRAP of 7 and a deadlift e1RM of 270, 61 lb above expected. The session ran 82 min.",
    highlights: [
      "Bench heavy: 150 × 3, 3, 3, 3 then 7 on the AMRAP (e1RM 185 against an expected 165).",
      "Deadlift: 225 × 3, 3, 3, 3 then 6 on the AMRAP (e1RM 270 against an expected 209).",
      "Pull-up: BW × 10, 10, 10, as prescribed.",
      "Back extension was 2 of 3 sets and the wrist curl was not logged. You added hammer curls (25 × 8, 7), which have bothered the elbow before.",
      "At 82 min this was the longest session; the accessories are where it gets trimmed.",
    ],
  },
  "W1-Sun": {
    date: "2026-10-26",
    verdict: "on-plan",
    summary: "Weighted pull-ups at +45 lb for all four sets, with a clean accessory and core block in 64 min.",
    highlights: [
      "Weighted pull-up: +45 × 3, 3, 3, 3. The fifth set was logged as a +25 × 1 warm-up, so there is no AMRAP result (e1RM 49.5 against an expected 27.5).",
      "Straight arm pulldown 45 × 8 × 3, lateral raise 15 × 12 × 3 and Pallof press 20 × 12 × 3 all hit their targets.",
      "Incline DB curl: 15 × 10, 10, 8. Woodchop was 2 of 3 sets. Suitcase carry 55 lb for 20, 40, 40.",
    ],
  },
  "W2-Mon": {
    date: "2026-10-26",
    verdict: "ahead",
    summary: "Squat ran well past the plan (185 against 175 with an 8-rep AMRAP) and bench volume hit every set, in 75 min.",
    highlights: [
      "Bench volume: 135 × 8 × 4, all sets hit (e1RM 171). Your note: performative arch, so keep the setup tight.",
      "Back squat: 185 × 3, 3, 3, 3 then 8 on the AMRAP, against a planned 175 (e1RM 234.3 against an expected 192.5). Your note: not bracing properly into the belt, so make the brace the focus.",
      "Seated DB shoulder press: 40s × 8, 8, 8 against 3 × 6 (note: cue elbows forward).",
      "Leg curl: 110 × 10, 10, 6 against 100 planned, so it starts at 110 lb.",
      "Triceps rope pushdown: 33 × 12, 12, 12 against 25 planned, so both days start at 35 lb.",
    ],
  },
  "W2-Wed": {
    date: "2026-10-26",
    verdict: "ahead",
    summary: "Squat volume went 10 lb over plan and the bench and incline sets were all hit, but the session ran 83 min and two accessories were swapped.",
    highlights: [
      "Paused bench: 130 × 5 × 4, as prescribed (e1RM 151.7).",
      "Back squat (T2): 145 × 10, 10, 10 against a planned 135 (e1RM 193.3).",
      "Smith incline press: 80 × 8 × 3, as prescribed.",
      "Swaps: rope pushdown became the Nautilus tricep extension (60 × 10 × 3) and face pull became the Nautilus rear delt fly (30 to 40 × 8 to 10).",
      "At 83 min the session was over the 75 min cap.",
    ],
  },
  "W2-Fri": {
    date: "2026-10-26",
    verdict: "mixed",
    summary: "Bench heavy was the best set of the block so far, but the deadlift was not logged and the pull-up sets stayed bodyweight.",
    highlights: [
      "Bench heavy: 160 × 3, 3, 3, 3 then 7 on the AMRAP, a second 7-rep AMRAP (e1RM 197.3 against an expected 170.5).",
      "Deadlift: not logged, so the week 2 step (235) was skipped and week 3 repeats it.",
      "Pull-up: BW × 11, 11, 8 against 3 × 10 @ +5 lb, with no weight added.",
      "Wrist curl: 20 × 6, 6 against 3 × 15 @ 15 lb. It was too heavy, so it stays at 15 lb.",
      "Hammer curl 25 × 8 × 3 was added on top of the plan. Watch the elbow.",
    ],
  },
  "W3-Mon": {
    date: "2026-10-26",
    verdict: "ahead",
    summary: "Squat jumped to 205 against a planned 185 and bench volume was clean, in 62 min, well under the cap.",
    highlights: [
      "Bench volume: 140 × 8 × 4, all sets hit (e1RM 177.3 against an expected 176).",
      "Back squat: 205 × 3, 3, 3, 3 then 5 on the AMRAP against a planned 185 (e1RM 239.2 against an expected 203.5).",
      "Seated DB shoulder press: 40s × 10, 10, only 2 sets, so it stays at 40s until all 3 sets are done.",
      "Triceps rope pushdown: 44 × 6, 8, 8 against 25 planned, so it starts at 44 lb and builds to 12 reps.",
      "Leg curl and reverse wrist curl were not logged. Chest-supported row make-up was done (110 × 10, 120 × 8, 8).",
    ],
  },
  "W3-Wed": {
    date: "2026-10-26",
    verdict: "ahead",
    summary: "Paused bench and incline were on target, squat volume was 10 lb over plan, and the rear delts and triceps were swapped again.",
    highlights: [
      "Paused bench: 135 × 5 × 4, as prescribed (e1RM 157.5).",
      "Back squat (T2): 155 × 10, 10, 10 against a planned 145 (e1RM 206.7).",
      "Smith incline press: 80 × 10, 10, 10, top of the range, so it moves to 85 lb.",
      "Swaps: face pull became the Nautilus rear delt fly for the second week running (40 × 10 × 3), and rope pushdown became the cable overhead triceps extension (27.5 × 10, 8, 8).",
      "Forearm rotation: 10 lb × 15, 15 against 12 planned. Two sets only.",
    ],
  },
  "W3-Fri": {
    date: "2026-10-26",
    verdict: "mixed",
    summary: "Bench heavy went 5 lb over plan, but the deadlift, back extension and wrist curl were all not logged. 56 min.",
    highlights: [
      "Bench heavy: 170 × 3, 3 then 175 × 3, 3, 3 against a planned 165. No AMRAP set above 3 (e1RM 192.5 against an expected 176).",
      "Deadlift: not logged for the second week running, so its ladder steps are skipped.",
      "Pull-up: BW × 11, 11, 11 with no weight added, so +5 lb starts next week.",
      "Back extension and wrist curl were not logged. Nautilus pec fly was added (50 × 8, 8, 10).",
    ],
  },
};
