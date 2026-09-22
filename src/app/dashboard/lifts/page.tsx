import fs from "fs";
import path from "path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/format";
import HevyWorkoutListItem from "@/components/HevyWorkoutListItem";
import HevyHeatmap from "@/components/HevyHeatmap";
import HevyOneRmChart from "@/components/HevyOneRmChart";
import HevyMuscleBars from "@/components/HevyMuscleBars";
import HevyExercisePhoto from "@/components/HevyExercisePhoto";
import {
  consistencyHeatmap,
  heaviestLiftEver,
  liftStatTiles,
  muscleBalance,
  oneRepMaxSeries,
  personalRecord,
  topLifts,
} from "@/lib/hevyInsights";
import { Dumbbell, Flame, Folder, Scale, Timer, Trophy, Zap } from "lucide-react";

// Personal strength dashboard built from synced Hevy data — stat tiles,
// consistency heatmap, estimated-1RM trends, muscle balance, and personal
// records for your top lifts, plus the recent-activity view from before.

type PhotoManifestEntry = { matched: boolean; sourceName?: string };

function loadPhotoManifest(): Record<string, PhotoManifestEntry> {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "public", "hevy-photos", "manifest.json"),
      "utf8"
    );
    return JSON.parse(raw) as Record<string, PhotoManifestEntry>;
  } catch {
    return {};
  }
}

function photoFor(
  manifest: Record<string, PhotoManifestEntry>,
  exerciseTemplateId: string
): { frame0: string; frame1: string } | null {
  const entry = manifest[exerciseTemplateId];
  if (!entry?.matched) return null;
  return {
    frame0: `/hevy-photos/${exerciseTemplateId}/0.jpg`,
    frame1: `/hevy-photos/${exerciseTemplateId}/1.jpg`,
  };
}

export default async function LiftsPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const hevyAccount = await db.hevyAccount.findUnique({ where: { athleteId: athlete.id } });

  if (!hevyAccount) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="gradient-accent flex h-14 w-14 items-center justify-center rounded-2xl text-accent-foreground shadow-card">
          <Dumbbell className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight">Hevy isn&apos;t connected</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Connect Hevy in Settings to pull in your strength training workouts and routines.
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

  const [allWorkouts, recentWorkouts, routines, folders, templates] = await Promise.all([
    db.hevyWorkout.findMany({ where: { athleteId: athlete.id } }),
    db.hevyWorkout.findMany({
      where: { athleteId: athlete.id },
      orderBy: { startTime: "desc" },
      take: 20,
    }),
    db.hevyRoutine.findMany({ where: { athleteId: athlete.id }, orderBy: { title: "asc" } }),
    db.hevyRoutineFolder.findMany({ where: { athleteId: athlete.id }, orderBy: { hevyIndex: "asc" } }),
    db.hevyExerciseTemplate.findMany({ where: { athleteId: athlete.id } }),
  ]);

  if (allWorkouts.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <div className="gradient-accent flex h-14 w-14 items-center justify-center rounded-2xl text-accent-foreground shadow-card">
          <Dumbbell className="h-7 w-7" strokeWidth={2.5} />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight">No workouts synced yet</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Hit &quot;Sync now&quot; in Settings to pull in your Hevy workout history.
        </p>
      </main>
    );
  }

  const manifest = loadPhotoManifest();
  const stats = liftStatTiles(allWorkouts);
  const hero = heaviestLiftEver(allWorkouts, templates);
  const heroPhoto = hero ? photoFor(manifest, hero.exerciseTemplateId) : null;
  const heatmapDays = consistencyHeatmap(allWorkouts, 52);
  const mainLifts = topLifts(allWorkouts, templates, 6);
  const muscleGroups = muscleBalance(allWorkouts, templates, 8);

  const routinesByFolder = new Map<string | null, typeof routines>();
  for (const routine of routines) {
    routinesByFolder.set(routine.folderId, [...(routinesByFolder.get(routine.folderId) ?? []), routine]);
  }
  const unfiledRoutines = routinesByFolder.get(null) ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      {/* Hero */}
      <div className="gradient-accent relative overflow-hidden rounded-3xl p-6 text-accent-foreground shadow-card sm:p-8">
        {heroPhoto ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroPhoto.frame0}
              alt=""
              aria-hidden
              className="exercise-photo-frame-a absolute inset-0 h-full w-full object-cover opacity-30"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroPhoto.frame1}
              alt=""
              aria-hidden
              className="exercise-photo-frame-b absolute inset-0 h-full w-full object-cover opacity-30"
            />
          </>
        ) : null}
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-wide opacity-80">
            {athlete.displayName ?? "Lifter"} · Lifts
          </p>
          {hero ? (
            <>
              <p className="mt-3 text-5xl font-extrabold tracking-tight tabular-nums sm:text-6xl">
                {Math.round(hero.weightKg)}<span className="text-2xl">kg</span>
              </p>
              <p className="mt-1 text-sm opacity-90">
                {hero.title} · {hero.reps} rep{hero.reps === 1 ? "" : "s"} · heaviest lift on record ·{" "}
                {formatDate(hero.date)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-lg font-semibold">Keep logging to build up your stats.</p>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total workouts", value: stats.totalWorkouts, icon: Dumbbell },
          { label: "This year", value: stats.workoutsThisYear, icon: Zap },
          { label: "Last 30 days", value: stats.workoutsLast30Days, icon: Flame },
          { label: "Total hours", value: stats.totalHours, icon: Timer },
          { label: "Volume (kg)", value: stats.totalVolumeKg.toLocaleString(), icon: Scale },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <tile.icon className="h-4 w-4 text-muted" strokeWidth={2.5} />
            <p className="mt-2 text-2xl font-extrabold tracking-tight tabular-nums">{tile.value}</p>
            <p className="text-xs text-muted">{tile.label}</p>
          </div>
        ))}
      </div>

      {/* Consistency heatmap */}
      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold text-muted">Consistency</h2>
        <p className="mt-1 text-xs text-muted">Last 52 weeks, shaded by minutes trained.</p>
        <div className="mt-4">
          <HevyHeatmap days={heatmapDays} />
        </div>
      </section>

      {/* 1RM trends */}
      {mainLifts.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-muted">Estimated 1RM Trend</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mainLifts.map((lift) => {
              const series = oneRepMaxSeries(allWorkouts, lift.exerciseTemplateId).map((p) => ({
                date: formatDate(p.date),
                oneRm: Math.round(p.oneRm * 10) / 10,
              }));
              return (
                <div key={lift.exerciseTemplateId} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <div className="flex items-center gap-2.5">
                    <HevyExercisePhoto
                      title={lift.title}
                      photo={photoFor(manifest, lift.exerciseTemplateId)}
                      className="h-10 w-10 shrink-0"
                    />
                    <p className="truncate text-sm font-semibold">{lift.title}</p>
                  </div>
                  {series.length >= 2 ? (
                    <HevyOneRmChart points={series} />
                  ) : (
                    <p className="mt-4 text-center text-xs text-muted">Not enough data points yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Muscle balance */}
      {muscleGroups.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <h2 className="text-sm font-semibold text-muted">Muscle Balance</h2>
          <p className="mt-1 text-xs text-muted">Working sets by primary muscle group, last 8 weeks.</p>
          <div className="mt-4">
            <HevyMuscleBars data={muscleGroups} />
          </div>
        </section>
      ) : null}

      {/* Personal records */}
      {mainLifts.length > 0 ? (
        <section className="mt-8">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Trophy className="h-4 w-4" /> Personal Records
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mainLifts.map((lift) => {
              const pr = personalRecord(allWorkouts, lift.exerciseTemplateId, lift.title);
              return (
                <div
                  key={lift.exerciseTemplateId}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card"
                >
                  <HevyExercisePhoto
                    title={lift.title}
                    photo={photoFor(manifest, lift.exerciseTemplateId)}
                    className="h-14 w-14 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lift.title}</p>
                    <p className="mt-0.5 tabular-nums text-lg font-extrabold tracking-tight">
                      {pr.heaviestSet ? `${pr.heaviestSet.weightKg}kg × ${pr.heaviestSet.reps}` : "—"}
                    </p>
                    <p className="text-xs text-muted">
                      {pr.bestOneRm ? `Est. 1RM ${pr.bestOneRm.oneRm.toFixed(1)}kg` : "No estimate yet"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Recent activity */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Zap className="h-4 w-4" /> Recent Workouts
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {recentWorkouts.map((workout) => (
              <li key={workout.id}>
                <HevyWorkoutListItem workout={workout} />
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <Folder className="h-4 w-4" /> Routines
          </h2>
          <div className="mt-3 flex flex-col gap-4">
            {folders.map((folder) => {
              const folderRoutines = routinesByFolder.get(folder.id) ?? [];
              if (folderRoutines.length === 0) return null;
              return (
                <div key={folder.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                  <p className="text-xs font-semibold text-muted">{folder.title}</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {folderRoutines.map((r) => (
                      <li key={r.id} className="text-sm font-medium">
                        {r.title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}

            {unfiledRoutines.length > 0 ? (
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <p className="text-xs font-semibold text-muted">Unfiled</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {unfiledRoutines.map((r) => (
                    <li key={r.id} className="text-sm font-medium">
                      {r.title}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {routines.length === 0 ? <p className="text-sm text-muted">No routines synced yet.</p> : null}
          </div>
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        {hevyAccount.lastSyncedAt ? `Last synced ${formatDateTime(hevyAccount.lastSyncedAt)}` : null}
      </p>
    </main>
  );
}
