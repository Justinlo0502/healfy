import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRIEFINGS, type Briefing } from "@/lib/briefings";
import { completedSessions, sessionKey } from "@/lib/sessions";
import { buildSessionReports, type SessionReport as Report } from "@/lib/sessionReport";
import {
  PROGRAM_DAYS,
  PROGRAM_NAME,
  PROGRAM_START,
  PROGRAM_WEEKS,
  ROUTINE_PREFIX,
  cueFor,
  dayDate,
  exercisesFor,
  rampLabel,
  restLabel,
  schemeLabel,
  supersetPosition,
  weekForDate,
  type ProgramDay,
} from "@/lib/program";
import { CalendarDays, CircleCheck, Waves } from "lucide-react";
import SessionReport from "./SessionReport";
import WeekTabs from "./WeekTabs";
import { TIER_LABEL, TIER_STYLE } from "./tiers";

// The current 6-week lifting program, rendered from src/lib/program.ts —
// the same definition scripts/push-program.ts pushes to Hevy.

const WEEK_STRIP: { day: string; text: string; paddle?: boolean; home?: boolean; rest?: boolean }[] = [
  { day: "Mon", text: "Bench volume · Deadlift volume · DB press", paddle: true },
  { day: "Tue", text: "Off", rest: true },
  { day: "Wed", text: "Close-grip bench · Squat · Incline", paddle: true },
  { day: "Thu", text: "Home mobility + elbow", home: true },
  { day: "Fri", text: "Bench heavy · Deadlift heavy · Pull-up volume" },
  { day: "Sat", text: "Off", rest: true },
  { day: "Sun", text: "Weighted pull-up · Rows · Shoulders · Core" },
];

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function DayCard({
  day,
  week,
  today,
  done,
  report,
  briefing,
}: {
  day: ProgramDay;
  week: number;
  today: string;
  done: boolean;
  report?: Report;
  briefing?: Briefing;
}) {
  const date = dayDate(week, day);
  const isToday = date === today;
  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-surface shadow-card ${isToday ? "border-accent" : "border-line"}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-5 py-3.5">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">
            {day.key} · {shortDate(date)}
            {isToday ? <span className="ml-2 font-semibold text-accent">Today</span> : null}
          </p>
          <h3 className="mt-0.5 text-lg font-semibold">
            {done ? (
              <CircleCheck
                className="mr-1.5 inline-block h-5 w-5 align-[-3px] text-good"
                strokeWidth={2.5}
                aria-label="Session done"
              />
            ) : null}
            {day.title}
            {day.paddle ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 align-middle font-sans text-[11px] font-semibold text-warn">
                <Waves className="h-3 w-3" strokeWidth={2.5} /> Paddle tonight
              </span>
            ) : null}
          </h3>
        </div>
        <p className="font-mono text-xs text-muted">≈{day.minutes} min</p>
      </div>

      <p className="border-b border-line px-5 py-2.5 text-sm text-muted">{day.note(week)}</p>

      <ul>
        {exercisesFor(day, week).map((ex, i, list) => {
          const rx = ex.rx(week);
          const pos = ex.superset ? supersetPosition(list, i) : null;
          const ramp = ex.ramp?.(week);
          const rest = restLabel(ex.restSeconds);
          return (
            <li
              key={`${ex.name}-${i}`}
              className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-line px-5 py-3 last:border-b-0 sm:grid-cols-[64px_minmax(0,1fr)_auto]"
            >
              <span
                className={`mt-0.5 inline-flex h-fit w-14 justify-center rounded px-1 py-0.5 font-mono text-[11px] font-semibold tracking-wide ${TIER_STYLE[ex.tier]}`}
              >
                {TIER_LABEL[ex.tier]}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">
                  {ex.name}
                  {pos ? (
                    <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 align-middle font-mono text-[11px] font-semibold text-muted">
                      Superset {pos}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 max-w-prose text-[13px] leading-snug text-muted">{cueFor(ex, week)}</p>
                {ex.primer?.length ? (
                  <p className="mt-1 font-mono text-xs text-muted">
                    Before this: {ex.primer.map((p) => `${p.name} ${p.rx(week).repsLabel}`).join(" · ")}
                  </p>
                ) : null}
                {ramp ? <p className="mt-1 font-mono text-xs text-muted">Ramp: {rampLabel(ramp)}</p> : null}
              </div>
              <div className="col-start-2 font-mono tabular-nums sm:col-start-3 sm:text-right">
                <p className="whitespace-nowrap text-[15px] font-medium">{schemeLabel(rx)}</p>
                {rx.loadLabel ? <p className="whitespace-nowrap text-xs text-muted">{rx.loadLabel}</p> : null}
                {rest ? <p className="whitespace-nowrap text-xs text-muted">rest {rest}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>

      {report ? <SessionReport report={report} briefing={briefing} /> : null}
    </article>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ProgramPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const today = new Date().toISOString().slice(0, 10);
  const weekNow = weekForDate(today);
  const currentWeek = weekNow >= 1 && weekNow <= PROGRAM_WEEKS ? weekNow : null;
  const initialTab = currentWeek ? currentWeek - 1 : weekNow > PROGRAM_WEEKS ? PROGRAM_WEEKS - 1 : 0;

  // A session is done once a workout titled after its routine is logged in Hevy.
  const [logged, routines, templates] = await Promise.all([
    db.hevyWorkout.findMany({
      where: { athleteId: athlete.id, title: { startsWith: `${ROUTINE_PREFIX} ` } },
      select: { title: true, startTime: true, endTime: true, exercises: true },
    }),
    db.hevyRoutine.findMany({
      where: { athleteId: athlete.id, title: { startsWith: `${ROUTINE_PREFIX} ` } },
      select: { title: true, exercises: true },
    }),
    db.hevyExerciseTemplate.findMany({
      where: { athleteId: athlete.id },
      select: { title: true, primaryMuscleGroup: true },
    }),
  ]);
  const done = completedSessions(logged);
  const reports = buildSessionReports({ workouts: logged, routines, templates });

  const weeks = Array.from({ length: PROGRAM_WEEKS }, (_, i) => i + 1);
  const panels = weeks.map((week) => (
    <div key={week} className="flex flex-col gap-4">
      {PROGRAM_DAYS.map((day) => {
        const key = sessionKey(week, day.key);
        return <DayCard key={day.key} day={day} week={week} today={today} done={done.has(key)} report={reports.get(key)} briefing={BRIEFINGS[key]} />;
      })}
    </div>
  ));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Hero */}
      <div className="gradient-accent relative overflow-hidden rounded-3xl p-6 text-accent-foreground shadow-card sm:p-8">
        <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide opacity-80">
          <CalendarDays className="h-4 w-4" strokeWidth={2.5} /> 6-week volume block · Nov 16 – Dec 27, 2026
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{PROGRAM_NAME}</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-90">
          The volume block after the Comeback Block. Bench runs 3× a week, always first: 5 × 8 Monday, close-grip
          Wednesday, 5 × 5+ Friday, in the day order from Zourdos et al. (2016). Deadlift twice (GZCLP&apos;s heavy and
          light pair), squat once, and Friday pull-ups train for the AMRAP test. Weeks 1–5 add sets, then weight; week 6
          is a deload.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs opacity-90">
          <span>{currentWeek
            ? `Week ${currentWeek} of ${PROGRAM_WEEKS}`
            : weekNow === 0
              ? `Starts Mon, ${shortDate(PROGRAM_START)}`
              : "Block complete"}</span>
          <span>4 gym days + 1 home day</span>
          <span>Bench 3× a week</span>
          <span>65–75 min per session</span>
          <span>Week 6 deload</span>
        </div>
      </div>

      {/* Week strip */}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold text-muted">Every week looks like this</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-7">
          {WEEK_STRIP.map((d) => (
            <div
              key={d.day}
              className={`min-w-0 rounded-xl px-3 py-2.5 ${
                d.rest
                  ? "border border-dashed border-line text-muted"
                  : d.home
                    ? "bg-good-bg"
                    : "border border-line bg-surface shadow-card"
              }`}
            >
              <p className="font-mono text-xs font-semibold">{d.day.toUpperCase()}</p>
              <p className="mt-1 text-[13px] leading-snug">{d.text}</p>
              {d.paddle ? <p className="mt-1.5 font-mono text-[11px] text-accent">paddle pm</p> : null}
            </div>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          The heavy deadlift and both pull-up days avoid paddling nights. Monday&apos;s deadlift is the light one, with
          reps in reserve before the boat. Sunday has no bench, so Monday&apos;s bench volume starts fresh.
        </p>
      </section>

      {/* Weeks */}
      <WeekTabs
        labels={weeks.map((w) => `Week ${w}`)}
        panels={panels}
        initial={initialTab}
        currentWeek={currentWeek}
      />

      {/* Rules */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel title="How weights move">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
            <li>
              <b>Volume first.</b> This block grows by adding sets before weight. Monday bench goes 4 × 8 → 5 × 8 at
              150, then the same again at 155. Weeks 1–5 build and week 6 is a deload.
            </li>
            <li>
              <b>Bench, 3 days.</b> Monday 5 × 8 at 150 → 160. Wednesday close-grip 4 × 6 at 140 → 155. Friday
              5 × 5+ at 175 → 190, with the last set AMRAP. An AMRAP of 8+ adds an extra 5 lb.
            </li>
            <li>
              <b>Heavy days (GZCLP T1):</b> Friday deadlift 5 × 3+ and Sunday weighted pull-up 5 × 3+. Every set at
              target: +10 lb on deadlift (+5 from week 3), +5 lb on pull-ups. A missed set repeats the weight.
            </li>
            <li>
              <b>Fixed-rep days:</b> Monday deadlift 3 × 8, Wednesday squat 5 × 5, Monday bench, close-grip. Every set
              at target → +5 lb next week, otherwise repeat.
            </li>
            <li>
              <b>Friday pull-ups:</b> one max set, then sets of 6–7 with 60 s rest until the weekly rep total: 40 / 45 /
              50 / 55 / 60. Week 6 Friday is a single max set (the AMRAP test).
            </li>
            <li>
              <b>Accessories:</b> stay inside the rep range. When every set reaches the top of the range, move up by
              the smallest jump available.
            </li>
          </ul>
        </Panel>

        <Panel title="Starting numbers">
          <p className="text-[13px] text-muted">
            From your Hevy logs at the end of the Comeback Block (Nov 2 – Nov 15). Bench max is your own estimate after
            missing 225 on Nov 13.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted">
                  <th className="border-b border-line py-2 pr-3 font-medium">Lift</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Last block</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Est. max now</th>
                  <th className="border-b border-line py-2 font-medium">Week 1</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {[
                  ["Bench", "185×3×5, 150×8×3", "210–215", "175×5×5+"],
                  ["Weighted pull-up", "+60×3×5", "≈+66", "+65×3×5+"],
                  ["Squat", "215×3+6, 185×8×3", "≈258", "200×5×5"],
                  ["Deadlift", "275×3,2,2, 225×8", "≈285–300", "255×3×5+"],
                  ["Pull-up (BW)", "12, 12, 6", "12–14 reps", "max + 6s to 40"],
                ].map(([lift, recent, est, start]) => (
                  <tr key={lift}>
                    <td className="border-b border-line py-2 pr-3 font-sans">{lift}</td>
                    <td className="border-b border-line py-2 pr-3">{recent}</td>
                    <td className="border-b border-line py-2 pr-3">{est}</td>
                    <td className="border-b border-line py-2">{start}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Elbow">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
            <li>
              <b>Home, Thursday:</b> isometric wrist holds of 45 s per set, plus forearm stretches. The gym wrist curls
              are gone, since they were skipped most weeks.
            </li>
            <li>
              <b>Watch the load:</b> this block raises both pressing (about 20 sets a week) and pulling volume. Close-grip
              bench uses a grip just inside shoulder width, not narrow. Hammer curls stay at 25s.
            </li>
            <li>
              <b>Pain rule:</b> up to 3/10 during an exercise is fine if it&apos;s back to normal by the next morning. If
              it&apos;s worse, drop that exercise one weight step for a week.
            </li>
          </ul>
        </Panel>

        <Panel title="Dragon boat and the lower back">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
            <li>
              <b>Monday deadlift is the light one:</b> 3 × 8 leaving 2 reps in reserve, since you paddle that night. The
              heavy pull is Friday, with no paddling.
            </li>
            <li>
              <b>Back extensor endurance</b> with 45° back extensions on Friday.
            </li>
            <li>
              <b>Trunk on Sunday:</b> decline sit-up with a press and the cable push-pull, both picked by you. Rows are
              chest-supported or single-arm so the lower back rests before Monday.
            </li>
          </ul>
        </Panel>
      </div>

      <details className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <summary className="cursor-pointer font-semibold">Why it&apos;s built this way</summary>
        <div className="mt-3 flex max-w-prose flex-col gap-3 text-sm">
          <p>
            <b>A volume block after a peak.</b> The Comeback Block ended with a bench max test. Candito&apos;s 6-week
            program and most block-periodised plans follow a peak with higher-volume weeks before the next heavy phase.
            5/3/1 Boring But Big gets its volume from extra sets of the main lifts rather than more exercises, and this
            block does the same.
          </p>
          <p>
            <b>Bench 3 days, in the Zourdos order.</b> Volume Monday, lighter middle day Wednesday, heavy Friday, as in
            Zourdos et al. (2016) and the last block.
          </p>
          <p>
            <b>Close-grip instead of paused bench on Wednesday.</b> A pause mostly helps lifters who compete with one.
            Close-grip bench is the usual higher-rep middle-day variation (it is the hypertrophy-day lift in Stronger by
            Science&apos;s DUP template), and it adds triceps and lockout work.
          </p>
          <p>
            <b>Deadlift twice, squat once.</b> GZCLP trains each main lift twice a week, once heavy (5 × 3+) and once
            lighter. Deadlift is furthest below its best (about 285–300 against 346 before the block), so it gets the
            second day. Squat stays once a week, inside your 1–2× priority.
          </p>
          <p>
            <b>Pull-up rep work.</b> No published &ldquo;50 day&rdquo; plan turned up. The Armstrong program and 7 Weeks
            to 50 Pull-Ups both pair a max set with lots of sub-max volume, which is what Friday does. Sunday&apos;s
            weighted pull-ups keep the strength side.
          </p>
          <p>
            <b>No incline on Sunday.</b> It would be pressing the day before Monday&apos;s bench volume. A pec fly trains
            the chest without tiring the triceps or the elbow.
          </p>
        </div>
      </details>

      <Panel title="Sources">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {[
            ["Modified daily undulating periodization in powerlifters (Zourdos et al., 2016)", "https://pubmed.ncbi.nlm.nih.gov/26332783/"],
            ["GZCLP rules (Cody Lefever)", "https://www.boostcamp.app/coaches/cody-lefever/gzcl-program-gzclp"],
            ["GZCLP 4-day layout (SetForSet)", "https://www.setforset.com/blogs/news/gzclp-beginner-linear-progression-strength-program"],
            ["5/3/1 Boring But Big (Jim Wendler)", "https://jimwendler.com/blogs/jimwendler-com/101077382-boring-but-big"],
            ["Candito 6-week program (BarBend)", "https://barbend.com/candito-6-week-powerlifting-program/"],
            ["Daily undulating periodization (Stronger by Science)", "https://www.strongerbyscience.com/daily-undulating-periodization/"],
            ["Armstrong pull-up program (InsideHook)", "https://www.insidehook.com/wellness/armstrong-pull-routine"],
            ["Isometric exercise for lateral elbow tendinopathy", "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9820871/"],
            ["Injuries in competitive dragon boating (Mukherjee et al., 2014)", "https://journals.sagepub.com/doi/10.1177/2325967114554550"],
          ].map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer" className="text-accent2 underline-offset-2 hover:underline">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
