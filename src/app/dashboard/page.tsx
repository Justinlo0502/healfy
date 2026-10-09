import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { acwr } from "@/lib/insights";
import { LB_PER_KG, daysAgo, formatDate, formatDistanceKm, formatDuration, startOfToday } from "@/lib/format";
import ActivityListItem from "@/components/ActivityListItem";
import { ArrowRight, Battery, Gauge, Heart, Moon, Scale, Zap } from "lucide-react";

const LOOKBACK_DAYS = 60;

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

const ACWR_STYLES: Record<string, string> = {
  low: "bg-surface-2 text-muted",
  optimal: "bg-good-bg text-good",
  high: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
};

const ACWR_COPY: Record<string, string> = {
  low: "Load is low — room to build.",
  optimal: "Load is in the sweet spot.",
  high: "Load is climbing fast — watch recovery.",
  danger: "Load spike — elevated injury risk.",
};

export default async function DashboardPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const since = daysAgo(LOOKBACK_DAYS);

  const [activities, todayMetric, garminAccount, renphoAccount, weighIns] = await Promise.all([
    db.activity.findMany({
      where: { athleteId: athlete.id, startTime: { gte: since } },
      orderBy: { startTime: "desc" },
    }),
    db.dailyMetric.findFirst({
      where: {
        athleteId: athlete.id,
        date: { gte: startOfToday() },
      },
      orderBy: { date: "desc" },
    }),
    db.garminAccount.findUnique({ where: { athleteId: athlete.id } }),
    db.renphoAccount.findUnique({ where: { athleteId: athlete.id } }),
    db.renphoMeasurement.findMany({
      where: { athleteId: athlete.id, measuredAt: { gte: daysAgo(14) } },
      orderBy: { measuredAt: "desc" },
    }),
  ]);

  if (activities.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="gradient-accent flex h-14 w-14 items-center justify-center rounded-2xl text-accent-foreground shadow-card">
          <Zap className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight">No activities yet</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Connect Strava in Settings to pull in your runs and start seeing training-load and
          heart-rate insights.
        </p>
        <Link
          href="/settings"
          className="mt-6 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-card transition-opacity hover:opacity-90"
        >
          Go to Settings
        </Link>
      </main>
    );
  }

  const loads = activities
    .filter((a) => a.trainingLoad != null)
    .map((a) => ({ date: a.startTime, trainingLoad: a.trainingLoad as number }));
  const acwrResult = acwr(loads);

  const weekAgo = daysAgo(7);
  const thisWeek = activities.filter((a) => a.startTime >= weekAgo);
  const weekDistance = thisWeek.reduce((sum, a) => sum + a.distanceMeters, 0);
  const weekTime = thisWeek.reduce((sum, a) => sum + a.movingTimeSec, 0);

  const recent = activities.slice(0, 5);

  // Daily scale readings swing 1-3 lb with water and food, so the trend is
  // this week's average vs last week's rather than reading-to-reading.
  const latestWeighIn = weighIns[0] ?? null;
  const thisWeekAvgLb = average(
    weighIns.filter((m) => m.measuredAt >= weekAgo).map((m) => m.weightKg * LB_PER_KG)
  );
  const lastWeekAvgLb = average(
    weighIns.filter((m) => m.measuredAt < weekAgo).map((m) => m.weightKg * LB_PER_KG)
  );
  const weeklyChangeLb =
    thisWeekAvgLb != null && lastWeekAvgLb != null ? thisWeekAvgLb - lastWeekAvgLb : null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="reveal font-display text-3xl font-semibold italic tracking-tight">Dashboard</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <section
          className="reveal rounded-2xl border border-line bg-surface p-5 shadow-card"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <Gauge className="h-4 w-4" strokeWidth={2.5} />
            Acute:Chronic Load Ratio
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="tabular-nums font-mono text-4xl font-bold tracking-tight">
              {acwrResult.ratio != null ? acwrResult.ratio.toFixed(2) : "—"}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${ACWR_STYLES[acwrResult.status]}`}
            >
              {acwrResult.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted">{ACWR_COPY[acwrResult.status]}</p>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
            <div>
              <dt>7-day avg load</dt>
              <dd className="tabular-nums font-mono text-foreground">{acwrResult.acute7dAvg.toFixed(2)}</dd>
            </div>
            <div>
              <dt>28-day avg load</dt>
              <dd className="tabular-nums font-mono text-foreground">{acwrResult.chronic28dAvg.toFixed(2)}</dd>
            </div>
          </dl>
        </section>

        <section
          className="reveal rounded-2xl border border-line bg-surface p-5 shadow-card"
          style={{ animationDelay: "120ms" }}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <Zap className="h-4 w-4" strokeWidth={2.5} />
            Last 7 Days
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-xs text-muted">Distance</dt>
              <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">
                {formatDistanceKm(weekDistance)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Time</dt>
              <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">
                {formatDuration(weekTime)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Runs</dt>
              <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">{thisWeek.length}</dd>
            </div>
          </dl>
        </section>

        <section
          className="reveal rounded-2xl border border-line bg-surface p-5 shadow-card"
          style={{ animationDelay: "180ms" }}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <Moon className="h-4 w-4" strokeWidth={2.5} />
            Recovery
          </div>
          {todayMetric ? (
            <dl className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <dt className="flex items-center gap-1 text-xs text-muted">
                  <Battery className="h-3.5 w-3.5" /> Body Battery
                </dt>
                <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">
                  {todayMetric.bodyBattery ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-muted">
                  <Heart className="h-3.5 w-3.5" /> HRV Status
                </dt>
                <dd className="mt-1 text-base font-bold capitalize">
                  {todayMetric.hrvStatus?.toLowerCase() ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-xs text-muted">
                  <Moon className="h-3.5 w-3.5" /> Sleep Score
                </dt>
                <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">
                  {todayMetric.sleepScore ?? "—"}
                </dd>
              </div>
            </dl>
          ) : !garminAccount ? (
            <div className="mt-3">
              <p className="text-sm text-muted">
                Connect Garmin in Settings to see Body Battery, HRV, and sleep score here.
              </p>
              <Link href="/settings" className="mt-2 inline-block text-sm font-medium text-accent2 hover:underline">
                Go to Settings
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No recovery data synced for today yet.</p>
          )}
        </section>
      </div>

      <section
        className="reveal mt-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
        style={{ animationDelay: "210ms" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <Scale className="h-4 w-4" strokeWidth={2.5} />
            Body Weight
          </div>
          {latestWeighIn ? (
            <Link
              href="/dashboard/body"
              className="flex items-center gap-1 text-sm font-medium text-accent2 hover:underline"
            >
              View trend <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
        {latestWeighIn ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Latest · {formatDate(latestWeighIn.measuredAt)}</dt>
              <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">
                {(latestWeighIn.weightKg * LB_PER_KG).toFixed(2)} lb
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">7-day avg</dt>
              <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">
                {thisWeekAvgLb != null ? `${thisWeekAvgLb.toFixed(2)} lb` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">vs prior week</dt>
              <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">
                {weeklyChangeLb != null
                  ? `${weeklyChangeLb >= 0 ? "+" : ""}${weeklyChangeLb.toFixed(2)} lb`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Body fat</dt>
              <dd className="tabular-nums font-mono mt-1 text-xl font-bold tracking-tight">
                {latestWeighIn.bodyFatPct != null ? `${latestWeighIn.bodyFatPct.toFixed(2)}%` : "—"}
              </dd>
            </div>
          </dl>
        ) : !renphoAccount ? (
          <div className="mt-3">
            <p className="text-sm text-muted">
              Connect Renpho in Settings to track weigh-ins and body composition here.
            </p>
            <Link href="/settings" className="mt-2 inline-block text-sm font-medium text-accent2 hover:underline">
              Go to Settings
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No weigh-ins synced in the last 14 days.</p>
        )}
      </section>

      <section className="reveal mt-8" style={{ animationDelay: "240ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Recent Activities</h2>
          <Link
            href="/dashboard/activities"
            className="flex items-center gap-1 text-sm font-medium text-accent2 hover:underline"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <ul className="mt-3 flex flex-col gap-2">
          {recent.map((activity) => (
            <li key={activity.id}>
              <ActivityListItem activity={activity} />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
