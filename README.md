# Healfy

A single-athlete training dashboard and AI coach. Pulls activities from Strava, richer recovery/readiness metrics from Garmin Connect, and turns both into real training-load, HR-zone, and plan-vs-actual insight — plus a chatbot that answers questions by querying your own data.

## Stack

- Next.js 16 (App Router, TypeScript) on Vercel
- Prisma + Postgres (Neon/Supabase), same database for local dev and production
- Strava API (official OAuth) for activities and HR/pace streams
- Garmin Connect via the unofficial `garmin-connect` client, for Body Battery / HRV / training readiness / Runna's structured workouts (optional, opt-in)
- Claude API (`@anthropic-ai/sdk`) for the AI coach, tool-calling into the local database

## Local development

```bash
npm install
cp .env.example .env   # already done in this repo's dev copy — fill in real values as you get them
npx prisma migrate dev
npm run seed            # creates your login only — no data
npm run dev
```

Log in at `http://localhost:3000/login` with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`.

The seed script only creates your login. It never writes fake activities or metrics — the dashboard stays empty until you connect Garmin (Settings → Connect Garmin) and sync.

## Connecting your real accounts

### Strava (required)

1. Go to <https://www.strava.com/settings/api> and create an API application.
   - **Authorization Callback Domain**: `localhost` for local dev, or your real domain once deployed (e.g. `healfy.vercel.app`, no `https://` or path).
2. Copy the **Client ID** and **Client Secret** into `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` in `.env`.
3. In the app, go to **Settings → Connect to Strava** and authorize it. That's it — no manual token handling, it's a normal OAuth redirect.
4. (Production only, optional but recommended) Register a webhook subscription so new activities sync within seconds instead of waiting for the nightly cron — see Strava's [push subscription docs](https://developers.strava.com/docs/webhooks/), pointing at `https://<your-domain>/api/webhooks/strava` with `STRAVA_WEBHOOK_VERIFY_TOKEN` as the verify token.

### Garmin (optional — richer metrics, unofficial API)

Go to **Settings → Connect Garmin** and enter your Garmin email/password. This logs in server-side via the community `garmin-connect` library and stores only the resulting session token, encrypted — never your raw password. This isn't Garmin's official API, so treat it as opt-in; everything else in the app works without it.

**Optional, local dev only:** `garmin-connect` has no typed method for Body Battery or training readiness, so those two fields normally come from an undocumented-endpoint fallback (see comments in `src/lib/garmin.ts`). For more reliable values in local dev, run the `garmin-poc/` sidecar (see `garmin-poc/README.md`) and set `GARMIN_SIDECAR_URL` in `.env` — the sync will use it automatically and fall back to the old behavior if it's not running. This is dev-only; production keeps using `garmin-connect` as-is since the sidecar isn't deployed anywhere.

### AI coach

Get an API key at <https://console.anthropic.com>, add a small amount of prepaid credit, and set `ANTHROPIC_API_KEY` in `.env`. Personal usage through the coach chat should run a few dollars a month at most.

## Deploying

1. Push this repo to GitHub.
2. Create a free Postgres database at [Neon](https://neon.tech) or [Supabase](https://supabase.com) (Vercel's own "Storage" tab can provision a Neon database directly during project import); copy its connection string into `DATABASE_URL`.
3. Import the repo on [Vercel](https://vercel.com) (free tier). Add every variable from `.env.example` as a Vercel environment variable, using your real production values (`APP_URL` and `STRAVA_REDIRECT_URI` should point at your real Vercel URL).
4. Deploy. Then run `npx prisma migrate deploy && npm run seed` once against the production database (Vercel CLI: `vercel env pull` locally, then run those commands against the pulled env).
5. `vercel.json` already schedules the nightly Strava + Garmin sync jobs via Vercel Cron — no extra setup needed there.

## Project layout

- `src/lib/insights.ts` — pure training-science math (HR zones, ACWR, aerobic efficiency, HR drift). No I/O, easy to unit test.
- `src/lib/strava.ts`, `src/lib/garmin.ts` — the two data sources.
- `src/app/api/sync/*` — sync jobs, triggered by cron or a logged-in user.
- `src/app/dashboard/*` — the UI.
- `src/app/api/chat/*` — the AI coach, grounded in tool calls against the real database.
