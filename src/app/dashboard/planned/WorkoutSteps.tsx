import { formatDistanceKm, formatDuration, formatPace } from "@/lib/format";

// Garmin's workout-detail JSON (what PlannedWorkout.structure holds) nests
// steps inside `workoutSegments[].workoutSteps[]`. A single interval like
// "6 x 400m" comes back as a RepeatGroupDTO step containing its own
// `workoutSteps` (the run + recovery) and a `numberOfIterations`. None of
// this is in the `garmin-connect` package's IWorkoutStep type (it only
// models leaf steps), so it's typed loosely here and rendered defensively —
// unrecognized shapes fall back to a plain label instead of crashing.
type RawStep = {
  type?: string;
  stepType?: { stepTypeKey?: string };
  endCondition?: { conditionTypeKey?: string };
  endConditionValue?: number | null;
  targetType?: { workoutTargetTypeKey?: string };
  targetValueOne?: number | null;
  targetValueTwo?: number | null;
  numberOfIterations?: number;
  workoutSteps?: RawStep[];
};

type RawSegment = { workoutSteps?: RawStep[] };
type RawStructure = { workoutSegments?: RawSegment[] };

const STEP_LABELS: Record<string, string> = {
  warmup: "Warm up",
  cooldown: "Cool down",
  interval: "Interval",
  recovery: "Recovery",
  rest: "Rest",
  other: "Run",
};

function stepLabel(step: RawStep): string {
  const key = step.stepType?.stepTypeKey;
  return (key && STEP_LABELS[key]) || "Run";
}

function stepDuration(step: RawStep): string | null {
  const kind = step.endCondition?.conditionTypeKey;
  const value = step.endConditionValue;
  if (!value) return null;
  if (kind === "time") return formatDuration(value);
  if (kind === "distance") return formatDistanceKm(value);
  return null;
}

// Pace targets are stored as m/s (faster = higher number), opposite of the
// min/km convention used everywhere else in the app, and the two bounds
// come back low-to-high in speed — i.e. slow-to-fast pace — so they're
// swapped when converting to keep the displayed range fast-to-slow.
function stepTarget(step: RawStep): string | null {
  const kind = step.targetType?.workoutTargetTypeKey;
  const low = step.targetValueOne;
  const high = step.targetValueTwo;
  if (!low || !high) return null;
  if (kind === "pace.zone") {
    return `${formatPace(1000 / high)}–${formatPace(1000 / low)}`;
  }
  if (kind === "heart.rate.zone") {
    return `${Math.round(low)}–${Math.round(high)} bpm`;
  }
  return null;
}

function StepRow({ step, indent }: { step: RawStep; indent?: boolean }) {
  const duration = stepDuration(step);
  const target = stepTarget(step);
  return (
    <div className={`flex items-center justify-between gap-3 py-1 text-xs ${indent ? "pl-4" : ""}`}>
      <span className="text-foreground">{stepLabel(step)}</span>
      <span className="flex shrink-0 gap-2 text-muted">
        {duration ? <span>{duration}</span> : null}
        {target ? <span>{target}</span> : null}
      </span>
    </div>
  );
}

function Step({ step }: { step: RawStep }) {
  const isRepeat = step.type === "RepeatGroupDTO" && Array.isArray(step.workoutSteps) && step.numberOfIterations;
  if (isRepeat) {
    return (
      <div className="py-1">
        <p className="text-xs font-medium text-foreground">{step.numberOfIterations}×</p>
        {step.workoutSteps!.map((child, i) => (
          <StepRow key={i} step={child} indent />
        ))}
      </div>
    );
  }
  return <StepRow step={step} />;
}

export function WorkoutSteps({ structure }: { structure: unknown }) {
  const segments = (structure as RawStructure | null)?.workoutSegments;
  const steps = segments?.flatMap((s) => s.workoutSteps ?? []);
  if (!steps || steps.length === 0) return null;

  return (
    <details className="mt-2 border-t border-line pt-2">
      <summary className="cursor-pointer text-xs font-medium text-accent">View splits</summary>
      <div className="mt-1 flex flex-col divide-y divide-line/50">
        {steps.map((step, i) => (
          <Step key={i} step={step} />
        ))}
      </div>
    </details>
  );
}
