import { NextRequest, NextResponse } from "next/server";
import { requireAthlete } from "@/lib/auth";
import { getAuthorizeUrl } from "@/lib/strava";

export async function GET(req: NextRequest) {
  const athlete = await requireAthlete();
  if (!athlete) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.redirect(getAuthorizeUrl());
}
