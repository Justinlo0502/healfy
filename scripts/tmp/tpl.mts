import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
const t = await db.hevyExerciseTemplate.findMany({ where: { OR: [{title:{contains:"Cat"}},{title:{contains:"Hydrant"}},{title:{contains:"Bird"}},{title:{contains:"Scap"}},{title:{contains:"Pullapart"}},{title:{contains:"Pull Apart"}},{title:{contains:"Needle"}},{title:{contains:"Side Plank"}}] } });
console.log(t.map(x=>`${x.title} | ${x.type}`).join("\n"));
const r = await db.hevyRoutine.findMany({ where:{title:{startsWith:"CB W2"}}, select:{title:true}});
console.log(r.map(x=>x.title));
await db.$disconnect();
