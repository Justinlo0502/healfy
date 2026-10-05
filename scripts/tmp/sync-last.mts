import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
import { executeTool } from "../../src/lib/chat-tools.ts";
import { syncGarminForAthlete } from "../../src/lib/garmin.ts";

const athlete = await db.athlete.findFirst();
if (!athlete) throw new Error("no athlete");
const sync = await syncGarminForAthlete(athlete.id);
console.log("SYNC", JSON.stringify(sync));
const recent: any = await executeTool("get_recent_activities", { limit: 1 }, athlete.id);
console.log("RECENT", JSON.stringify(recent));
const list = Array.isArray(recent) ? recent : recent.activities ?? [];
if (list[0]) console.log("DETAIL", JSON.stringify(await executeTool("get_activity_detail", { activityId: list[0].id }, athlete.id)));
console.log("LOAD", JSON.stringify(await executeTool("get_training_load_status", {}, athlete.id)));
await db.$disconnect();
