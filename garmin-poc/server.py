"""
Local-dev-only sidecar for Healfy. Wraps python-garminconnect to serve ALL
Garmin data used by the app (daily readiness metrics + planned workouts,
including real scheduled dates), for a richer local-dev experience than the
npm `garmin-connect` package supports.

Not deployed anywhere — Healfy calls this over localhost only when
GARMIN_SIDECAR_URL is set in its .env, and falls back to its existing
garmin-connect-based logic (unchanged) if this isn't running. Production
always uses that npm-based path; this sidecar never runs there.

Usage:
    .venv/Scripts/python.exe -m uvicorn server:app --port 8787
"""
import os
from contextlib import asynccontextmanager
from datetime import date as date_cls
from typing import Any, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from garminconnect import Garmin

load_dotenv()

TOKEN_STORE = os.path.expanduser("~/.garminconnect")
client: Optional[Garmin] = None


def prompt_mfa() -> str:
    return input("MFA code: ")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        raise RuntimeError("Set GARMIN_EMAIL and GARMIN_PASSWORD in garmin-poc/.env")

    client = Garmin(email, password, prompt_mfa=prompt_mfa)
    client.login(TOKEN_STORE)
    print(f"Garmin sidecar logged in. Token cache: {TOKEN_STORE}")
    yield


app = FastAPI(lifespan=lifespan)


# --- Daily readiness metrics -------------------------------------------------

def extract_body_battery(date_str: str) -> Optional[int]:
    try:
        res = client.get_body_battery(date_str, date_str)
        day = res[0] if isinstance(res, list) and res else None
        values = (day or {}).get("bodyBatteryValuesArray")
        # Each entry is [timestamp_ms, level_or_null] — index 1 is the level,
        # never index 0 (a bare `isinstance(v, number)` scan over the pair
        # picks the timestamp first, since it's always numeric and null isn't).
        if isinstance(values, list):
            for entry in reversed(values):
                if isinstance(entry, list) and len(entry) >= 2 and isinstance(entry[1], (int, float)):
                    return round(entry[1])
        charged = (day or {}).get("charged")
        return round(charged) if isinstance(charged, (int, float)) else None
    except Exception:
        return None


def extract_training_readiness(date_str: str) -> Optional[int]:
    try:
        res = client.get_training_readiness(date_str)
        entry = res[0] if isinstance(res, list) and res else None
        score = (entry or {}).get("score")
        return round(score) if isinstance(score, (int, float)) else None
    except Exception:
        return None


def extract_sleep_score(date_str: str) -> Optional[int]:
    try:
        sleep = client.get_sleep_data(date_str) or {}
        dto = sleep.get("dailySleepDTO") or {}
        overall = (dto.get("sleepScores") or {}).get("overall") or {}
        value = overall.get("value")
        return round(value) if isinstance(value, (int, float)) else None
    except Exception:
        return None


def extract_hrv(date_str: str) -> tuple[Optional[str], Optional[int]]:
    try:
        hrv = client.get_hrv_data(date_str)
        summary = (hrv or {}).get("hrvSummary") or {}
        status = summary.get("status")
        last_night_avg = summary.get("lastNightAvg")
        return (
            status if isinstance(status, str) else None,
            round(last_night_avg) if isinstance(last_night_avg, (int, float)) else None,
        )
    except Exception:
        return None, None


def extract_resting_hr(date_str: str) -> Optional[int]:
    try:
        hr = client.get_heart_rates(date_str) or {}
        val = hr.get("restingHeartRate")
        return round(val) if isinstance(val, (int, float)) else None
    except Exception:
        return None


@app.get("/daily-metrics")
def daily_metrics(date: str = Query(..., description="YYYY-MM-DD")):
    if client is None:
        raise HTTPException(status_code=503, detail="Garmin client not ready")

    hrv_status, hrv_ms = extract_hrv(date)
    return {
        "bodyBattery": extract_body_battery(date),
        "trainingReadiness": extract_training_readiness(date),
        "sleepScore": extract_sleep_score(date),
        "hrvStatus": hrv_status,
        "hrvMs": hrv_ms,
        "restingHR": extract_resting_hr(date),
    }


# --- Workouts (with real scheduled dates, unlike garmin-connect) ------------

def month_add(year: int, month: int, delta: int) -> tuple[int, int]:
    idx = (year * 12 + (month - 1)) + delta
    return idx // 12, idx % 12 + 1


def build_schedule_map() -> dict[str, str]:
    """workoutId -> scheduled date (YYYY-MM-DD), scanning prev/current/next
    month so items near a month boundary aren't missed."""
    today = date_cls.today()
    schedule: dict[str, str] = {}
    for delta in (-1, 0, 1):
        year, month = month_add(today.year, today.month, delta)
        try:
            sched = client.get_scheduled_workouts(year, month)
        except Exception:
            continue
        for item in (sched or {}).get("calendarItems", []):
            wid = item.get("workoutId")
            d = item.get("date")
            if wid is not None and isinstance(d, str):
                schedule[str(wid)] = d
    return schedule


@app.get("/workouts")
def workouts(limit: int = 50) -> list[dict[str, Any]]:
    if client is None:
        raise HTTPException(status_code=503, detail="Garmin client not ready")

    try:
        summaries = client.get_workouts(0, limit)
    except Exception:
        return []

    schedule_map = build_schedule_map()
    results: list[dict[str, Any]] = []

    for w in summaries:
        wid = w.get("workoutId")
        if wid is None:
            continue
        garmin_workout_id = str(wid)

        try:
            detail = client.get_workout_by_id(wid)
        except Exception:
            detail = w  # fall back to the summary if the detail fetch fails

        scheduled_date = (
            schedule_map.get(garmin_workout_id)
            or detail.get("updatedDate")
            or detail.get("createdDate")
        )
        if not scheduled_date:
            continue  # no date at all to store; skip rather than guess

        results.append(
            {
                "garminWorkoutId": garmin_workout_id,
                "name": detail.get("workoutName") or "Garmin workout",
                "scheduledDate": scheduled_date,
                "structure": detail,
            }
        )

    return results


# --- Completed activities (pace/HR/streams) ---------------------------------
#
# Garmin was never wired up for this in Healfy's design (only Strava was) —
# this is new capability, not a hardening of an existing path. No fallback:
# if the sidecar is down, Garmin activity sync just does nothing that run.

ACTIVITY_TYPE_LABELS = {
    "running": "Run",
    "trail_running": "Trail Run",
    "treadmill_running": "Treadmill Run",
    "cycling": "Ride",
    "road_biking": "Ride",
    "mountain_biking": "Ride",
    "indoor_cycling": "Ride",
    "walking": "Walk",
    "hiking": "Hike",
    "lap_swimming": "Swim",
    "open_water_swimming": "Swim",
    "strength_training": "Weight Training",
    "stand_up_paddleboarding_v2": "Stand Up Paddleboarding",
}


def friendly_type(type_key: Optional[str]) -> str:
    if not type_key:
        return "Activity"
    return ACTIVITY_TYPE_LABELS.get(type_key, type_key.replace("_", " ").title())


def fetch_weather(activity_id: int) -> tuple[Optional[float], Optional[int]]:
    try:
        weather = client.get_activity_weather(activity_id) or {}
        temp_f = weather.get("temp")
        humidity = weather.get("relativeHumidity")
        temp_c = round((temp_f - 32) * 5 / 9, 1) if isinstance(temp_f, (int, float)) else None
        humidity_pct = round(humidity) if isinstance(humidity, (int, float)) else None
        return temp_c, humidity_pct
    except Exception:
        return None, None


def build_activity_stream(activity_id: int) -> Optional[dict[str, list]]:
    try:
        details = client.get_activity_details(activity_id, maxchart=500)
    except Exception:
        return None

    descriptors = details.get("metricDescriptors") or []
    # Rebuilt every call — metricsIndex is NOT stable across requests/activities.
    key_to_idx = {d.get("key"): d.get("metricsIndex") for d in descriptors}
    duration_idx = key_to_idx.get("sumDuration")
    hr_idx = key_to_idx.get("directHeartRate")
    speed_idx = key_to_idx.get("directSpeed")
    distance_idx = key_to_idx.get("sumDistance")
    elevation_idx = key_to_idx.get("directElevation")
    lat_idx = key_to_idx.get("directLatitude")
    lng_idx = key_to_idx.get("directLongitude")

    if duration_idx is None or hr_idx is None:
        return None

    def value_at(metrics: list, idx) -> float:
        return metrics[idx] if idx is not None and idx < len(metrics) and isinstance(metrics[idx], (int, float)) else 0.0

    def value_at_or_none(metrics: list, idx):
        # Unlike the other fields, 0.0 is a real coordinate (Gulf of Guinea) —
        # a missing GPS fix must stay null, never fall back to 0.
        return metrics[idx] if idx is not None and idx < len(metrics) and isinstance(metrics[idx], (int, float)) else None

    time_arr: list[float] = []
    hr_arr: list[float] = []
    velocity_arr: list[float] = []
    distance_arr: list[float] = []
    elevation_arr: list[float] = []
    lat_arr: list[Optional[float]] = []
    lng_arr: list[Optional[float]] = []

    for row in details.get("activityDetailMetrics") or []:
        metrics = row.get("metrics") or []
        if duration_idx >= len(metrics) or hr_idx >= len(metrics):
            continue
        t = metrics[duration_idx]
        hr = metrics[hr_idx]
        # Raw values are already in real-world units (seconds, bpm, m/s,
        # meters, degrees) — the API's `unit.factor` metadata is misleading
        # here and must NOT be applied; verified empirically against a real
        # account for heartrate/speed/distance/duration/elevation (raw values
        # matched the activity summary's known ranges) and for lat/lng (raw
        # values matched the summary's startLatitude/startLongitude exactly).
        if not isinstance(t, (int, float)) or not isinstance(hr, (int, float)):
            continue
        time_arr.append(t)
        hr_arr.append(hr)
        velocity_arr.append(value_at(metrics, speed_idx))
        distance_arr.append(value_at(metrics, distance_idx))
        elevation_arr.append(value_at(metrics, elevation_idx))
        lat_arr.append(value_at_or_none(metrics, lat_idx))
        lng_arr.append(value_at_or_none(metrics, lng_idx))

    if not time_arr:
        return None

    return {
        "time": time_arr,
        "heartrate": hr_arr,
        "velocity": velocity_arr,
        "distance": distance_arr,
        "elevation": elevation_arr,
        "latitude": lat_arr,
        "longitude": lng_arr,
    }


@app.get("/activities")
def activities(limit: int = 30, known_ids: str = "") -> list[dict[str, Any]]:
    if client is None:
        raise HTTPException(status_code=503, detail="Garmin client not ready")

    known = {s.strip() for s in known_ids.split(",") if s.strip()}

    try:
        summaries = client.get_activities(0, limit)
    except Exception:
        return []

    results: list[dict[str, Any]] = []
    for a in summaries:
        activity_id = a.get("activityId")
        if activity_id is None:
            continue

        # Already synced — skip the expensive details+weather calls entirely.
        if str(activity_id) in known:
            continue

        distance = a.get("distance")
        moving = a.get("movingDuration")
        if not isinstance(distance, (int, float)) or not isinstance(moving, (int, float)):
            continue  # not enough to build a usable Activity row

        temperature_c, humidity_pct = fetch_weather(activity_id)

        results.append(
            {
                "garminId": str(activity_id),
                "name": a.get("activityName") or "Garmin activity",
                "type": friendly_type((a.get("activityType") or {}).get("typeKey")),
                "startTime": a.get("startTimeLocal"),
                "movingTimeSec": round(moving),
                "distanceMeters": distance,
                "elevationGainMeters": a.get("elevationGain"),
                "elevationLossMeters": a.get("elevationLoss"),
                "avgHR": round(a["averageHR"]) if isinstance(a.get("averageHR"), (int, float)) else None,
                "maxHR": round(a["maxHR"]) if isinstance(a.get("maxHR"), (int, float)) else None,
                "temperatureC": temperature_c,
                "humidityPct": humidity_pct,
                "streamData": build_activity_stream(activity_id),
            }
        )

    return results
