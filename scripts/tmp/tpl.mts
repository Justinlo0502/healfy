import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
const t = await db.hevyExerciseTemplate.findMany({ where: { title: { contains: "Deadlift", mode: "insensitive" } } });
for (const x of t) console.log(x.hevyExerciseTemplateId, "|", x.title, "|", x.type);
await db.$disconnect();
