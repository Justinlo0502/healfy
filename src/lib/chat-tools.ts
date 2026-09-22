// Tool definitions + server-side implementations for the AI coach chat
// (src/app/api/chat/route.ts). Every function here takes an athleteId
// resolved server-side from the session — the model never supplies one —
// so a tool call can only ever touch the logged-in athlete's own data.

import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { acwr, hrZoneBoundaries, timeInHrZones, type StreamData } from "@/lib/insights";

const DEFAULT_LTHR = 160;

// ---------------------------------------------------------------------
// Tool schemas (Anthropic Messages API tool-use format)
// ---------------------------------------------------------------------

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_recent_activities",
    description:
      "Get the athlete's most recent training activities (runs, rides, etc.), most recent first. Use this for questions about what workouts were done recently, or to get an overview of recent training. Returns id, name, type, startTime, distanceMeters, movingTimeSec, avgHR, avgPaceSecPerKm, trainingLoad, aerobicEfficiency, and hrDriftPct for each activity.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of activities to return. Defaults to 10.",
        },
        days: {
          type: "number",
          description: "Only include activities from the last N days. Omit for no date filter.",
        },
      },
    },
  },
  {
    name: "get_activity_detail",
    description:
      "Get full detail for one specific activity, including a breakdown of time spent in each heart-rate zone (1-5). Use this when the athlete asks about a specific run/ride (by name, date, or id) or wants zone-by-zone analysis of one workout. Get the activityId from get_recent_activities first if you don't already have it.",
    input_schema: {
      type: "object",
      properties: {
        activityId: {
          type: "string",
          description: "The activity's id, as returned by get_recent_activities.",
        },
      },
      required: ["activityId"],
    },
  },
  {
    name: "get_training_load_status",
    description:
      "Get the athlete's current acute:chronic workload ratio (ACWR) — 7-day average training load vs. 28-day average — plus a plain-English read of whether training load looks like a healthy range, undertraining, or overtraining/elevated injury risk. Use this to answer 'am I overtraining', 'is my training load ok', 'how's my load trending', or similar questions.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_recovery_status",
    description:
      "Get the athlete's recent recovery/readiness signals from their Garmin watch: Body Battery, HRV status, sleep score, and training readiness. Use this for questions about recovery, sleep, HRV, or readiness to train. If Garmin isn't connected there will be no rows returned — say so plainly rather than inventing numbers.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "How many days of recent metrics to return. Defaults to 14.",
        },
      },
    },
  },
  {
    name: "compare_planned_vs_actual",
    description:
      "Compare the athlete's planned/structured workouts (from their training plan) against what they actually did, for recent and upcoming workouts. Use this for questions like 'did I hit my paces this week' or 'was yesterday's run actually easy'. Clearly flags planned workouts that have no matching completed activity yet.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "How many days back to look for planned workouts. Defaults to 14.",
        },
      },
    },
  },
];

// ---------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function getRecentActivities(athleteId: string, args: { limit?: number; days?: number }) {
  const limit = typeof args.limit === "number" && args.limit > 0 ? Math.min(args.limit, 50) : 10;

  const activities = await db.activity.findMany({
    where: {
      athleteId,
      ...(typeof args.days === "number" && args.days > 0 ? { startTime: { gte: daysAgo(args.days) } } : {}),
    },
    orderBy: { startTime: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      type: true,
      startTime: true,
      distanceMeters: true,
      movingTimeSec: true,
      avgHR: true,
      avgPaceSecPerKm: true,
      trainingLoad: true,
      aerobicEfficiency: true,
      hrDriftPct: true,
    },
  });

  return { count: activities.length, activities };
}

async function getActivityDetail(athleteId: string, args: { activityId?: string }) {
  if (!args.activityId) {
    return { error: "activityId is required" };
  }

  const activity = await db.activity.findFirst({
    where: { id: args.activityId, athleteId },
  });

  if (!activity) {
    return { error: `No activity found with id ${args.activityId} for this athlete.` };
  }

  const athlete = await db.athlete.findUnique({ where: { id: athleteId }, select: { lthr: true } });
  const lthr = athlete?.lthr ?? DEFAULT_LTHR;

  const stream = (activity.streamData as unknown as StreamData | null) ?? null;
  const zoneSeconds = stream ? timeInHrZones(stream, lthr) : null;
  const boundaries = hrZoneBoundaries(lthr);

  const hrZoneBreakdown = zoneSeconds
    ? boundaries.map((z) => ({
        zone: z.zone,
        label: z.label,
        lowBpm: z.lowBpm,
        highBpm: z.highBpm,
        seconds: zoneSeconds[z.zone],
      }))
    : null;

  return {
    id: activity.id,
    name: activity.name,
    type: activity.type,
    startTime: activity.startTime,
    distanceMeters: activity.distanceMeters,
    movingTimeSec: activity.movingTimeSec,
    avgHR: activity.avgHR,
    maxHR: activity.maxHR,
    avgPaceSecPerKm: activity.avgPaceSecPerKm,
    trainingLoad: activity.trainingLoad,
    aerobicEfficiency: activity.aerobicEfficiency,
    hrDriftPct: activity.hrDriftPct,
    lthrUsed: lthr,
    lthrIsDefaultFallback: !athlete?.lthr,
    hrZoneBreakdown,
    hrZoneBreakdownNote: hrZoneBreakdown
      ? null
      : "No heart-rate stream data available for this activity, so a zone breakdown could not be computed.",
  };
}

async function getTrainingLoadStatus(athleteId: string) {
  const activities = await db.activity.findMany({
    where: {
      athleteId,
      trainingLoad: { not: null },
      startTime: { gte: daysAgo(35) },
    },
    select: { startTime: true, trainingLoad: true },
    orderBy: { startTime: "desc" },
  });

  const loads = activities.map((a) => ({ date: a.startTime, trainingLoad: a.trainingLoad as number }));
  const result = acwr(loads);

  let summary: string;
  if (result.ratio === null) {
    summary = "Not enough training history yet (need consistent logged loads over the last 28 days) to compute a reliable acute:chronic ratio.";
  } else {
    switch (result.status) {
      case "low":
        summary = `ACWR is ${result.ratio.toFixed(2)} (low) — recent load is running well below the 28-day average, which usually means undertraining or an intentional recovery block, not overtraining risk.`;
        break;
      case "optimal":
        summary = `ACWR is ${result.ratio.toFixed(2)}, inside the generally-cited optimal 0.8-1.3 range — recent training load looks well matched to your chronic fitness.`;
        break;
      case "high":
        summary = `ACWR is ${result.ratio.toFixed(2)} (high) — recent load has climbed notably above your 28-day average; this is worth watching for fatigue and it may be time to ease up.`;
        break;
      case "danger":
        summary = `ACWR is ${result.ratio.toFixed(2)} (danger zone, >1.5) — recent load is sharply elevated versus your chronic average, a range associated with meaningfully higher injury risk in the sports-science literature. This is a genuine signal to back off.`;
        break;
    }
  }

  return { ...result, summary };
}

async function getRecoveryStatus(athleteId: string, args: { days?: number }) {
  const days = typeof args.days === "number" && args.days > 0 ? Math.min(args.days, 90) : 14;

  const metrics = await db.dailyMetric.findMany({
    where: { athleteId, date: { gte: daysAgo(days) } },
    orderBy: { date: "desc" },
    select: {
      date: true,
      bodyBattery: true,
      hrvStatus: true,
      hrvMs: true,
      restingHR: true,
      sleepScore: true,
      trainingReadiness: true,
    },
  });

  if (metrics.length === 0) {
    return {
      connected: false,
      metrics: [],
      note: "No Garmin recovery data found for this athlete — Garmin isn't connected, or no daily metrics have synced yet. Don't invent Body Battery, HRV, sleep, or readiness numbers; tell the athlete Garmin data isn't available.",
    };
  }

  return { connected: true, count: metrics.length, metrics };
}

async function comparePlannedVsActual(athleteId: string, args: { days?: number }) {
  const days = typeof args.days === "number" && args.days > 0 ? Math.min(args.days, 90) : 14;

  const planned = await db.plannedWorkout.findMany({
    where: { athleteId, scheduledDate: { gte: daysAgo(days) } },
    orderBy: { scheduledDate: "desc" },
    include: { activity: true },
  });

  const comparisons = planned.map((p) => ({
    plannedWorkoutName: p.name,
    scheduledDate: p.scheduledDate,
    plannedStructure: p.structure,
    hasMatchingActivity: p.activity != null,
    actual: p.activity
      ? {
          id: p.activity.id,
          name: p.activity.name,
          type: p.activity.type,
          startTime: p.activity.startTime,
          distanceMeters: p.activity.distanceMeters,
          movingTimeSec: p.activity.movingTimeSec,
          avgHR: p.activity.avgHR,
          avgPaceSecPerKm: p.activity.avgPaceSecPerKm,
          trainingLoad: p.activity.trainingLoad,
          hrDriftPct: p.activity.hrDriftPct,
        }
      : null,
  }));

  const missingCount = comparisons.filter((c) => !c.hasMatchingActivity).length;

  return {
    count: comparisons.length,
    missingActivityCount: missingCount,
    note:
      missingCount > 0
        ? `${missingCount} of ${comparisons.length} planned workout(s) in this window have no matching completed activity yet — treat those as not-yet-done, not skipped or failed, unless the scheduled date is clearly in the past.`
        : "Every planned workout in this window has a matching completed activity.",
    comparisons,
  };
}

// ---------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------

export async function executeTool(
  name: string,
  input: unknown,
  athleteId: string
): Promise<unknown> {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  switch (name) {
    case "get_recent_activities":
      return getRecentActivities(athleteId, args as { limit?: number; days?: number });
    case "get_activity_detail":
      return getActivityDetail(athleteId, args as { activityId?: string });
    case "get_training_load_status":
      return getTrainingLoadStatus(athleteId);
    case "get_recovery_status":
      return getRecoveryStatus(athleteId, args as { days?: number });
    case "compare_planned_vs_actual":
      return comparePlannedVsActual(athleteId, args as { days?: number });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
