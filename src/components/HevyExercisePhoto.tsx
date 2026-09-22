import { Dumbbell } from "lucide-react";

type Props = {
  title: string;
  photo: { frame0: string; frame1: string } | null;
  className?: string;
};

/**
 * Two stacked photos (start/finish position) crossfading on a CSS-only loop
 * so the card reads like a rep in motion. Falls back to a clean text tile
 * when no confident photo match was found (see scripts/fetch-exercise-photos.mjs)
 * — a wrong photo is worse than no photo.
 */
export default function HevyExercisePhoto({ title, photo, className = "" }: Props) {
  if (!photo) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-surface-2 text-center text-xs font-semibold text-muted ${className}`}
      >
        <div className="flex flex-col items-center gap-1.5 p-3">
          <Dumbbell className="h-5 w-5" strokeWidth={2} />
          <span className="line-clamp-2">{title}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl bg-surface-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.frame0}
        alt={title}
        className="exercise-photo-frame-a absolute inset-0 h-full w-full object-cover"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.frame1}
        alt=""
        aria-hidden
        className="exercise-photo-frame-b absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
