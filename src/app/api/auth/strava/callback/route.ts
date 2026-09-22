import { NextRequest, NextResponse } from "next/server";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { exchangeCodeForToken, syncStravaForAthlete } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const error = searchParams.get("error");
  const code = searchParams.get("code");

  if (error || !code) {
    return NextResponse.redirect(new URL("/settings?strava_error=1", req.url));
  }

  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const token = await exchangeCodeForToken(code);
    if (!token.athlete?.id) {
      throw new Error("Strava token response missing athlete id");
    }

    await db.stravaAccount.upsert({
      where: { athleteId: athlete.id },
      create: {
        athleteId: athlete.id,
        stravaAthleteId: String(token.athlete.id),
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(token.expires_at * 1000),
      },
      update: {
        stravaAthleteId: String(token.athlete.id),
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(token.expires_at * 1000),
      },
    });

    // Best-effort initial sync so the dashboard has data right away. Don't
    // let a sync failure (e.g. a transient Strava API error) block the
    // connection itself — the user can retry from /api/sync.
    try {
      await syncStravaForAthlete(athlete.id);
    } catch (syncErr) {
      console.error("Initial Strava sync after connect failed:", syncErr);
    }

    return NextResponse.redirect(new URL("/settings?connected=strava", req.url));
  } catch (err) {
    console.error("Strava OAuth callback failed:", err);
    return NextResponse.redirect(new URL("/settings?strava_error=1", req.url));
  }
}
