import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
const a = await db.athlete.findFirst();
const fmt = (s: any) => `${s.type[0]}:${s.weight_kg != null ? Math.round(s.weight_kg / 0.45359237) + "lb" : "-"}x${s.reps ?? (s.duration_seconds != null ? s.duration_seconds + "s" : "-")}`;
for (const title of ["W1 Fri · Heavy pull + hinge", "W1 Mon · Heavy bench + squat", "Fri Oct 2 · Ankle-friendly pull + posterior chain"]) {
  const r: any = await db.hevyRoutine.findFirst({ where: { title } });
  console.log("\n=== ROUTINE", title);
  for (const e of r.exercises) console.log(" ", e.exercise_template_id, "|", e.title, "| ss", e.superset_id, "| rest", e.rest_seconds, "|", e.sets.map(fmt).join(" "), "|", e.notes ?? "");
}
const ws = await db.hevyWorkout.findMany({ where: { athleteId: a!.id }, orderBy: { startTime: "desc" }, take: 5 });
for (const w of ws as any[]) {
  console.log("\n=== WORKOUT", w.startTime.toISOString(), w.title);
  for (const e of w.exercises) console.log(" ", e.title, "|", e.sets.map(fmt).join(" "), e.notes ? "| " + e.notes : "");
}
await db.$disconnect();
