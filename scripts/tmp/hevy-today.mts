import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
import { syncHevyForAthlete } from "../../src/lib/hevy.ts";
const a = await db.athlete.findFirst();
console.log("SYNC", JSON.stringify(await syncHevyForAthlete(a!.id)));
const ws = await db.hevyWorkout.findMany({ where: { athleteId: a!.id } as any, orderBy: { startTime: "desc" } as any, take: 3 });
for (const w of ws as any[]) {
  console.log("\nWORKOUT", w.title, w.startTime.toISOString(), "->", w.endTime?.toISOString?.(), "desc:", w.description ?? "");
  for (const e of (w.exercises ?? []) as any[]) console.log(" ", e.title, e.superset_id ?? "", "|", e.notes ?? "", "|", JSON.stringify(e.sets.map((s: any) => `${s.type[0]}:${s.weight_kg != null ? Math.round(s.weight_kg / 0.45359237) + "lb" : ""}x${s.reps ?? (s.duration_seconds + "s")}${s.rpe ? "@" + s.rpe : ""}`)));
}
await db.$disconnect();
