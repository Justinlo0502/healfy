import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
const ws = await db.hevyWorkout.findMany({ orderBy: { startTime: "desc" }, take: 40 });
const tpl = new Map((await db.hevyExerciseTemplate.findMany()).map(t => [t.hevyExerciseTemplateId, t.title]));
for (const w of ws) for (const e of w.exercises as any[]) {
  const t = e.title ?? tpl.get(e.exercise_template_id);
  if (/Pull Up \(Weighted\)|Pushdown|Leg Curl/.test(t)) console.log(w.startTime.toISOString().slice(0,10), w.title.slice(0,12), t, JSON.stringify((e.sets||[]).map((s:any)=>[s.type,s.weight_kg,s.reps])));
}
await db.$disconnect();
