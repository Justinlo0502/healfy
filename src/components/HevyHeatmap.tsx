import type { HeatmapDay } from "@/lib/hevyInsights";

const DOW_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

function levelFor(minutes: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (max <= 0) return 1;
  const frac = minutes / max;
  if (frac > 0.75) return 4;
  if (frac > 0.5) return 3;
  if (frac > 0.25) return 2;
  return 1;
}

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-surface-2",
  1: "bg-accent/25",
  2: "bg-accent/50",
  3: "bg-accent/75",
  4: "bg-accent",
};

/** GitHub-style contribution grid, one square per day, shaded by minutes trained. */
export default function HevyHeatmap({ days }: { days: HeatmapDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        <div className="flex flex-col gap-1 pr-1">
          {DOW_LABELS.map((label, i) => (
            <span key={i} className="flex h-3 items-center text-[10px] leading-none text-muted">
              {label}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date} — ${day.minutes} min`}
                className={`h-3 w-3 rounded-sm ${LEVEL_CLASSES[levelFor(day.minutes, max)]}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
