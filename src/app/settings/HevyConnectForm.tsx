"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  connected: boolean;
  lastSyncedAt: string | null;
};

export default function HevyConnectForm({ connected, lastSyncedAt }: Props) {
  if (connected) {
    return <HevyConnected lastSyncedAt={lastSyncedAt} />;
  }
  return <HevyConnect />;
}

function HevyConnected({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/hevy/connect", { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't disconnect Hevy. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't disconnect Hevy. Try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/hevy", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Couldn't sync with Hevy. Try again.");
        return;
      }
      if (body?.errors?.length) {
        setError("Sync ran but hit an error pulling your data. Try again in a bit.");
      } else {
        setSyncMessage(
          `Synced ${body?.workoutsSynced ?? 0} workout${body?.workoutsSynced === 1 ? "" : "s"}, ` +
            `${body?.routinesSynced ?? 0} routine${body?.routinesSynced === 1 ? "" : "s"}, ` +
            `${body?.exerciseTemplatesSynced ?? 0} exercise${body?.exerciseTemplatesSynced === 1 ? "" : "s"}.`
        );
      }
      router.refresh();
    } catch {
      setError("Couldn't sync with Hevy. Try again.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-good">
        Connected{lastSyncedAt ? ` · last synced ${lastSyncedAt}` : ""}
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      {syncMessage ? <p className="mt-2 text-sm text-muted">{syncMessage}</p> : null}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSync}
          disabled={syncing || disconnecting}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-card hover:opacity-90 disabled:opacity-60"
        >
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting || syncing}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect Hevy"}
        </button>
      </div>
    </div>
  );
}

function HevyConnect() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await fetch("/api/auth/hevy/connect", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Couldn't connect to Hevy. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't connect to Hevy. Try again.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted">
        Uses the HEVY_API_KEY configured on the server (Hevy app → Settings → API → Generate API
        Key). Requires Hevy Pro.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-card hover:opacity-90 disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect Hevy"}
      </button>
    </div>
  );
}
