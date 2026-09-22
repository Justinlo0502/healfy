"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  connected: boolean;
  lastSyncedAt: string | null;
};

export default function GarminConnectForm({ connected, lastSyncedAt }: Props) {
  if (connected) {
    return <GarminDisconnect lastSyncedAt={lastSyncedAt} />;
  }
  return <GarminConnect />;
}

function GarminDisconnect({ lastSyncedAt }: { lastSyncedAt: string | null }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/garmin/connect", { method: "DELETE" });
      if (!res.ok) {
        setError("Couldn't disconnect Garmin. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't disconnect Garmin. Try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-good">
        Connected{lastSyncedAt ? ` · last synced ${lastSyncedAt}` : ""}
      </p>
      <p className="mt-1 text-sm text-muted">
        Use &ldquo;Sync now&rdquo; in the toolbar above to pull the latest data.
      </p>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-3">
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2 disabled:opacity-60"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect Garmin"}
        </button>
      </div>
    </div>
  );
}

function GarminConnect() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/garmin/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Couldn't connect to Garmin. Check your credentials and try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't connect to Garmin. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="garmin-email" className="text-sm text-muted">
            Garmin email
          </label>
          <input
            id="garmin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="garmin-password" className="text-sm text-muted">
            Garmin password
          </label>
          <input
            id="garmin-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-card hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Connecting…" : "Connect Garmin"}
        </button>
      </div>
    </form>
  );
}
