import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate, formatDistanceKm, formatDuration } from "@/lib/format";
import { CheckCircle2, ClipboardList, Circle } from "lucide-react";
import { WorkoutSteps } from "./WorkoutSteps";

// PlannedWorkout.structure is the raw Garmin workout detail object (see
// src/lib/garmin.ts syncWorkouts) — estimatedDurationInSecs/
// estimatedDistanceInMeters are top-level fields on it when present.
type WorkoutStructure = {
  estimatedDurationInSecs?: number;
  estimatedDistanceInMeters?: number;
};

export default async function PlannedPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const planned = await db.plannedWorkout.findMany({
    where: { athleteId: athlete.id },
    orderBy: { scheduledDate: "desc" },
    include: { activity: true },
  });

  const now = new Date();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <ClipboardList className="h-6 w-6 text-accent" strokeWidth={2.5} />
        Planned Runs
      </h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Structured workouts pushed to your watch (e.g. from Runna), synced from Garmin&apos;s workout library.
      </p>

      <ul className="mt-6 flex flex-col gap-2">
        {planned.map((workout) => {
          const structure = workout.structure as WorkoutStructure | null;
          const isDone = workout.activity != null;
          // Don't call an undone workout "skipped"/"missed" unless its date
          // has clearly passed — it may just not be due yet.
          const isPastDue = !isDone && workout.scheduledDate < now;

          return (
            <li
              key={workout.id}
              className="rounded-2xl border border-line bg-surface p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{workout.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{formatDate(workout.scheduledDate)}</p>
                  {structure?.estimatedDurationInSecs || structure?.estimatedDistanceInMeters ? (
                    <p className="mt-1.5 text-xs text-muted">
                      {structure.estimatedDistanceInMeters
                        ? formatDistanceKm(structure.estimatedDistanceInMeters)
                        : null}
                      {structure.estimatedDistanceInMeters && structure.estimatedDurationInSecs ? " · " : ""}
                      {structure.estimatedDurationInSecs ? formatDuration(structure.estimatedDurationInSecs) : null}
                    </p>
                  ) : null}
                </div>

                {isDone ? (
                  <Link
                    href={`/dashboard/runs/${workout.activity!.id}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-good-bg px-3 py-1.5 text-xs font-semibold text-good hover:opacity-80"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                  </Link>
                ) : (
                  <span
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      isPastDue ? "bg-warn-bg text-warn" : "bg-surface-2 text-muted"
                    }`}
                  >
                    <Circle className="h-3.5 w-3.5" /> {isPastDue ? "Not done" : "Upcoming"}
                  </span>
                )}
              </div>

              <WorkoutSteps structure={workout.structure} />
            </li>
          );
        })}
      </ul>

      {planned.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">
          No planned workouts synced yet — connect Garmin in Settings and sync to pull in your workout library.
        </p>
      ) : null}
    </main>
  );
}
