"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StreamData } from "@/lib/insights";
import { formatDuration } from "@/lib/format";

export default function ElevationChart({ stream }: { stream: StreamData }) {
  if (!stream.elevation || stream.elevation.length < 2) return null;

  const data = stream.time.map((t, i) => ({
    timeSec: Math.round(t),
    elevation: stream.elevation?.[i] ?? null,
  }));

  return (
    <div className="h-28 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="elevationFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent2)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="timeSec" hide />
          <YAxis domain={["dataMin - 5", "dataMax + 5"]} hide />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [`${Math.round(Number(value))}m`, "Elevation"]}
            labelFormatter={(label) => formatDuration(Number(label))}
          />
          <Area
            type="monotone"
            dataKey="elevation"
            stroke="var(--accent2)"
            strokeWidth={2}
            fill="url(#elevationFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
