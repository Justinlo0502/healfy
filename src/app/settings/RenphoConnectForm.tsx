"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  connected: boolean;
  lastSyncedAt: string | null;
};

export default function RenphoConnectForm({ connected, lastSyncedAt }: Props) {
  if (connected) {
    return <RenphoConnected lastSyncedAt={lastSyncedAt} />;
  }
  return <RenphoConnect />;
}

function RenphoConnected({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/renpho/connect", { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't disconnect Renpho. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't disconnect Renpho. Try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/sync/renpho", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Couldn't sync with Renpho. Try again.");
        return;
      }
      if (body?.errors?.length) {
        setError("Sync ran but hit an error pulling your data. Try again in a bit.");
      } else {
        const count = body?.measurementsSynced ?? 0;
        setSyncMessage(`Synced ${count} new weigh-in${count === 1 ? "" : "s"}.`);
      }
      router.refresh();
    } catch {
      setError("Couldn't sync with Renpho. Try again.");
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
          {disconnecting ? "Disconnecting…" : "Disconnect Renpho"}
        </button>
      </div>
    </div>
  );
}

function RenphoConnect() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await fetch("/api/auth/renpho/connect", { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Couldn't connect to Renpho. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't connect to Renpho. Try again.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-muted">
        Uses the RENPHO_EMAIL / RENPHO_PASSWORD configured on the server — the same login as
        the Renpho Health app.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="mt-3 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-card hover:opacity-90 disabled:opacity-60"
      >
        {connecting ? "Connecting…" : "Connect Renpho"}
      </button>
    </div>
  );
}
