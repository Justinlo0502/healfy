import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysAgo, formatDate } from "@/lib/format";
import TrendsChart from "./TrendsChart";
import { TrendingUp } from "lucide-react";

const LOOKBACK_DAYS = 90;

export default async function TrendsPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const since = daysAgo(LOOKBACK_DAYS);

  const activities = await db.activity.findMany({
    where: {
      athleteId: athlete.id,
      startTime: { gte: since },
      aerobicEfficiency: { not: null },
    },
    orderBy: { startTime: "asc" },
  });

  const points = activities.map((a) => ({
    date: formatDate(a.startTime),
    aerobicEfficiency: a.aerobicEfficiency as number,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <TrendingUp className="h-6 w-6 text-accent" strokeWidth={2.5} />
        Trends
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Aerobic efficiency is meters covered per heartbeat-minute, calculated from easy runs
        only so effort level doesn&apos;t skew the comparison. A rising line over weeks means
        your aerobic engine is getting stronger — you&apos;re covering more ground for the same
        heart-rate cost.
      </p>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        {points.length > 1 ? (
          <TrendsChart points={points} />
        ) : (
          <p className="py-12 text-center text-sm text-muted">
            Not enough data yet — aerobic efficiency needs a few easy runs with heart-rate data
            to plot a trend.
          </p>
        )}
      </section>
    </main>
  );
}
