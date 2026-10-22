import { ChevronDown, Dumbbell } from "lucide-react";
import { formatDate, formatDuration, kgToLb } from "@/lib/format";
import type { HevyExercise } from "@/lib/hevy";

type HevyWorkoutRowData = {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date | null;
  exercises: unknown;
};

type SetData = HevyExercise["sets"][number];

/** One set as "225.00 lb × 6" (weights always pounds, 2 decimals); warm-ups get a "W" prefix. */
function setLabel(s: SetData): string {
  const prefix = s.type === "warmup" ? "W " : "";
  const weight = s.weight_kg != null && s.weight_kg > 0 ? `${kgToLb(s.weight_kg).toFixed(2)} lb` : null;
  if (s.reps != null) return `${prefix}${weight ? `${weight} × ` : "BW × "}${s.reps}`;
  if (s.duration_seconds != null) return `${prefix}${s.duration_seconds} s`;
  if (s.distance_meters != null) return `${prefix}${weight ? `${weight} · ` : ""}${s.distance_meters} m`;
  return `${prefix}${weight ?? "—"}`;
}

export default function HevyWorkoutListItem({ workout }: { workout: HevyWorkoutRowData }) {
  const exercises = (workout.exercises as HevyExercise[] | null) ?? [];
  const setCount = exercises.reduce((sum, e) => sum + e.sets.length, 0);
  const durationSec =
    workout.endTime != null
      ? Math.max(0, Math.round((workout.endTime.getTime() - workout.startTime.getTime()) / 1000))
      : null;
  const topExercises = exercises.slice(0, 3).map((e) => e.title);

  return (
    <details className="group rounded-2xl border border-line bg-surface shadow-card">
      <summary className="flex cursor-pointer list-none items-center gap-3.5 p-4 [&::-webkit-details-marker]:hidden">
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
        <ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>

      <ul className="flex flex-col gap-2.5 border-t border-line px-4 py-3">
        {exercises.map((e, i) => (
          <li key={`${e.exercise_template_id}-${i}`}>
            <p className="text-sm font-semibold">{e.title}</p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-muted">{e.sets.map(setLabel).join("  ·  ")}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
