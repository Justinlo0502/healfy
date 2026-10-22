import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
const ws = await db.hevyWorkout.findMany({ orderBy: { startTime: "desc" }, take: 3 });
const tpl = new Map((await db.hevyExerciseTemplate.findMany()).map(t => [t.hevyExerciseTemplateId, t.title]));
for (const w of ws) {
  console.log("==", w.title, w.startTime.toISOString(), w.endTime?.toISOString());
  for (const e of w.exercises as any[]) {
    console.log(" ", e.title ?? tpl.get(e.exercise_template_id), "|", (e.sets||[]).map((s:any)=>`${s.type==="warmup"?"w":""}${s.weight_kg!=null?Math.round(s.weight_kg/0.45359237*10)/10:""}x${s.reps??s.duration_seconds??"-"}`).join(" "));
  }
}
await db.$disconnect();
