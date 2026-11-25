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

/** Grid shared by planned rows and "also in the logged routine" rows: tier | name | planned | done. */
export const LOGGED_ROW_CLASS =
  "grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-line px-5 py-3 last:border-b-0 sm:grid-cols-[56px_minmax(0,1.3fr)_136px_minmax(0,1fr)]";
/** The done cell: under planned on mobile, a ruled column on desktop. */
export const LOGGED_DONE_CELL_CLASS = "col-start-2 mt-1 sm:col-start-4 sm:mt-0 sm:border-l sm:border-line sm:pl-4";

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
    <span className={`whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-xs tabular-nums tracking-tight ${tone}`}>
      {set.lb > 0 ? (
        <>
          {set.lb}
          <span className="text-[0.85em] text-muted">×</span>
          {set.reps}
        </>
      ) : (
        set.reps
      )}
      {amrap ? "+" : ""}
    </span>
  );
}

/** The "done" half of a planned row: logged set chips, a status icon and the e1RM. */
export function DoneCell({ r }: { r: ExerciseResult }) {
  const status = STATUS[r.status];
  const slots = Math.max(r.plannedSets, r.sets.length);
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className={`mt-1 inline-flex shrink-0 items-center ${status.className}`} title={status.label}>
        <status.Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        <span className="sr-only">{status.label}</span>
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1">
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
              <span key={i} className="rounded-md border border-dashed border-line px-1.5 py-0.5 font-mono text-xs text-muted">
                –
              </span>
            );
          })}
          {r.topE1RM != null ? (
            <span className="ml-1 whitespace-nowrap font-mono text-[11px] text-muted">e1RM {r.topE1RM} lb</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** A logged move that has no row in the planned list (dropped from the program since, or renamed). */
function LooseRow({ r }: { r: ExerciseResult }) {
  const tier = (TIERS.has(r.tier) ? r.tier : "T3") as Tier;
  return (
    <li className={LOGGED_ROW_CLASS} data-loose={r.hevyTitle}>
      <span className={`mt-0.5 inline-flex h-fit w-14 justify-center rounded px-1 py-0.5 font-mono text-[11px] font-semibold tracking-wide ${TIER_STYLE[tier]}`}>
        {TIER_LABEL[tier]}
      </span>
      <p className="min-w-0 font-semibold">{r.name}</p>
      <p
        data-cell="planned"
        className="col-start-2 whitespace-nowrap font-mono text-[13px] tabular-nums text-muted sm:col-start-3 sm:self-start sm:pt-0.5 sm:text-right"
      >
        {r.planned}
      </p>
      <div data-cell="done" className={LOGGED_DONE_CELL_CLASS}>
        <DoneCell r={r} />
        {r.notes ? <p className="mt-1 max-w-prose text-[13px] italic text-muted">&ldquo;{r.notes}&rdquo;</p> : null}
      </div>
    </li>
  );
}

export default function SessionReport({
  report,
  briefing,
  loose = [],
}: {
  report: Report;
  briefing?: Briefing;
  /** Results with no row in the planned list above. */
  loose?: ExerciseResult[];
}) {
  const { results } = report;
  const plannedSets = results.reduce((n, r) => n + r.plannedSets, 0);
  const doneSets = results.reduce((n, r) => n + Math.min(r.sets.length, r.plannedSets), 0);
  const onPlan = results.filter((r) => r.status === "hit" || r.status === "exceeded").length;
  const verdict = briefing ? VERDICT_STYLE[briefing.verdict] : null;
  const over = report.minutes != null && report.minutes > SESSION_CAP_MIN;
  const extras = report.added.filter((a) => !report.substitutions.some((s) => s.added === a.name));

  return (
    <section aria-label="Planned versus done" className="border-t-2 border-line">
      {loose.length ? (
        <ul className="border-b border-line">
          <li className="border-b border-line bg-surface-2 px-5 py-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">
            Also in the logged routine
          </li>
          {loose.map((r) => (
            <LooseRow key={r.hevyTitle} r={r} />
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3 text-sm">
        {verdict ? (
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${verdict.className}`}>{verdict.label}</span>
        ) : null}
        <p className="flex flex-wrap gap-x-2 font-mono text-xs tabular-nums text-muted">
          <span className={onPlan < results.length / 2 ? "text-warn" : undefined}>
            <b className="text-foreground">{onPlan}/{results.length}</b> on plan
          </span>
          <span aria-hidden>·</span>
          <span className={doneSets < plannedSets * 0.75 ? "text-warn" : undefined}>
            <b className="text-foreground">{doneSets}/{plannedSets}</b> sets
          </span>
          {report.minutes != null ? (
            <>
              <span aria-hidden>·</span>
              <span className={over ? "text-warn" : undefined}>
                <b className="text-foreground">{report.minutes}</b> / {SESSION_CAP_MIN} min
              </span>
            </>
          ) : null}
        </p>
      </div>

      {briefing ? <p className="max-w-prose px-5 pb-3 text-sm">{briefing.summary}</p> : null}

      {report.substitutions.length || extras.length ? (
        <div className="flex flex-col gap-1.5 border-t border-line px-5 py-2.5 text-sm">
          {report.substitutions.map((s) => {
            const added = report.added.find((a) => a.name === s.added);
            return (
              <p key={s.dropped} className="flex items-start gap-2">
                <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-accent2" strokeWidth={2.5} />
                <span>
                  Swapped <b>{s.dropped}</b> for <b>{s.added}</b>
                  {added ? <span className="ml-1.5 font-mono text-xs text-muted">{setsText(added.sets)}</span> : null}
                </span>
              </p>
            );
          })}
          {extras.map((a) => (
            <p key={a.name} className="flex items-start gap-2">
              <Plus className="mt-0.5 h-4 w-4 shrink-0 text-accent2" strokeWidth={2.5} />
              <span>
                Added <b>{a.name}</b> <span className="font-mono text-xs text-muted">{setsText(a.sets)}</span>
              </span>
            </p>
          ))}
        </div>
      ) : null}

      {briefing ? (
        <details className="border-t border-line px-5 py-2.5">
          <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wide text-muted hover:text-foreground">
            Brief · {briefing.date} · {briefing.highlights.length} {briefing.highlights.length === 1 ? "note" : "notes"}
          </summary>
          <ul className="mt-2 flex max-w-prose list-disc flex-col gap-1 pl-5 text-[13px] text-muted">
            {briefing.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

const setsText = (sets: LoggedSet[]) => sets.map((s) => (s.lb > 0 ? `${s.lb}×${s.reps}` : s.reps)).join(", ");
