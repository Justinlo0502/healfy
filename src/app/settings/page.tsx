import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import ProfileForm from "./ProfileForm";
import GarminConnectForm from "./GarminConnectForm";
import HevyConnectForm from "./HevyConnectForm";
import { Settings as SettingsIcon, User, Waves, Watch, Dumbbell } from "lucide-react";

export default async function SettingsPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const [stravaAccount, garminAccount, hevyAccount] = await Promise.all([
    db.stravaAccount.findUnique({ where: { athleteId: athlete.id } }),
    db.garminAccount.findUnique({ where: { athleteId: athlete.id } }),
    db.hevyAccount.findUnique({ where: { athleteId: athlete.id } }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <SettingsIcon className="h-6 w-6 text-accent" strokeWidth={2.5} />
        Settings
      </h1>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <User className="h-4 w-4 text-muted" /> Profile
        </h2>
        <p className="mt-1 text-sm text-muted">
          Used to compute accurate HR zones and training load.
        </p>
        <ProfileForm
          initial={{ maxHR: athlete.maxHR, restingHR: athlete.restingHR, lthr: athlete.lthr }}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Waves className="h-4 w-4 text-muted" /> Strava
        </h2>
        {stravaAccount ? (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-good">
              <span className="h-1.5 w-1.5 rounded-full bg-good" />
              Connected
              {stravaAccount.lastSyncedAt
                ? ` · last synced ${formatDateTime(stravaAccount.lastSyncedAt)}`
                : ""}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-muted">
              Connect Strava to pull in your runs and rides automatically.
            </p>
            <a
              href="/api/auth/strava/connect"
              className="mt-3 inline-block rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-card hover:opacity-90"
            >
              Connect to Strava
            </a>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Watch className="h-4 w-4 text-muted" /> Garmin
        </h2>
        <p className="mt-1 text-sm text-muted">
          Optional — adds Body Battery, HRV, sleep score, and real activity data to your
          dashboard via an unofficial Garmin Connect API.
        </p>
        <GarminConnectForm
          connected={Boolean(garminAccount)}
          lastSyncedAt={garminAccount?.lastSyncedAt ? formatDateTime(garminAccount.lastSyncedAt) : null}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Dumbbell className="h-4 w-4 text-muted" /> Hevy
        </h2>
        <p className="mt-1 text-sm text-muted">
          Pulls in your strength training routines, workout history, and exercise library.
          Requires Hevy Pro and a HEVY_API_KEY configured on the server.
        </p>
        <HevyConnectForm
          connected={Boolean(hevyAccount)}
          lastSyncedAt={hevyAccount?.lastSyncedAt ? formatDateTime(hevyAccount.lastSyncedAt) : null}
        />
      </section>
    </main>
  );
}
