// MCP server exposing Healfy's own data to Claude Desktop (or any MCP
// client) over stdio. No ANTHROPIC_API_KEY needed here — Claude Desktop
// *is* the model; this process only serves tool calls to it, the same role
// src/lib/chat-tools.ts already plays for the in-app coach.
//
// Reuses executeTool() (src/lib/chat-tools.ts) directly for every tool's
// actual implementation — only the schema declaration is duplicated here in
// zod, since MCP and the Anthropic SDK use different schema formats with no
// shared representation.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// db.ts falls back to the relative "file:./dev.db" (src/lib/db.ts) — Claude
// Desktop spawns this process with an unpredictable working directory, so
// pin an absolute path before db.ts is ever imported.
process.env.DATABASE_URL = `file:${path.resolve(__dirname, "../dev.db")}`;

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { db } from "../src/lib/db";
import { executeTool } from "../src/lib/chat-tools";

const server = new McpServer({ name: "healfy", version: "1.0.0" });

let athleteId: string | null = null;
async function getAthleteId(): Promise<string> {
  if (athleteId) return athleteId;
  const athlete = await db.athlete.findFirst();
  if (!athlete) {
    throw new Error("No athlete found in Healfy's database — run `npm run seed` first.");
  }
  athleteId = athlete.id;
  return athleteId;
}

async function handle(name: string, args: unknown) {
  const id = await getAthleteId();
  const result = await executeTool(name, args, id);
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}

server.registerTool(
  "get_recent_activities",
  {
    description:
      "Get the athlete's most recent training activities (runs, rides, etc.), most recent first. Returns id, name, type, startTime, distanceMeters, movingTimeSec, avgHR, avgPaceSecPerKm, trainingLoad, aerobicEfficiency, and hrDriftPct for each activity.",
    inputSchema: {
      limit: z.number().optional().describe("Maximum number of activities to return. Defaults to 10."),
      days: z.number().optional().describe("Only include activities from the last N days. Omit for no date filter."),
    },
  },
  (args) => handle("get_recent_activities", args)
);

server.registerTool(
  "get_activity_detail",
  {
    description:
      "Get full detail for one specific activity, including a breakdown of time spent in each heart-rate zone (1-5). Get the activityId from get_recent_activities first if you don't already have it.",
    inputSchema: {
      activityId: z.string().describe("The activity's id, as returned by get_recent_activities."),
    },
  },
  (args) => handle("get_activity_detail", args)
);

server.registerTool(
  "get_training_load_status",
  {
    description:
      "Get the athlete's current acute:chronic workload ratio (ACWR) — 7-day average training load vs. 28-day average — plus a plain-English read of whether training load looks healthy, undertraining, or overtraining/elevated injury risk.",
    inputSchema: {},
  },
  (args) => handle("get_training_load_status", args)
);

server.registerTool(
  "get_recovery_status",
  {
    description:
      "Get the athlete's recent recovery/readiness signals from Garmin: Body Battery, HRV status, sleep score, and training readiness. If Garmin isn't connected there will be no rows returned.",
    inputSchema: {
      days: z.number().optional().describe("How many days of recent metrics to return. Defaults to 14."),
    },
  },
  (args) => handle("get_recovery_status", args)
);

server.registerTool(
  "compare_planned_vs_actual",
  {
    description:
      "Compare the athlete's planned/structured workouts (from their training plan) against what they actually did, for recent and upcoming workouts. Clearly flags planned workouts with no matching completed activity yet.",
    inputSchema: {
      days: z.number().optional().describe("How many days back to look for planned workouts. Defaults to 14."),
    },
  },
  (args) => handle("compare_planned_vs_actual", args)
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Healfy MCP server failed to start:", err);
  process.exit(1);
});
