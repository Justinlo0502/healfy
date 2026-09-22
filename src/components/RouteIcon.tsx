import type { StreamData } from "@/lib/insights";

const SIZE = 40;
const PAD = 5;

export function hasRoutePoints(streamData: StreamData): boolean {
  return buildPoints(streamData) != null;
}

/** Small decorative route-shape thumbnail from GPS points — not a real map,
 * just a normalized outline so a run is visually recognizable at a glance. */
export default function RouteIcon({ streamData }: { streamData: StreamData }) {
  const points = buildPoints(streamData);
  if (!points) return null;

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function buildPoints(streamData: StreamData): string | null {
  const lat = streamData.latitude;
  const lng = streamData.longitude;
  if (!lat || !lng) return null;

  const pairs: [number, number][] = [];
  for (let i = 0; i < lat.length; i++) {
    const la = lat[i];
    const lo = lng[i];
    if (la != null && lo != null && (la !== 0 || lo !== 0)) pairs.push([la, lo]);
  }
  if (pairs.length < 2) return null;

  const avgLat = pairs.reduce((sum, [la]) => sum + la, 0) / pairs.length;
  const lngScale = Math.cos((avgLat * Math.PI) / 180);

  const xs = pairs.map(([, lo]) => lo * lngScale);
  const ys = pairs.map(([la]) => la);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const range = Math.max(maxX - minX, maxY - minY) || 1;
  const drawable = SIZE - PAD * 2;

  return pairs
    .map((_, i) => {
      const nx = ((xs[i] - minX) / range) * drawable + PAD;
      // SVG y grows downward; latitude grows northward — flip.
      const ny = SIZE - (((ys[i] - minY) / range) * drawable + PAD);
      return `${nx.toFixed(1)},${ny.toFixed(1)}`;
    })
    .join(" ");
}
