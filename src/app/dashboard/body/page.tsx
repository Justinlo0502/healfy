import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { LB_PER_KG, daysAgo, formatDate } from "@/lib/format";
import BodyCharts, { type WeighInPoint } from "./BodyCharts";
import { Scale } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;
const TABLE_ROWS = 20;
const REWEIGH_WINDOW_MS = 10 * 60 * 1000;
const RATE_WINDOW_DAYS = 28;
const RATE_MIN_SPAN_DAYS = 14;

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/** Least-squares slope through (t ms, lb) points, in lb per week. */
function slopeLbPerWeek(points: { t: number; lb: number }[]): number {
  const meanT = average(points.map((p) => p.t)) as number;
  const meanLb = average(points.map((p) => p.lb)) as number;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.t - meanT) * (p.lb - meanLb);
    den += (p.t - meanT) ** 2;
  }
  return (num / den) * 7 * DAY_MS;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export default async function BodyPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const [renphoAccount, allReadings] = await Promise.all([
    db.renphoAccount.findUnique({ where: { athleteId: athlete.id } }),
    db.renphoMeasurement.findMany({
      where: { athleteId: athlete.id },
      orderBy: { measuredAt: "asc" },
    }),
  ]);

  // Stepping back on the scale seconds later records a separate reading;
  // collapse readings within REWEIGH_WINDOW_MS of the next into one weigh-in,
  // keeping the last.
  const weighIns = allReadings.filter(
    (m, i) =>
      i === allReadings.length - 1 ||
      allReadings[i + 1].measuredAt.getTime() - m.measuredAt.getTime() > REWEIGH_WINDOW_MS
  );

  if (weighIns.length === 0) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Scale className="h-6 w-6 text-accent" strokeWidth={2.5} />
          Body
        </h1>
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 py-12 text-center shadow-card">
          <p className="text-sm text-muted">
            {renphoAccount
              ? "No weigh-ins synced yet — step on the scale, then hit Sync now."
              : "Connect Renpho in Settings to track weigh-ins and body composition here."}
          </p>
          {!renphoAccount ? (
            <Link href="/settings" className="mt-2 inline-block text-sm font-medium text-accent2 hover:underline">
              Go to Settings
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  // Daily readings swing 1-3 lb with water and food, so each point also
  // carries the average of every weigh-in in the 7 days up to and including it.
  const points: WeighInPoint[] = weighIns.map((m, i) => {
    const t = m.measuredAt.getTime();
    const window: number[] = [];
    for (let j = i; j >= 0 && weighIns[j].measuredAt.getTime() > t - 7 * DAY_MS; j--) {
      window.push(weighIns[j].weightKg * LB_PER_KG);
    }
    return {
      t,
      weightLb: round2(m.weightKg * LB_PER_KG),
      avgLb: round2(average(window) as number),
      bodyFatPct: m.bodyFatPct,
    };
  });

  const latest = weighIns[weighIns.length - 1];
  const weekAgo = daysAgo(7);
  const thisWeekAvg = average(
    weighIns.filter((m) => m.measuredAt >= weekAgo).map((m) => m.weightKg * LB_PER_KG)
  );

  // Rate = trend-line slope through the last 4 weeks of weigh-ins, shown only
  // once they span 2+ weeks — over a few days it's mostly water noise.
  const rateWindow = points.filter((p) => p.t >= latest.measuredAt.getTime() - RATE_WINDOW_DAYS * DAY_MS);
  const rateSpanDays =
    rateWindow.length > 1 ? (rateWindow[rateWindow.length - 1].t - rateWindow[0].t) / DAY_MS : 0;
  const weeklyRate =
    rateSpanDays >= RATE_MIN_SPAN_DAYS
      ? slopeLbPerWeek(rateWindow.map((p) => ({ t: p.t, lb: p.weightLb })))
      : null;

  const stats = [
    {
      label: `Latest · ${formatDate(latest.measuredAt)}`,
      value: `${(latest.weightKg * LB_PER_KG).toFixed(2)} lb`,
    },
    { label: "7-day avg", value: thisWeekAvg != null ? `${thisWeekAvg.toFixed(2)} lb` : "—" },
    {
      label: "Rate (last 4 wks)",
      value:
        weeklyRate != null ? `${weeklyRate >= 0 ? "+" : ""}${weeklyRate.toFixed(2)} lb/wk` : "—",
      note: weeklyRate == null ? "Needs 2+ weeks of weigh-ins" : undefined,
    },
    {
      label: "Body fat",
      value: latest.bodyFatPct != null ? `${latest.bodyFatPct.toFixed(2)}%` : "—",
    },
  ];

  const recentRows = [...weighIns].reverse().slice(0, TABLE_ROWS);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Scale className="h-6 w-6 text-accent" strokeWidth={2.5} />
        Body
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Weigh-ins from your Renpho scale. Single readings bounce around with water and food, so
        judge progress by the 7-day average line rather than day to day.
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">{stat.value}</dd>
            {stat.note ? <dd className="mt-1 text-xs text-muted">{stat.note}</dd> : null}
          </div>
        ))}
      </dl>

      <BodyCharts points={points} />

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold">Recent weigh-ins</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 text-right font-medium">Weight</th>
                <th className="py-2 pr-4 text-right font-medium">Body fat</th>
                <th className="py-2 pr-4 text-right font-medium">Muscle mass</th>
                <th className="py-2 text-right font-medium">Water</th>
              </tr>
            </thead>
            <tbody className="tabular-nums font-mono whitespace-nowrap">
              {recentRows.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-4 font-sans">
                    {m.measuredAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-2 pr-4 text-right">{(m.weightKg * LB_PER_KG).toFixed(2)} lb</td>
                  <td className="py-2 pr-4 text-right">
                    {m.bodyFatPct != null ? `${m.bodyFatPct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {m.muscleMassKg != null ? `${(m.muscleMassKg * LB_PER_KG).toFixed(2)} lb` : "—"}
                  </td>
                  <td className="py-2 text-right">{m.waterPct != null ? `${m.waterPct.toFixed(2)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
