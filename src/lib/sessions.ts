// Maps logged Hevy workouts back to Comeback Block sessions. The push script
// titles every routine "CB W<week> <Day> · …" (the Thursday home session is
// "CB Thu · …" with no week), and Hevy keeps the routine title when a workout
// is logged, so the title is the link between the plan and what was done.

import { PROGRAM_WEEKS, weekForDate, type DayKey } from "@/lib/program";

export type SessionRef = { week: number; day: DayKey };

const GYM_TITLE = /^CB W(\d+) (Mon|Wed|Fri|Sun)\b/;
const HOME_TITLE = /^CB Thu\b/;

export const sessionKey = (week: number, day: DayKey) => `W${week}-${day}`;

/** Which program session a logged workout belongs to, or null if it is not part of the block. */
export function sessionOf(title: string, startTime: Date): SessionRef | null {
  const gym = GYM_TITLE.exec(title);
  if (gym) {
    const week = Number(gym[1]);
    return week >= 1 && week <= PROGRAM_WEEKS ? { week, day: gym[2] as DayKey } : null;
  }
  if (HOME_TITLE.test(title)) {
    const week = weekForDate(startTime.toISOString().slice(0, 10));
    return week >= 1 && week <= PROGRAM_WEEKS ? { week, day: "Thu" } : null;
  }
  return null;
}

/** Keys (see sessionKey) of every session that has a logged workout. */
export function completedSessions(workouts: { title: string; startTime: Date }[]): Set<string> {
  const done = new Set<string>();
  for (const w of workouts) {
    const ref = sessionOf(w.title, w.startTime);
    if (ref) done.add(sessionKey(ref.week, ref.day));
  }
  return done;
}
