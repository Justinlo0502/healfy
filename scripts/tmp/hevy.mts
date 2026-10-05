import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
const a = await db.athlete.findFirst();
console.log("HEVY ACCOUNT", JSON.stringify(await (db as any).hevyAccount?.findUnique({ where: { athleteId: a!.id }, select: { id: true, lastSyncedAt: true } }) ?? null));
const models = Object.keys(db).filter(k => !k.startsWith("$") && !k.startsWith("_"));
console.log("MODELS", models.join(","));
await db.$disconnect();
