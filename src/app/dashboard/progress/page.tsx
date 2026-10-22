import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { liftProgress } from "@/lib/progress";
import { PROGRAM_LOG } from "@/lib/programLog";
import { PROGRAM_NAME } from "@/lib/program";
import { ClipboardList, Target } from "lucide-react";
import ProgressChart from "./ProgressChart";

// Expected vs actual estimated 1RM for the Comeback Block, plus the manual log
// of program changes. Everything is derived from synced Hevy sets.

const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(2));
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;

export default async function ProgressPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const workouts = await db.hevyWorkout.findMany({
    where: { athleteId: athlete.id, title: { startsWith: "CB W" } },
  });
  const lifts = liftProgress(workouts);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div className="gradient-accent relative overflow-hidden rounded-3xl p-6 text-accent-foreground shadow-card sm:p-8">
        <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide opacity-80">
          <Target className="h-4 w-4" strokeWidth={2.5} /> {PROGRAM_NAME} · progress
        </p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Expected vs actual 1RM</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-90">
          Expected is the Epley estimate from the original Oct 5 plan at the minimum reps (3), and it stays fixed when
          loads are revised, so beating it means you are ahead of the block. Actual is your best set of 10 reps or fewer in that session. Weights are in lb.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {lifts.map((l) => {
          const gap = l.onPaceFor != null && l.endExpected != null ? l.onPaceFor - l.endExpected : null;
          return (
            <div key={l.key} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <p className="text-xs font-semibold text-muted">{l.label}</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{fmt(l.onPaceFor)}</p>
              <p className="text-xs text-muted">end of block if the gap holds</p>
              <p className="mt-2 text-xs tabular-nums text-muted">
                Plan {fmt(l.endExpected)}
                {gap != null ? (
                  <span className={gap >= 0 ? "ml-1.5 font-semibold text-good" : "ml-1.5 font-semibold text-warn"}>
                    {signed(gap)} lb
                  </span>
                ) : null}
              </p>
            </div>
          );
        })}
      </div>

      {lifts.map((l) => (
        <section key={l.key} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-lg font-semibold">{l.label}</h2>
          <ProgressChart
            points={l.rows.map((r) => ({ week: `W${r.week}`, expected: r.expected1RM, actual: r.actual1RM }))}
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted">
                  <th className="border-b border-line py-2 pr-3 font-medium">Week</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Original</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Now</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Expected 1RM</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Top set</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Actual 1RM</th>
                  <th className="border-b border-line py-2 font-medium">vs plan</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {l.rows.map((r) => (
                  <tr key={r.week}>
                    <td className="border-b border-line py-2 pr-3 font-sans">W{r.week}</td>
                    <td className="border-b border-line py-2 pr-3">
                      {r.baselineLb != null ? `${r.baselineLb.toFixed(2)} × 3+` : "max test"}
                    </td>
                    <td className="border-b border-line py-2 pr-3">
                      {r.plannedLoadLb != null ? `${r.plannedLoadLb.toFixed(2)} × ${r.plannedReps}+` : "max test"}
                    </td>
                    <td className="border-b border-line py-2 pr-3">{fmt(r.expected1RM)}</td>
                    <td className="border-b border-line py-2 pr-3">
                      {r.actualTop ? `${r.actualTop.weightLb.toFixed(2)} × ${r.actualTop.reps}` : "—"}
                    </td>
                    <td className="border-b border-line py-2 pr-3">{fmt(r.actual1RM)}</td>
                    <td
                      className={`border-b border-line py-2 font-semibold ${
                        r.delta == null ? "text-muted" : r.delta >= 0 ? "text-good" : "text-warn"
                      }`}
                    >
                      {r.delta == null ? "—" : signed(r.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-1.5 text-lg font-semibold">
          <ClipboardList className="h-5 w-5" strokeWidth={2.5} /> Program update log
        </h2>
        <div className="mt-3 flex flex-col gap-5">
          {PROGRAM_LOG.map((e) => (
            <div key={e.date}>
              <p className="font-mono text-xs uppercase tracking-wide text-muted">{e.date}</p>
              <p className="font-semibold">{e.title}</p>
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5 text-sm">
                {e.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
