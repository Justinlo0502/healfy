// Lists Comeback Block routines in Hevy that should be deleted by hand. Hevy's
// public API has no routine delete (DELETE /v1/routines/:id returns 404), so
// this only reads and prints a checklist. Two kinds:
//   1. PAST: sessions dated before today. They are done or skipped, so they
//      only clutter the routine list. The local HevyRoutine rows are kept (the
//      program page and the update report read them as each session's plan).
//   2. STALE DUPLICATE: a title that exists more than once. The copy Hevy
//      updated most recently is kept; older copies can show out-of-date weights.
// The repeating Thursday home routine ("CB Thu · …") is never listed as past.
//
//   npx tsx scripts/routine-cleanup.ts
import "dotenv/config";
import { listAllRoutines, type HevyRoutineDto } from "../src/lib/hevy";
import { PROGRAM_DAYS, dayDate } from "../src/lib/program";

async function main() {
  const today = new Date().toLocaleDateString("en-CA"); // local date, YYYY-MM-DD
  const cb = (await listAllRoutines()).filter((r) => r.title.startsWith("CB "));

  const byTitle = new Map<string, HevyRoutineDto[]>();
  for (const r of cb) byTitle.set(r.title, [...(byTitle.get(r.title) ?? []), r]);

  const isPast = (title: string) => {
    const m = /^CB W([0-9]+) (Mon|Wed|Fri|Sun)\b/.exec(title);
    const day = m && PROGRAM_DAYS.find((d) => d.key === m[2]);
    return Boolean(day) && dayDate(Number(m![1]), day!) < today;
  };

  const past: string[] = [];
  const stale: string[] = [];
  for (const [title, copies] of byTitle) {
    const newest = [...copies].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    if (isPast(title)) {
      past.push(...copies.map(() => title));
      continue;
    }
    for (const c of copies) if (c !== newest) stale.push(title);
  }
  const byWeek = (a: string, b: string) => a.localeCompare(b);

  console.log(`Comeback Block routines in Hevy: ${cb.length} (${byTitle.size} distinct titles), today ${today}`);
  console.log(`Delete by hand in Hevy (the API cannot): ${past.length + stale.length}`);
  console.log(`PAST sessions (${past.length}):`);
  for (const t of past.sort(byWeek)) console.log(`  - ${t}`);
  console.log(`STALE DUPLICATES of upcoming sessions (${stale.length}):`);
  for (const t of stale.sort(byWeek)) console.log(`  - ${t} (delete the older copy; keep the most recently updated)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
