"""
Standalone proof-of-connection for python-garminconnect.
Not wired into the Healfy app yet — just verifying login + a basic
data pull work before deciding how (or whether) to integrate.

Usage:
    1. cp .env.example .env   (fill in GARMIN_EMAIL / GARMIN_PASSWORD)
    2. .venv/Scripts/python.exe test_connection.py
"""
import os
from datetime import date

from dotenv import load_dotenv
from garminconnect import Garmin

load_dotenv()

TOKEN_STORE = os.path.expanduser("~/.garminconnect")


def prompt_mfa() -> str:
    return input("MFA code: ")


def main() -> None:
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")

    if not email or not password:
        raise SystemExit("Set GARMIN_EMAIL and GARMIN_PASSWORD in garmin-poc/.env")

    client = Garmin(email, password, prompt_mfa=prompt_mfa)
    client.login(TOKEN_STORE)
    print(f"Logged in. Token cache: {TOKEN_STORE}")

    today = date.today().isoformat()

    stats = client.get_stats(today)
    print("\n--- Today's stats ---")
    print(f"Steps: {stats.get('totalSteps')}")
    print(f"Resting HR: {stats.get('restingHeartRate')}")
    print(f"Body battery (highest/lowest): {stats.get('bodyBatteryHighestValue')}/{stats.get('bodyBatteryLowestValue')}")

    activities = client.get_activities(0, 5)
    print(f"\n--- Last {len(activities)} activities ---")
    for act in activities:
        print(f"{act.get('startTimeLocal')}  {act.get('activityName')}  ({act.get('activityType', {}).get('typeKey')})")


if __name__ == "__main__":
    main()
