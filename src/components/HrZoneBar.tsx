// Small horizontal bar visualizing time-in-zone as five proportional
// segments. Pure presentational, no interactivity required.

const ZONE_COLOR: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-surface-2",
  2: "bg-good",
  3: "bg-accent2",
  4: "bg-warn",
  5: "bg-danger",
};

export default function HrZoneBar({
  zones,
  className = "",
}: {
  zones: Record<1 | 2 | 3 | 4 | 5, number>;
  className?: string;
}) {
  const total = zones[1] + zones[2] + zones[3] + zones[4] + zones[5];

  if (total <= 0) {
    return <div className={`h-2.5 w-full rounded-full bg-surface-2 ${className}`} />;
  }

  return (
    <div
      className={`flex h-2.5 w-full overflow-hidden rounded-full border border-line ${className}`}
      title="Time in HR zones 1-5"
    >
      {([1, 2, 3, 4, 5] as const).map((zone) => {
        const pct = (zones[zone] / total) * 100;
        if (pct <= 0) return null;
        return (
          <div
            key={zone}
            className={ZONE_COLOR[zone]}
            style={{ width: `${pct}%` }}
          />
        );
      })}
    </div>
  );
}
