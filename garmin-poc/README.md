# garmin-poc

Standalone, local-dev-only. Wraps `python-garminconnect` to serve Body
Battery and training readiness — the two fields the npm `garmin-connect`
package (used by the main app) has no typed methods for.

Not deployed anywhere; Healfy's `src/lib/garmin.ts` calls this over
`localhost` only when `GARMIN_SIDECAR_URL` is set in the app's `.env`, and
falls back to its existing behavior if this isn't running.

## Setup

```
cp .env.example .env   # fill in GARMIN_EMAIL / GARMIN_PASSWORD
```

(Already done if you ran the original proof-of-connection script.)

## Run

```
.venv/Scripts/python.exe -m uvicorn server:app --port 8787
```

Run this alongside `npm run dev` in the main app. Then set in the app's
root `.env`:

```
GARMIN_SIDECAR_URL="http://localhost:8787"
```

## Standalone test (no server)

```
.venv/Scripts/python.exe test_connection.py
```
