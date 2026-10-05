import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
const act: any = await db.activity.findUnique({ where: { id: "cmuq0io67000ksgkrpa9k0ukv" } });
const s = act.streamData;
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
// segment by 100m bins: pace and avg HR
let start = 0;
const rows: string[] = [];
for (let i = 1; i < s.time.length; i++) {
  if (s.distance[i] - s.distance[start] >= 250 || i === s.time.length - 1) {
    const d = s.distance[i] - s.distance[start], t = s.time[i] - s.time[start];
    const hr = s.heartrate.slice(start, i + 1); const avg = hr.reduce((a: number, b: number) => a + b, 0) / hr.length;
    rows.push(`${(s.distance[start]/1000).toFixed(2)}km t=${fmt(s.time[start])} pace=${d > 0 ? fmt(t / (d / 1000)) : "-"} hr=${Math.round(avg)} max=${Math.max(...hr)}`);
    start = i;
  }
}
console.log(rows.join("\n"));
console.log("total elapsed", fmt(s.time[s.time.length - 1]), "moving", act.movingTimeSec);
await db.$disconnect();
