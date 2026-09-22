"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StreamData } from "@/lib/insights";
import { formatDuration } from "@/lib/format";

// recharts needs to run client-side; this component takes the already-
// fetched streamData and renders a dual-axis HR / pace-speed line chart.

export default function ActivityChart({ stream }: { stream: StreamData }) {
  const data = stream.time.map((t, i) => ({
    timeSec: Math.round(t),
    heartrate: stream.heartrate?.[i] ?? null,
    // Convert m/s to min/km pace for a more readable axis; guard against 0.
    paceMinPerKm:
      stream.velocity && stream.velocity[i] > 0 ? 1000 / stream.velocity[i] / 60 : null,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
          <XAxis
            dataKey="timeSec"
            tickFormatter={formatDuration}
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            label={{ value: "time", position: "insideBottomRight", offset: -4, fontSize: 11, fill: "var(--muted)" }}
            stroke="var(--line)"
          />
          <YAxis
            yAxisId="hr"
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            stroke="var(--line)"
            width={40}
            label={{ value: "bpm", angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted)" }}
          />
          <YAxis
            yAxisId="pace"
            orientation="right"
            reversed
            tick={{ fontSize: 12, fill: "var(--muted)" }}
            stroke="var(--line)"
            width={40}
            label={{ value: "min/km", angle: 90, position: "insideRight", fontSize: 11, fill: "var(--muted)" }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              const num = typeof value === "number" ? value : Number(value);
              if (name === "Pace") {
                if (!Number.isFinite(num)) return ["—", "Pace"];
                const min = Math.floor(num);
                const sec = Math.round((num - min) * 60);
                return [`${min}:${String(sec).padStart(2, "0")}/km`, "Pace"];
              }
              return [`${value} bpm`, "Heart rate"];
            }}
            labelFormatter={(label) => formatDuration(Number(label))}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="hr"
            type="monotone"
            dataKey="heartrate"
            name="Heart rate"
            stroke="var(--accent)"
            dot={false}
            strokeWidth={2}
            connectNulls
          />
          <Line
            yAxisId="pace"
            type="monotone"
            dataKey="paceMinPerKm"
            name="Pace"
            stroke="var(--accent2)"
            dot={false}
            strokeWidth={1.5}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
