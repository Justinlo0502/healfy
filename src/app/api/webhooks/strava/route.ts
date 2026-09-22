import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncStravaForAthlete } from "@/lib/strava";

/**
 * Strava's subscription validation handshake. Strava calls this once when
 * you create/verify the webhook subscription with
 * ?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y and expects the
 * challenge echoed back if the verify token matches what you registered.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expectedToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && challenge && expectedToken && verifyToken === expectedToken) {
    return NextResponse.json({ "hub.challenge": challenge }, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
}

type StravaWebhookEvent = {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  [key: string]: unknown;
};

/**
 * Strava posts here whenever a subscribed athlete creates/updates/deletes
 * an activity. Strava expects a fast 200 ack, so we look up the athlete
 * and kick off a sync but never let a sync failure turn into a non-200
 * response (Strava retries aggressively on non-2xx, which would just
 * hammer the endpoint further).
 */
export async function POST(req: NextRequest) {
  let event: StravaWebhookEvent | null = null;
  try {
    event = await req.json();
  } catch {
    // Malformed body — nothing we can do with it, but still ack so Strava
    // doesn't retry forever.
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  if (event && event.object_type === "activity") {
    handleActivityEvent(event).catch((err) => {
      console.error("Strava webhook sync failed:", err);
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

async function handleActivityEvent(event: StravaWebhookEvent): Promise<void> {
  const stravaAccount = await db.stravaAccount.findUnique({
    where: { stravaAthleteId: String(event.owner_id) },
  });
  if (!stravaAccount) return; // not one of our athletes (or not connected)

  // Simplicity over cleverness: re-scan recent activity rather than fetch
  // this one object_id specifically. syncStravaForAthlete already skips
  // activities already stored by stravaId.
  await syncStravaForAthlete(stravaAccount.athleteId);
}
