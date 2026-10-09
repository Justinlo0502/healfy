"use client";

import { useState } from "react";
import type { TooltipContentProps } from "recharts";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WeighInPoint = {
  t: number;
  weightLb: number;
  avgLb: number;
  bodyFatPct: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGES = [
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "all", label: "All", days: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const AXIS_TICK = { fontSize: 12, fill: "var(--muted)" };
const TOOLTIP_STYLE = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  fontSize: 12,
};

// Pad the y-domain by 1 unit and snap to whole numbers so the line isn't
// pinned to the chart edges.
const PADDED_DOMAIN: [(min: number) => number, (max: number) => number] = [
  (min) => Math.floor(min - 1),
  (max) => Math.ceil(max + 1),
];

function formatFullDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Custom content rather than Tooltip's default, which would also list the
// scatter's x value (the raw timestamp) as a row.
function ChartTooltip({
  active,
  payload,
  rows,
}: Pick<TooltipContentProps<number, string>, "active" | "payload"> & {
  rows: { key: keyof WeighInPoint; label: string; unit: string }[];
}) {
  const point = payload?.[0]?.payload as WeighInPoint | undefined;
  if (!active || !point) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2 shadow-card">
      <p className="font-medium">{formatFullDate(point.t)}</p>
      {rows.map((row) =>
        point[row.key] != null ? (
          <p key={row.key} className="mt-1 text-muted">
            {row.label}{" "}
            <span className="tabular-nums font-mono text-foreground">
              {Number(point[row.key]).toFixed(2)}
              {row.unit}
            </span>
          </p>
        ) : null
      )}
    </div>
  );
}

const WEIGHT_ROWS = [
  { key: "weightLb", label: "Weigh-in", unit: " lb" },
  { key: "avgLb", label: "7-day avg", unit: " lb" },
] as const;
const FAT_ROWS = [{ key: "bodyFatPct", label: "Body fat", unit: "%" }] as const;

export default function BodyCharts({ points }: { points: WeighInPoint[] }) {
  const [range, setRange] = useState<RangeKey>("90d");

  const latestT = points[points.length - 1].t;
  const days = RANGES.find((r) => r.key === range)?.days ?? null;
  const visible = days == null ? points : points.filter((p) => p.t >= latestT - days * DAY_MS);
  const spanDays = visible.length > 1 ? (visible[visible.length - 1].t - visible[0].t) / DAY_MS : 0;
  const fatPoints = visible.filter((p) => p.bodyFatPct != null);

  const formatTick = (t: number) =>
    new Date(t).toLocaleDateString(
      undefined,
      spanDays > 180 ? { month: "short", year: "2-digit" } : { month: "short", day: "numeric" }
    );

  // Shared by both charts so their time axes line up for the same range.
  const xAxisProps = {
    dataKey: "t",
    type: "number" as const,
    scale: "time" as const,
    domain: ["dataMin", "dataMax"],
    tickFormatter: formatTick,
    tick: AXIS_TICK,
    stroke: "var(--line)",
    minTickGap: 24,
  };

  return (
    <>
      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Weight (lb)</h2>
            <div className="mt-1 flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted/60" /> Weigh-in
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-accent2" /> 7-day average
              </span>
            </div>
          </div>
          <div className="flex gap-1 rounded-full border border-line p-0.5 text-xs">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`rounded-full px-3 py-1 font-semibold transition-colors ${
                  range === r.key ? "bg-accent2/10 text-accent2" : "text-muted hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length > 0 ? (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={visible} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis {...xAxisProps} />
                <YAxis domain={PADDED_DOMAIN} tick={AXIS_TICK} stroke="var(--line)" width={40} allowDecimals={false} />
                <Tooltip
                  content={(props) => <ChartTooltip {...props} rows={[...WEIGHT_ROWS]} />}
                  cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                />
                <Scatter
                  dataKey="weightLb"
                  name="Weigh-in"
                  fill="var(--muted)"
                  fillOpacity={0.6}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="avgLb"
                  name="7-day average"
                  stroke="var(--accent2)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-muted">No weigh-ins in this range.</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-sm font-semibold">Body fat (%)</h2>
        {fatPoints.length > 1 ? (
          <div className="mt-4 h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={fatPoints} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis {...xAxisProps} />
                <YAxis domain={PADDED_DOMAIN} tick={AXIS_TICK} stroke="var(--line)" width={40} allowDecimals={false} />
                <Tooltip
                  content={(props) => <ChartTooltip {...props} rows={[...FAT_ROWS]} />}
                  cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                />
                <Line
                  type="linear"
                  dataKey="bodyFatPct"
                  name="Body fat"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted">Not enough body-fat readings in this range.</p>
        )}
      </section>
    </>
  );
}
