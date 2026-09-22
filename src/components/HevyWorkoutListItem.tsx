import { Dumbbell } from "lucide-react";
import { formatDate, formatDuration } from "@/lib/format";
import type { HevyExercise } from "@/lib/hevy";

type HevyWorkoutRowData = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  exercises: unknown;
};

export default function HevyWorkoutListItem({ workout }: { workout: HevyWorkoutRowData }) {
  const exercises = (workout.exercises as HevyExercise[] | null) ?? [];
  const setCount = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const durationSec =
    workout.endTime != null
      ? Math.max(0, Math.round((workout.endTime.getTime() - workout.startTime.getTime()) / 1000))
      : null;
  const topExercises = exercises.slice(0, 3).map((e) => e.title);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Dumbbell className="h-4 w-4" strokeWidth={2.5} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-semibold">{workout.title}</p>
            <span className="shrink-0 tabular-nums text-xs text-muted">
              {exercises.length} exercise{exercises.length === 1 ? "" : "s"} · {setCount} set
              {setCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            <span>{formatDate(workout.startTime)}</span>
            {durationSec != null ? (
              <>
                <span>·</span>
                <span>{formatDuration(durationSec)}</span>
              </>
            ) : null}
          </div>

          {topExercises.length > 0 ? (
            <p className="mt-1.5 truncate text-xs text-muted">{topExercises.join(", ")}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
