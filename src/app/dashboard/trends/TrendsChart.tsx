"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { date: string; aerobicEfficiency: number };

export default function TrendsChart({ points }: { points: Point[] }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--muted)" }} stroke="var(--line)" />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            stroke="var(--line)"
            width={48}
            label={{
              value: "m / bpm-min",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
              fill: "var(--muted)",
            }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="aerobicEfficiency"
            name="Aerobic efficiency"
            stroke="var(--accent2)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
