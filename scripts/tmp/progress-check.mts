import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
import { liftProgress } from "../../src/lib/progress.ts";
const w = await db.hevyWorkout.findMany({ where: { title: { startsWith: "CB W" } } });
for (const l of liftProgress(w)) {
  console.log(l.label, "end", l.endExpected, "latest", l.latestActual, "onPace", l.onPaceFor);
  for (const r of l.rows) console.log("  W"+r.week, r.plannedLoadLb, r.expected1RM, JSON.stringify(r.actualTop), r.actual1RM, r.delta);
}
await db.$disconnect();
