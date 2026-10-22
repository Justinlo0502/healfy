"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { week: string; expected: number | null; actual: number | null };

const AXIS_TICK = { fontSize: 11, fill: "var(--muted)" };

export default function ProgressChart({ points }: { points: Point[] }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="week" tick={AXIS_TICK} stroke="var(--line)" />
          <YAxis tick={AXIS_TICK} stroke="var(--line)" width={40} domain={["dataMin - 10", "dataMax + 10"]} />
          <Tooltip
            formatter={(value, name) => [`${Number(value).toFixed(2)} lb`, name]}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="expected" name="Expected" stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={2} dot={{ r: 2 }} connectNulls />
          <Line type="monotone" dataKey="actual" name="Actual" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
