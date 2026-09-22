import Link from "next/link";
import { Bike, CloudSun, Footprints, Waves, Zap } from "lucide-react";
import type { StreamData } from "@/lib/insights";
import { formatDate, formatDistanceKm, formatDuration, formatPace } from "@/lib/format";
import RouteIcon, { hasRoutePoints } from "@/components/RouteIcon";

const TYPE_ICON: Record<string, typeof Footprints> = {
  Run: Footprints,
  "Trail Run": Footprints,
  "Treadmill Run": Footprints,
  Ride: Bike,
  Walk: Footprints,
  Hike: Footprints,
  Swim: Waves,
};

type ActivityRowData = {
  id: string;
  name: string;
  type: string;
  startTime: Date;
  distanceMeters: number;
  movingTimeSec: number;
  avgPaceSecPerKm: number | null;
  avgHR: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  streamData: unknown;
};

export default function ActivityListItem({ activity }: { activity: ActivityRowData }) {
  const stream = activity.streamData as StreamData | null;
  const Icon = TYPE_ICON[activity.type] ?? Zap;
  const showRoute = stream != null && hasRoutePoints(stream);

  return (
    <Link
      href={`/dashboard/runs/${activity.id}`}
      className="block rounded-2xl border border-line bg-surface p-4 shadow-card transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent/10 text-accent">
          {showRoute && stream ? <RouteIcon streamData={stream} /> : <Icon className="h-4 w-4" strokeWidth={2.5} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-semibold">{activity.name}</p>
            <span className="shrink-0 tabular-nums font-semibold">
              {formatDistanceKm(activity.distanceMeters)}
            </span>
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
            <span>{formatDate(activity.startTime)}</span>
            <span>·</span>
            <span>{activity.type}</span>
            {activity.temperatureC != null ? (
              <>
                <span>·</span>
                <span className="flex items-center gap-0.5">
                  <CloudSun className="h-3 w-3" />
                  {Math.round(activity.temperatureC)}°C
                </span>
              </>
            ) : null}
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-xs tabular-nums text-muted">
            <span>{formatDuration(activity.movingTimeSec)}</span>
            <span>{formatPace(activity.avgPaceSecPerKm)}</span>
            <span>{activity.avgHR ? `${activity.avgHR} bpm` : "—"}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
