"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initial: { maxHR: number | null; restingHR: number | null; lthr: number | null };
};

export default function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [maxHR, setMaxHR] = useState(initial.maxHR?.toString() ?? "");
  const [restingHR, setRestingHR] = useState(initial.restingHR?.toString() ?? "");
  const [lthr, setLthr] = useState(initial.lthr?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toValue(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/athlete", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxHR: toValue(maxHR),
          restingHR: toValue(restingHR),
          lthr: toValue(lthr),
        }),
      });
      if (!res.ok) {
        setMessage("Couldn't save changes. Try again.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    } catch {
      setMessage("Couldn't save changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Max HR" value={maxHR} onChange={setMaxHR} />
        <Field label="Resting HR" value={restingHR} onChange={setRestingHR} />
        <Field label="LTHR" value={lthr} onChange={setLthr} />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-card hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {message ? <span className="text-sm text-muted">{message}</span> : null}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm text-muted">{label}</label>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums rounded-xl border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        placeholder="—"
      />
    </div>
  );
}
