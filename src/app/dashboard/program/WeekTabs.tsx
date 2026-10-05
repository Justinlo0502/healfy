"use client";

import { useState, type ReactNode } from "react";

// Week switcher for the program page. Every week is rendered on the server
// and passed in as `panels`; this only toggles which one is visible.
export default function WeekTabs({
  labels,
  panels,
  initial,
  currentWeek,
}: {
  labels: string[];
  panels: ReactNode[];
  initial: number;
  currentWeek: number | null;
}) {
  const [active, setActive] = useState(initial);

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Program week" className="flex flex-wrap items-center gap-1.5">
        {labels.map((label, i) => {
          const selected = i === active;
          return (
            <button
              key={label}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActive(i)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                selected
                  ? "bg-accent2 text-surface"
                  : "border border-line bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {label}
              {currentWeek === i + 1 ? <span className="ml-1.5 text-xs font-medium opacity-80">· now</span> : null}
            </button>
          );
        })}
      </div>
      {panels.map((panel, i) => (
        <div key={labels[i]} role="tabpanel" hidden={i !== active}>
          {panel}
        </div>
      ))}
    </div>
  );
}
