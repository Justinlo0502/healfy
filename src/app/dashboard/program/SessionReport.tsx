import { ArrowRightLeft, CircleCheck, CircleDashed, CircleMinus, Plus, TrendingUp } from "lucide-react";
import type { Briefing } from "@/lib/briefings";
import type { ExerciseResult, LoggedSet, SessionReport as Report } from "@/lib/sessionReport";
import type { Tier } from "@/lib/program";
import { TIER_LABEL, TIER_STYLE } from "./tiers";

// "Planned vs done" for one logged session, shown under the planned workout.
// Every number comes from the Hevy log (src/lib/sessionReport.ts); the brief
// (src/lib/briefings.ts) adds the verdict and the reading of it.

const SESSION_CAP_MIN = 75;

const VERDICT_STYLE: Record<Briefing["verdict"], { label: string; className: string }> = {
  ahead: { label: "Ahead of plan", className: "bg-good-bg text-good" },
  "on-plan": { label: "On plan", className: "bg-surface-2 text-foreground" },
  mixed: { label: "Mixed", className: "bg-warn-bg text-warn" },
  behind: { label: "Behind plan", className: "bg-warn-bg text-warn" },
};

const STATUS: Record<ExerciseResult["status"], { label: string; className: string; Icon: typeof CircleCheck }> = {
  hit: { label: "Hit", className: "text-good", Icon: CircleCheck },
  exceeded: { label: "Beat plan", className: "text-good", Icon: TrendingUp },
  short: { label: "Short", className: "text-warn", Icon: CircleMinus },
  "not-done": { label: "Not logged", className: "text-muted", Icon: CircleDashed },
};

const TIERS = new Set<string>(["T1", "T2", "T3", "ELBOW", "CORE", "MOBILITY"]);

function SetChip({
  set,
  plannedReps,
  plannedLb,
  amrap,
}: {
  set: LoggedSet;
  plannedReps: number;
  plannedLb: number | null;
  amrap: boolean;
}) {
  const short = set.reps < plannedReps || (plannedLb != null && set.lb < plannedLb - 0.5);
  const beat = !short && (set.reps > plannedReps || (plannedLb != null && set.lb > plannedLb + 0.5));
  const tone = short
    ? "border-warn/40 bg-warn-bg text-warn"
    : beat
      ? "border-good/40 bg-good-bg text-good"
      : "border-line bg-surface-2";
  return (
    <span className={`rounded-lg border px-2 py-1 font-mono text-xs tabular-nums ${tone}`}>
      {set.lb > 0 ? `${set.lb} × ${set.reps}` : `${set.reps}`}
      {amrap ? "+" : ""}
    </span>
  );
}

function ExerciseRow({ r }: { r: ExerciseResult }) {
  const status = STATUS[r.status];
  const tier = (TIERS.has(r.tier) ? r.tier : "T3") as Tier;
  const slots = Math.max(r.plannedSets, r.sets.length);
  return (
    <li className="flex flex-col gap-2 border-b border-line px-5 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex items-center gap-2 font-semibold">
          <span
            className={`inline-flex w-12 justify-center rounded px-1 py-0.5 font-mono text-[10px] font-semibold ${TIER_STYLE[tier]}`}
          >
            {TIER_LABEL[tier]}
          </span>
          {r.name}
        </p>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${status.className}`}>
          <status.Icon className="h-4 w-4" strokeWidth={2.5} />
          {status.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: slots }, (_, i) => {
          const set = r.sets[i];
          return set ? (
            <SetChip
              key={i}
              set={set}
              plannedReps={r.plannedReps}
              plannedLb={r.plannedLb}
              amrap={r.amrapReps != null && i === r.sets.length - 1}
            />
          ) : (
            <span key={i} className="rounded-lg border border-dashed border-line px-2 py-1 font-mono text-xs text-muted">
              –
            </span>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-xs text-muted">
        <span>Planned {r.planned}</span>
        {r.topE1RM != null ? <span>e1RM {r.topE1RM} lb</span> : null}
      </p>
      {r.notes ? <p className="max-w-prose text-[13px] italic text-muted">&ldquo;{r.notes}&rdquo;</p> : null}
    </li>
  );
}

function Stat({
  label,
  value,
  sub,
  bar,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  bar: number;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">
        {value}
        {sub ? <span className="ml-1 text-xs font-medium text-muted">{sub}</span> : null}
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${warn ? "bg-warn" : "bg-good"}`}
          style={{ width: `${Math.min(100, Math.round(bar * 100))}%` }}
        />
      </div>
    </div>
  );
}

export default function SessionReport({ report, briefing }: { report: Report; briefing?: Briefing }) {
  const { results } = report;
  const plannedSets = results.reduce((n, r) => n + r.plannedSets, 0);
  const doneSets = results.reduce((n, r) => n + Math.min(r.sets.length, r.plannedSets), 0);
  const onPlan = results.filter((r) => r.status === "hit" || r.status === "exceeded").length;
  const verdict = briefing ? VERDICT_STYLE[briefing.verdict] : null;
  const over = report.minutes != null && report.minutes > SESSION_CAP_MIN;
  const extras = report.added.filter((a) => !report.substitutions.some((s) => s.added === a.name));

  return (
    <section aria-label="Planned versus done" className="border-t-2 border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-1 pt-4">
        <h4 className="text-base font-semibold">Planned vs done</h4>
        {verdict ? (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${verdict.className}`}>
            {verdict.label}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-3">
        <Stat
          label="Exercises on plan"
          value={`${onPlan}/${results.length}`}
          bar={results.length ? onPlan / results.length : 0}
          warn={onPlan < results.length / 2}
        />
        <Stat
          label="Sets done"
          value={`${doneSets}/${plannedSets}`}
          bar={plannedSets ? doneSets / plannedSets : 0}
          warn={doneSets < plannedSets * 0.75}
        />
        {report.minutes != null ? (
          <Stat
            label="Time"
            value={`${report.minutes}`}
            sub={`min · cap ${SESSION_CAP_MIN}`}
            bar={report.minutes / SESSION_CAP_MIN}
            warn={over}
          />
        ) : null}
      </div>

      {briefing ? <p className="max-w-prose px-5 pb-3 text-sm">{briefing.summary}</p> : null}

      <ul className="border-t border-line">
        {results.map((r) => (
          <ExerciseRow key={r.name} r={r} />
        ))}
      </ul>

      {report.substitutions.length || extras.length ? (
        <div className="flex flex-col gap-2 border-t border-line px-5 py-3 text-sm">
          {report.substitutions.map((s) => (
            <p key={s.dropped} className="flex items-start gap-2">
              <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-accent2" strokeWidth={2.5} />
              <span>
                Swapped <b>{s.dropped}</b> for <b>{s.added}</b>
              </span>
            </p>
          ))}
          {extras.map((a) => (
            <p key={a.name} className="flex items-start gap-2">
              <Plus className="mt-0.5 h-4 w-4 shrink-0 text-accent2" strokeWidth={2.5} />
              <span>
                Added <b>{a.name}</b>{" "}
                <span className="font-mono text-xs text-muted">
                  {a.sets.map((s) => (s.lb > 0 ? `${s.lb}×${s.reps}` : s.reps)).join(", ")}
                </span>
              </span>
            </p>
          ))}
        </div>
      ) : null}

      {briefing ? (
        <div className="border-t border-line px-5 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Brief · {briefing.date}</p>
          <ul className="mt-1.5 flex max-w-prose list-disc flex-col gap-1.5 pl-5 text-[13px] text-muted">
            {briefing.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
