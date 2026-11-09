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
  "W5-Sun": {
    date: "2026-11-08",
    verdict: "mixed",
    summary: "Weighted pull-up held +55 for three sets, but only three of the five were done, the row was cut to two sets and the core work was swapped. 60 min.",
    highlights: [
      "Weighted pull-up: +55 × 3, 3, 3 against 5 × 3+ (AMRAP 3, e1RM 60.5 against an expected 49.5). Every set hit 3, but sets four and five were not logged, so +55 repeats next week.",
      "Chest-supported row: 120 × 8, 8 against 3 × 8 @ 130 (e1RM 152). Two sets, 10 lb under plan, then a single-arm machine row (120 × 8, 8) was added. 120 is the base next week.",
      "Lateral raise 20s × 9, 9, 9 and incline curl 20s × 7, 7, 8 are both short of the rep range, so they stay at 20s and build reps.",
      "Pallof press, woodchop and suitcase carry were not logged. Weighted sit-ups (25 × 12 × 3) and a cable push-pull (15 × 10 × 3) were done instead. The suitcase carry has now been skipped two Sundays running.",
    ],
  },
  "W5-Fri": {
    date: "2026-11-08",
    verdict: "mixed",
    summary: "Bench heavy hit all five sets of 3 at 185, and the deadlift went 20 lb over plan but only three of five sets were done, short on reps. The session ran 85 min, 10 over the cap.",
    highlights: [
      "Bench heavy: 185 × 3, 3, 3, 3, 3 (AMRAP 3, e1RM 203.5 against an expected 187). Every set reached 3, so the ladder moves on to Friday's max test.",
      "Deadlift: 275 × 3, 2, 2 against 5 × 3+ @ 255 (e1RM 302.5). Only three sets were logged and the last two fell to 2, so 275 repeats next week rather than going up.",
      "Pull-up: BW × 10, 10, 10 against 3 × 10 @ +5. The +5 was not added for the third week running, but every set hit 10, so +5 is the load next week.",
      "Back extension: 80 × 8, 8, 8 against 70 planned, so 80 is the base. Wrist curl was one set of 15 against three.",
      "Hammer curl (25 × 9, 9, 6) was added for the third time. It goes into the week 6 plan, keeping an eye on the elbow and on the clock.",
    ],
  },
  "W5-Wed": {
    date: "2026-11-08",
    verdict: "mixed",
    summary: "Paused bench hit every set and the incline press went 5 lb over plan, but the squat volume work fell short on reps and two accessories were swapped. 59 min, well inside the cap.",
    highlights: [
      "Paused bench: 145 × 4, 4, 4 as prescribed (e1RM 164.3). Week 6 is the taper, so it drops to 3 × 3 @ 135 rather than going up.",
      "Back squat volume: 185 × 8, 6, 4 against 3 × 10 @ 160 (e1RM 234.3). That is 25 lb over plan and the reps fell off each set. Week 6 is the taper, so it stays light at 135.",
      "Smith incline press: 95 × 8, 8, 8 against 3 × 8 @ 80 in the routine (e1RM 120.3). Every set hit 8, so it goes to 100.",
      "Overhead triceps extension: 40 × 8, 8, 8 against 35 in the plan. 40 is the base now and the reps build toward 12.",
      "Rear delt reverse fly on the cable (10 × 8, 8, 8) was done instead of the planned rear delt work. It was also the cable fly last week (Nov 1), so the cable version replaces the Nautilus fly in the plan.",
      "Forearm rotation: 10 lb × 15, 15 against 12 lb, two sets only. It stays at 10 lb until all 3 sets are done.",
    ],
  },
  "W5-Mon": {
    date: "2026-11-02",
    verdict: "ahead",
    summary: "The squat is back and beat the plan with a 6-rep AMRAP, and bench hit every set, but your shoulder slipped out of position on the first bench set. 74 min, just inside the cap.",
    highlights: [
      "Bench volume: 150 × 8, 8, 8, all three sets (e1RM 190). Your note says the shoulder came out of position on the first set. Week 6 is the taper, so nothing goes up, and tell me if it comes back before Friday's max test.",
      "Back squat: 215 × 3, 3, 3, 3, then a 6-rep AMRAP (e1RM 258 against an expected 220). First squat since the back flared, and it went without a note about the back. Week 6 is 220.",
      "Seated DB shoulder press: 45s × 8, 6, 6 against 3 × 8 (e1RM 57). The last two sets were short, so 45s repeats.",
      "Seated leg curl: 120 × 6, 6, 6 against 3 × 10 @ 110. First time logged since week 2. It is 120 next week with the reps to build.",
      "Rope pushdown: 49 × 6, 6, 6 against 50, so it stays at 50. Reverse wrist curl: 10 lb × 15, 15, two of three sets again.",
      "The report compared this session with an older copy of the Hevy routine (squat 200, leg curl 100, pushdown 25), so the plan column in the planned-vs-done report is out of date. The weights above are against the program.",
    ],
  },
  "W4-Mon": {
    date: "2026-11-01",
    verdict: "behind",
    summary: "Bench volume hit all three prescribed sets and the back squat was swapped for a machine leg press, then the leg curl was skipped. The session ran 77 min, over the 75 min cap.",
    highlights: [
      "Bench volume: 145 × 8, 8, 8, 6 against 3 × 8 (e1RM 183.7). The three prescribed sets all hit 8; the fourth set of 6 was extra, so week 5 goes to 150.",
      "Back squat: not logged. Leg press (machine) 180 × 10, 10, 10 was done instead, which matches the week 4 back-injury plan. The squat returns in week 5 at 215, so drop it a step if the back is not right.",
      "Seated DB shoulder press: 40s × 9, 8, 8 against 3 × 6 (e1RM 52). Every set cleared the target, so 45s next.",
      "Triceps rope pushdown: 55 × 6, 4 then 44 × 9, well above the planned 25. Reverse wrist curl: 10 lb × 16, 16, two of three sets.",
      "Seated leg curl was not logged for the second week running. A Nautilus upper back row (130 × 8, 8) was added for the second week in a row, which is part of why the session ran long.",
    ],
  },
  "W4-Wed": {
    date: "2026-11-01",
    verdict: "ahead",
    summary: "Every set of paused bench was hit, and the incline press went 10 lb over plan. 59 min, well inside the cap.",
    highlights: [
      "Paused bench: 140 × 4, 4, 4, 4 as prescribed (e1RM 158.7). Plan for week 5 stands at 145.",
      "Smith incline press: 80 × 8, then 90 × 8, 8 against 3 × 8 @ 80 (e1RM 114). 90 is the new base.",
      "Overhead triceps extension: 35 × 8, 8, 8 against 28 planned, so it stays at 35 and builds reps.",
      "Rear delt fly was done on the cable machine: 15 × 7, then 10 × 6, 7. It is a different machine from the planned Nautilus rear delt fly, so no load change.",
      "The leg extension that replaced squat volume this week was not logged.",
    ],
  },
  "W4-Fri": {
    date: "2026-11-01",
    verdict: "mixed",
    summary: "Bench heavy was 10 lb over the plan but the AMRAP only reached 2, and the pull-up fell to 6 on the last set. No deadlift or glute bridge was logged. 45 min.",
    highlights: [
      "Bench heavy: 185 × 2, 3, 3, 2, 2 against 5 × 2+ @ 185 in the routine (e1RM 203.5 against an expected 181.5). The AMRAP set was 2, below 3, so 185 repeats next week.",
      "Pull-up: BW × 12, 12, 6 against 3 × 6 @ +5. The +5 was not added again, and the last set dropped from 12 to 6. +5 starts in week 5.",
      "Deadlift (and its glute bridge sub) was not logged, so the ladder stays at 255.",
      "45° back extension: 70 × 6, 8, 8 against 45 planned. Hammer curl 25 × 8, 8, 8 was added again (the third time), which has flared the elbow before. Nautilus pec fly 50 × 10 was added.",
    ],
  },
  "W4-Sun": {
    date: "2026-11-01",
    verdict: "ahead",
    summary: "Weighted pull-up held +50 on all five sets and the row was 10 lb over plan, but the core superset was replaced and the suitcase carry was skipped. 52 min.",
    highlights: [
      "Weighted pull-up: +50 × 3, 3, 3, 3, 3 against the +40 in the routine. AMRAP 3, e1RM 55 against an expected 44. Every set hit 3+, so +5 next week.",
      "Chest-supported row: 130 × 6, 6, 6 against 3 × 8 @ 100 (e1RM 156). Short of 8 on every set, so 130 repeats.",
      "Lateral raise 20s × 7, 8, 8 and incline curl 20s × 6, 6, 6 were both well above the planned 15s but short of the rep range. They stay at 20s and build reps.",
      "Pallof press and woodchop were not logged. A cable twist (20 × 10 × 3) and weighted sit-ups (25 × 10 × 3) were done instead, and the suitcase carry was skipped.",
    ],
  },
};
