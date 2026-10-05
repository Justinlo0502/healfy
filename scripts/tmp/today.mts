import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
import { executeTool } from "../../src/lib/chat-tools.ts";
const a = await db.athlete.findFirst();
console.log("ATHLETE", JSON.stringify({ maxHR: a!.maxHR, restingHR: a!.restingHR }));
console.log("PLAN", JSON.stringify(await executeTool("compare_planned_vs_actual", { days: 14 }, a!.id)));
console.log("RECOVERY", JSON.stringify(await executeTool("get_recovery_status", { days: 3 }, a!.id)));
console.log("RECENT", JSON.stringify(await executeTool("get_recent_activities", { limit: 8 }, a!.id)));
await db.$disconnect();
