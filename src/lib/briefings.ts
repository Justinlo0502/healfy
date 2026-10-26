// Per-session performance briefings for the Comeback Block, written by the
// healfy-update skill after each sync (see .claude/skills/healfy-update).
// Keyed by sessionKey(week, day), e.g. "W3-Mon". The program page shows the
// briefing under the day's check mark.

export type BriefingVerdict = "ahead" | "on-plan" | "mixed" | "behind";

export type Briefing = {
  /** Date the briefing was written (YYYY-MM-DD). */
  date: string;
  verdict: BriefingVerdict;
  /** One or two sentences: how the session went overall. */
  summary: string;
  /** Per-lift detail: sets vs prescription, AMRAPs, estimated 1RM vs expected, notes, swaps. */
  highlights: string[];
};

export const BRIEFINGS: Record<string, Briefing> = {};
