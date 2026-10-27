---
name: healfy-update
description: Post-workout update for the Comeback Block. Use when the user's message starts with "update:" (or says "healfy update"). Syncs Hevy, briefs every newly logged session, revises the remaining weeks' loads and exercises from the logged weights, comments and swaps, refreshes expected-vs-actual 1RM and PR outlook, and pushes the changes to Hevy. Done sessions get a check mark on /dashboard/program automatically.
allowed-tools: Bash(npx tsx scripts/healfy-update.ts*) Bash(npx tsx scripts/push-comeback-block.ts*) Bash(npx tsc --noEmit*)
---

# healfy update

Trigger: the user writes `update:` (anything after the colon is extra context, e.g. "update: back felt tight on squats").
This is the explicit go-ahead to revise the program and push it to Hevy. Do not ask for approval again for changes the rules below
produce; do ask when a rule says to.

Everything is derived from real Hevy logs. Never invent sets, notes, or numbers (see the no-fake-data memory). If the report says
something was not logged, say it was not logged.

## 1. Run the analysis

```
npx tsx scripts/healfy-update.ts
```

It syncs Hevy, then prints, for every logged session that has no briefing yet: each exercise's plan vs what was done, AMRAP reps,
e1RM, the user's own exercise notes, and swaps. It also prints the substitution history, proposed next loads, and expected-vs-actual
1RM with a PR outlook. Flags: `--no-sync`, `--all` (re-brief everything), `--json`.

- A session's plan is the Hevy routine as it stood that day, not today's `src/lib/program.ts`, so past statuses stay honest even
  after the program was revised.
- If the sync line says FAILED, tell the user and carry on with what is stored.
- If "Sessions to brief" is empty and nothing else changed, say there is nothing new and stop. Do not re-edit files.

The user's session context also counts: read the notes (`NOTE:`), and anything they typed after `update:`.

## 2. Brief each past workout

For every session listed, add an entry to `BRIEFINGS` in `src/lib/briefings.ts`, keyed `W<week>-<Day>` (e.g. `"W3-Mon"`). Shape:
`{ date, verdict, summary, highlights[] }`. Write the existing entries' style: plain sentences, concrete numbers, no filler.

- `verdict`: `ahead` (main lifts beat the plan), `on-plan`, `mixed` (some lifts beat it, some missed), `behind` (main lifts missed or
  most of the session not done).
- `summary`: one or two sentences on how the session went, including duration if it matters (the cap is 75 min).
- `highlights`: one bullet per notable lift. Cover sets vs prescription, AMRAP result, e1RM vs the expected curve for tracked lifts,
  what the user's notes said and what it implies, anything dropped or swapped, and what changes next.
- Keep a bullet for every main lift (T1/T2). Accessories only when they moved, were missed, or were swapped.

Keys already in `BRIEFINGS` are never re-written unless the user asks (`--all`).

## 3. Update future weights

Use the "Proposed loads" section as the starting point. The rules it encodes (from the Rules panel on `/dashboard/program`):

- T1 5×3+ (Mon squat, Fri deadlift, Sun weighted pull-up, Fri bench heavy): every set at 3+ → load lifted + step (squat 5, deadlift 10,
  pull-up 5, bench 5). A miss repeats the load. Bench heavy AMRAP of 6+ adds an extra 5 lb.
- Fixed-rep compounds (bench volume, paused bench, squat volume, Fri pull-up): every set at target → +5, otherwise repeat.
- Accessories: every set at the top of the rep range → smallest jump (2 lb under 40 lb, else 5). Otherwise stay and add reps.
- The ladder follows the lifter: the load actually lifted is the new base, and later weeks climb from there.
- A skipped session or skipped exercise never advances the ladder.

Apply by editing `src/lib/program.ts` for sessions still to come only (never touch a past week's numbers):

- Ladder arrays (`BENCH_VOLUME`, `BENCH_PAUSED`, `BENCH_HEAVY`, `SQUAT_VOLUME`, `DEADLIFT_T1`, `PULLUP_T1`, `PULLUP_T2`, `SQUAT_T1`) and
  accessory `weightLb`/`loadLabel` values.
- Rewrite the exercise's `cue` so it states the latest logged result ("You did X on <date>") and the rule for the next jump.
  Replace stale history, do not stack it.
- Respect `weeks: [...]` limits and any injury-substitute moves already in the program. If the script notes an exercise was not
  programmed in an intervening week (for example a back-injury week), progress it conservatively and tell the user what you chose.

Judgement overrides to the script, in the user's favour of safety and their stated constraints (see the training-program-preferences
memory): never start a lift below what they recently logged; keep sessions at 75 min or less (a session that ran long means trimming
accessories, not adding); no supersets on compound lifts; keep the Mon/Wed/Fri/Sun + Thursday-home structure; elbow-friendly moves only
(no skull crushers or heavy hammer curls, which have flared the elbow, so flag a recurring hammer curl instead of programming it).
If the user's note mentions pain or a bad day, let that outrank the arithmetic and say so.

## 4. Handle substitutions

The report's "Substitution history" pairs each dropped move with what was logged instead (same primary muscle group).

| Situation | Action |
| --- | --- |
| Accessory (T3/ELBOW) swapped the same way 2+ times, or once with full sets and a note that it was better | Replace it in all remaining weeks of that day: new `name`, `hevyTitle`, tier, rest, rx, cue. Keep superset pairing sensible. |
| Same swap done once, no note, partial sets | Leave the plan, mention it, ask next time if it repeats. |
| Unplanned add-on seen 2+ times | Offer to program it, or drop it from the plan if it eats time. Check the elbow rule first. |
| Planned move dropped 2+ times with no replacement | Propose removing it, or moving it to a day with room. Ask. |
| T1/T2 main lift swapped | Never auto-swap. Ask the user. |

The swapped-in move must exist as a Hevy exercise template ("Hevy exercise exists" in the report). If it says NO, add it to
`CUSTOM_HEVY_EXERCISES` in `program.ts`.

## 5. Progression and expected PR

The last report section comes from `src/lib/progress.ts` (`liftProgress`), the one algorithm for expected vs actual 1RM (Epley,
best set of 10 reps or fewer per session). Do not recompute by hand and do not edit the frozen `baselineLb` arrays there: they are
the original Oct 5 plan on purpose.

- Report, per tracked lift: latest actual vs expected, the gap, end-of-block pace (`onPaceFor`), and whether that beats the best
  before the block or in it (`PR EXPECTED` or not).
- Week 6 bench is a max test: if bench is on pace, suggest an opener and a first attempt from the pace e1RM, stated as a suggestion.
- If a tracked lift's exercise name changes in `program.ts`, update `TRACKED_LIFTS` in `progress.ts` to match.

## 6. Log it

Add an entry at the top of `PROGRAM_LOG` in `src/lib/programLog.ts`: `date` (today), `title` ("After Week N Mon and Wed", plus "Sunday
skipped" if relevant), and one change per bullet, each naming the logged sets it was based on, in the existing style.

## 7. Push to Hevy and verify

1. `npx tsc --noEmit`, fix any errors.
2. `npx tsx scripts/push-comeback-block.ts --dry-run`, then the real run. It only updates sessions dated today or later and leaves
   finished ones as logged. On a Hevy 429, resume with `--from-week N` (and `--day Mon` to shrink the job).
3. The check mark needs nothing: `/dashboard/program` shows it on any session with a logged Hevy workout, and the briefing appears under it.

## 8. Reply to the user

Short and in this order: one line per briefed session (verdict + the single most important fact), what changed in the plan and why
(grouped by lift), substitutions acted on or questions to answer, the PR outlook, and anything the push did not finish. Do not paste
the raw report.
