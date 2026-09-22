import type { MuscleGroupSets } from "@/lib/hevyInsights";

/** Horizontal bars, single accent color that gets darker (more opaque) as the value grows. */
export default function HevyMuscleBars({ data }: { data: MuscleGroupSets[] }) {
  const max = Math.max(1, ...data.map((d) => d.sets));

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => {
        const pct = Math.max(4, Math.round((d.sets / max) * 100));
        const opacity = 0.35 + 0.65 * (d.sets / max);
        return (
          <div key={d.muscleGroup} title={`${d.sets} sets`} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs capitalize text-muted">{d.muscleGroup}</span>
            <div className="h-3 flex-1 rounded-full bg-surface-2">
              <div
                className="h-3 rounded-full bg-accent"
                style={{ width: `${pct}%`, opacity }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">{d.sets}</span>
          </div>
        );
      })}
    </div>
  );
}
