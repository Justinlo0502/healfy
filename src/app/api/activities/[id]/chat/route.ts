import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  gradeAdjustedPaceSecPerKm,
  hrZoneBoundaries,
  timeInHrZones,
  type StreamData,
} from "@/lib/insights";

// Per-activity chatbot: unlike the global coach (src/app/api/chat/route.ts),
// this is scoped to one fixed, already-known activity, so the full context
// is inlined into the system prompt once rather than fetched via a
// tool-calling loop — one Claude call per message, no tools needed.

const DEFAULT_LTHR = 160;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activity = await db.activity.findUnique({ where: { id } });
  if (!activity || activity.athleteId !== athlete.id) {
    return NextResponse.json({ error: "Activity not found" }, { status: 404 });
  }

  let body: { messages?: IncomingMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const incoming = body.messages;
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json({ error: "`messages` must be a non-empty array" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The activity coach isn't set up yet — add a real ANTHROPIC_API_KEY to .env to enable it." },
      { status: 500 }
    );
  }

  const lthr = athlete.lthr ?? DEFAULT_LTHR;
  const stream = (activity.streamData as unknown as StreamData | null) ?? null;
  const zoneSeconds = stream ? timeInHrZones(stream, lthr) : null;
  const gradeAdjustedPace = stream ? gradeAdjustedPaceSecPerKm(stream) : null;
  const hrZoneBreakdown = zoneSeconds
    ? hrZoneBoundaries(lthr).map((z) => ({ zone: z.zone, label: z.label, seconds: zoneSeconds[z.zone] }))
    : null;

  const context = {
    name: activity.name,
    type: activity.type,
    startTime: activity.startTime,
    distanceMeters: activity.distanceMeters,
    movingTimeSec: activity.movingTimeSec,
    avgPaceSecPerKm: activity.avgPaceSecPerKm,
    gradeAdjustedPaceSecPerKm: gradeAdjustedPace,
    avgHR: activity.avgHR,
    maxHR: activity.maxHR,
    trainingLoad: activity.trainingLoad,
    aerobicEfficiency: activity.aerobicEfficiency,
    hrDriftPct: activity.hrDriftPct,
    elevationGainMeters: activity.elevationGainMeters,
    elevationLossMeters: activity.elevationLossMeters,
    temperatureC: activity.temperatureC,
    humidityPct: activity.humidityPct,
    hrZoneBreakdown,
  };

  const system = `You are answering questions about one specific training activity inside Healfy. Here is everything known about it, as JSON — ground every number you state in this data, never invent or estimate one:

${JSON.stringify(context, null, 2)}

Keep answers short, specific, and conversational. If asked something this data can't answer (e.g. comparisons to other runs, or anything medical), say so plainly rather than guessing. You are not a medical professional — for pain or injury symptoms, suggest seeing a doctor or physio instead of advising on it yourself.`;

  const anthropic = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: incoming.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (err) {
    console.error("Anthropic request failed:", err);
    return NextResponse.json({ error: "The activity coach failed to respond. Please try again." }, { status: 502 });
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return NextResponse.json({
    role: "assistant",
    content: text || "I didn't have a response for that — could you rephrase the question?",
  });
}
