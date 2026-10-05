import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
const rs: any[] = await db.hevyRoutine.findMany({ where: { title: { contains: "W0" } } as any, orderBy: { updatedAt: "desc" } as any });
const mine: any = await db.hevyRoutine.findFirst({ where: { hevyRoutineId: "b384b116-e280-4ede-a1df-4213a4ee1c5b" } as any });
console.log("MINE", mine ? mine.title + " folder=" + mine.folderId : "gone");
for (const r of rs) {
  console.log("\nROUTINE", r.title, r.hevyRoutineId, "folder", r.folderId, r.updatedAt?.toISOString?.());
  for (const e of r.exercises as any[]) console.log(" ", e.title, "ss=" + (e.superset_id ?? ""), "rest=" + e.rest_seconds, JSON.stringify(e.sets.map((s: any) => `${s.type[0]}:${s.weight_kg != null ? Math.round(s.weight_kg / 0.45359237) : ""}x${s.reps ?? s.duration_seconds + "s"}`)), "|", (e.notes ?? "").slice(0, 140));
}
await db.$disconnect();
