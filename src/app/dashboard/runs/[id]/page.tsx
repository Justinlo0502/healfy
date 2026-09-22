import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  gradeAdjustedPaceSecPerKm,
  hrZoneBoundaries,
  isZoneRelevantType,
  timeInHrZones,
  type StreamData,
} from "@/lib/insights";
import { formatDateTime, formatDistanceKm, formatDuration, formatPace } from "@/lib/format";
import { explainActivity } from "@/lib/narrative";
import HrZoneBar from "@/components/HrZoneBar";
import ActivityChart from "./ActivityChart";
import ElevationChart from "./ElevationChart";
import ActivityChat from "./ActivityChat";
import { ArrowLeft, CloudSun, Mountain, Sparkles } from "lucide-react";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const activity = await db.activity.findUnique({ where: { id } });
  if (!activity || activity.athleteId !== athlete.id) {
    notFound();
  }

  const stream = activity.streamData as unknown as StreamData | null;
  const lthr = athlete.lthr ?? 160;
  const zones = stream && isZoneRelevantType(activity.type) ? timeInHrZones(stream, lthr) : null;
  const boundaries = hrZoneBoundaries(lthr);
  const totalZoneSec = zones ? zones[1] + zones[2] + zones[3] + zones[4] + zones[5] : 0;
  const gradeAdjustedPace = stream ? gradeAdjustedPaceSecPerKm(stream) : null;

  const explanation = explainActivity(
    {
      type: activity.type,
      distanceMeters: activity.distanceMeters,
      movingTimeSec: activity.movingTimeSec,
      avgPaceSecPerKm: activity.avgPaceSecPerKm,
      avgHR: activity.avgHR,
      trainingLoad: activity.trainingLoad,
      aerobicEfficiency: activity.aerobicEfficiency,
      hrDriftPct: activity.hrDriftPct,
      elevationGainMeters: activity.elevationGainMeters,
      elevationLossMeters: activity.elevationLossMeters,
      temperatureC: activity.temperatureC,
      humidityPct: activity.humidityPct,
      streamData: stream,
    },
    { lthr: athlete.lthr }
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <Link href="/dashboard" className="flex items-center gap-1 text-sm font-medium text-accent2 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Dashboard
      </Link>

      <h1 className="mt-3 text-2xl font-bold tracking-tight">{activity.name}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>
          {formatDateTime(activity.startTime)} · {activity.type}
        </span>
        {activity.temperatureC != null ? (
          <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
            <CloudSun className="h-3.5 w-3.5" />
            {Math.round(activity.temperatureC)}°C
            {activity.humidityPct != null ? ` · ${activity.humidityPct}%` : ""}
          </span>
        ) : null}
        {activity.elevationGainMeters ? (
          <span className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium">
            <Mountain className="h-3.5 w-3.5" />+{Math.round(activity.elevationGainMeters)}m
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Distance" value={formatDistanceKm(activity.distanceMeters)} />
        <Stat label="Time" value={formatDuration(activity.movingTimeSec)} />
        <Stat label="Pace" value={formatPace(activity.avgPaceSecPerKm)} />
        <Stat label="Avg HR" value={activity.avgHR ? `${activity.avgHR} bpm` : "—"} />
      </div>

      {gradeAdjustedPace != null ? (
        <div className="mt-3 rounded-2xl border border-line bg-surface-2 p-4 shadow-card">
          <p className="text-xs font-medium text-muted">Grade-adjusted pace</p>
          <p className="tabular-nums mt-1 text-2xl font-extrabold tracking-tight text-accent2">
            {formatPace(gradeAdjustedPace)}
          </p>
          <p className="mt-1 text-xs text-muted">Effort-equivalent flat pace, accounting for this route&apos;s hills.</p>
        </div>
      ) : null}

      {stream?.elevation ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Mountain className="h-4 w-4" /> Elevation Profile
          </h2>
          <div className="mt-3">
            <ElevationChart stream={stream} />
          </div>
        </section>
      ) : null}

      {explanation.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Sparkles className="h-4 w-4 text-accent" /> What This Means
          </h2>
          <ul className="mt-3 flex flex-col gap-2.5">
            {explanation.map((sentence, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {sentence}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activity.hrDriftPct != null ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold text-muted">Aerobic Decoupling</h2>
          <p className="tabular-nums mt-2 text-2xl font-extrabold tracking-tight">
            {activity.hrDriftPct >= 0 ? "+" : ""}
            {activity.hrDriftPct.toFixed(1)}% decoupling
          </p>
          <p className="mt-2 text-sm text-muted">
            This compares your speed-per-heartbeat in the first half of the run against the
            second half. A positive number means your heart rate climbed relative to pace as
            the run went on — a sign of fatigue, heat, or dehydration. Values under ~5% are
            generally considered well-controlled aerobic effort.
          </p>
        </section>
      ) : null}

      {stream ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold text-muted">Heart Rate &amp; Pace</h2>
          <div className="mt-3">
            <ActivityChart stream={stream} />
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-sm text-muted">No detailed stream data available for this activity.</p>
        </section>
      )}

      {zones ? (
        <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold text-muted">Time in Zone</h2>
          <HrZoneBar zones={zones} className="mt-3" />
          <table className="mt-4 w-full text-sm">
            <tbody>
              {boundaries.map((z) => {
                const sec = zones[z.zone];
                const pct = totalZoneSec > 0 ? (sec / totalZoneSec) * 100 : 0;
                return (
                  <tr key={z.zone} className="border-t border-line">
                    <td className="py-2 pr-3 text-muted">
                      Z{z.zone} · {z.label}
                    </td>
                    <td className="py-2 pr-3 text-muted">
                      {z.lowBpm}–{z.highBpm === 999 ? "∞" : z.highBpm} bpm
                    </td>
                    <td className="tabular-nums py-2 pr-3 text-right">{formatDuration(sec)}</td>
                    <td className="tabular-nums py-2 text-right text-muted">{pct.toFixed(0)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-muted">Ask About This Run</h2>
        <ActivityChat activityId={activity.id} />
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="tabular-nums mt-1 text-xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
