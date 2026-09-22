"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; oneRm: number };

export default function HevyOneRmChart({ points }: { points: Point[] }) {
  return (
    <div className="h-32 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted)" }} stroke="var(--line)" />
          <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)} kg`, "Est. 1RM"]}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="oneRm"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
