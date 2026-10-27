import type { Tier } from "@/lib/program";

export const TIER_STYLE: Record<Tier, string> = {
  T1: "bg-foreground text-background",
  T2: "border-[1.5px] border-foreground text-foreground",
  T3: "bg-surface-2 text-foreground",
  ELBOW: "bg-warn-bg text-warn",
  CORE: "bg-good-bg text-good",
  MOBILITY: "border-[1.5px] border-dashed border-accent2 text-accent2",
};

export const TIER_LABEL: Record<Tier, string> = {
  T1: "T1",
  T2: "T2",
  T3: "T3",
  ELBOW: "ELBOW",
  CORE: "CORE",
  MOBILITY: "MOBIL",
};
