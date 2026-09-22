// Deterministic, no-AI-call translation of an activity's precomputed
// metrics into plain-English sentences. Zero external dependency (unlike
// the per-activity chatbot, which needs ANTHROPIC_API_KEY) — always
// available immediately after sync.

import {
  gradeAdjustedPaceSecPerKm,
  timeInHrZones,
  zoneForHr,
  type StreamData,
} from "@/lib/insights";
import { formatPace } from "@/lib/format";

type NarrativeActivity = {
  type: string;
  distanceMeters: number;
  movingTimeSec: number;
  avgPaceSecPerKm: number | null;
  avgHR: number | null;
  trainingLoad: number | null;
  aerobicEfficiency: number | null;
  hrDriftPct: number | null;
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  streamData: StreamData | null;
};

type NarrativeAthlete = {
  lthr: number | null;
};

export function explainActivity(activity: NarrativeActivity, athlete: NarrativeAthlete): string[] {
  const sentences: string[] = [];
  const lthr = athlete.lthr ?? 160;

  // Pace vs. grade-adjusted pace
  if (activity.avgPaceSecPerKm != null && activity.streamData) {
    const gap = gradeAdjustedPaceSecPerKm(activity.streamData);
    if (gap != null) {
      const diffPct = ((activity.avgPaceSecPerKm - gap) / activity.avgPaceSecPerKm) * 100;
      if (diffPct > 3) {
        sentences.push(
          `Your average pace was ${formatPace(activity.avgPaceSecPerKm)}, but adjusted for elevation your effort was closer to ${formatPace(gap)} — hillier than it looks on paper.`
        );
      } else if (diffPct < -3) {
        sentences.push(
          `Your average pace was ${formatPace(activity.avgPaceSecPerKm)}, but a net-downhill route means your effort was closer to ${formatPace(gap)} on flat ground — don't read this pace as pure fitness.`
        );
      } else {
        sentences.push(
          `Terrain was close to flat overall, so your ${formatPace(activity.avgPaceSecPerKm)} pace is a fair read on effort.`
        );
      }
    }
  }

  // Effort zone
  if (activity.avgHR != null && activity.streamData?.heartrate) {
    const zones = timeInHrZones(activity.streamData, lthr);
    const dominant = (Object.entries(zones) as unknown as [string, number][]).sort((a, b) => b[1] - a[1])[0];
    const zone = zoneForHr(activity.avgHR, lthr);
    const zoneLabels: Record<number, string> = {
      1: "recovery",
      2: "aerobic/easy",
      3: "tempo",
      4: "threshold",
      5: "anaerobic/hard",
    };
    if (dominant) {
      sentences.push(
        `Most of this session was spent in zone ${dominant[0]} — ${zoneLabels[Number(dominant[0])]} effort — with an average heart rate of ${activity.avgHR} bpm, putting the overall session in zone ${zone}.`
      );
    }
  }

  // HR drift / aerobic decoupling
  if (activity.hrDriftPct != null) {
    if (activity.hrDriftPct < 5) {
      sentences.push(
        `Heart rate stayed well-controlled relative to pace across the session (${activity.hrDriftPct.toFixed(1)}% decoupling) — no signs of fatigue creeping in.`
      );
    } else {
      sentences.push(
        `Heart rate climbed ${activity.hrDriftPct.toFixed(1)}% relative to pace as the session went on — a sign of fatigue, heat, or dehydration rather than a pace that was too hard from the start.`
      );
    }
  }

  // Weather context
  if (activity.temperatureC != null) {
    const hot = activity.temperatureC >= 24;
    const humid = activity.humidityPct != null && activity.humidityPct >= 60;
    if (hot || humid) {
      const parts = [`${Math.round(activity.temperatureC)}°C`];
      if (activity.humidityPct != null) parts.push(`${activity.humidityPct}% humidity`);
      sentences.push(
        `Conditions were ${parts.join(" and ")} — some of any elevated heart rate today is heat load, not a fitness change.`
      );
    }
  }

  // Elevation
  if (activity.elevationGainMeters != null && activity.elevationGainMeters > 0) {
    const loss =
      activity.elevationLossMeters != null ? ` and ${Math.round(activity.elevationLossMeters)}m of descent` : "";
    sentences.push(`This route included ${Math.round(activity.elevationGainMeters)}m of climbing${loss}.`);
  }

  // Training load
  if (activity.trainingLoad != null) {
    sentences.push(
      `This session added a training load of ${Math.round(activity.trainingLoad)} — a duration- and intensity-weighted estimate of how much recovery it demands; check the dashboard's acute:chronic ratio for how it fits your recent week.`
    );
  }

  // Aerobic efficiency
  if (activity.aerobicEfficiency != null && activity.aerobicEfficiency > 0) {
    sentences.push(
      `Aerobic efficiency was ${activity.aerobicEfficiency.toFixed(2)} meters per heartbeat-minute — tracked over weeks on easy runs, a rising trend here is the cleanest signal your aerobic engine is improving.`
    );
  }

  return sentences;
}
