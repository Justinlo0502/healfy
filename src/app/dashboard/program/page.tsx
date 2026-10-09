import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import {
  PROGRAM_DAYS,
  PROGRAM_NAME,
  PROGRAM_WEEKS,
  cueFor,
  dayDate,
  rampLabel,
  restLabel,
  schemeLabel,
  weekForDate,
  type ProgramDay,
  type Tier,
} from "@/lib/program";
import { CalendarDays, Waves } from "lucide-react";
import WeekTabs from "./WeekTabs";

// The current 6-week lifting program, rendered from src/lib/program.ts —
// the same definition scripts/push-comeback-block.ts pushes to Hevy.

const TIER_STYLE: Record<Tier, string> = {
  T1: "bg-foreground text-background",
  T2: "border-[1.5px] border-foreground text-foreground",
  T3: "bg-surface-2 text-foreground",
  ELBOW: "bg-warn-bg text-warn",
  CORE: "bg-good-bg text-good",
  MOBILITY: "border-[1.5px] border-dashed border-accent2 text-accent2",
};

const TIER_LABEL: Record<Tier, string> = {
  T1: "T1",
  T2: "T2",
  T3: "T3",
  ELBOW: "ELBOW",
  CORE: "CORE",
  MOBILITY: "MOBIL",
};

const WEEK_STRIP: { day: string; text: string; paddle?: boolean; home?: boolean; rest?: boolean }[] = [
  { day: "Mon", text: "Bench volume · Squat heavy · DB press", paddle: true },
  { day: "Tue", text: "Off", rest: true },
  { day: "Wed", text: "Paused bench · Squat volume", paddle: true },
  { day: "Thu", text: "Home mobility + elbow", home: true },
  { day: "Fri", text: "Bench heavy · Deadlift · Pull-up" },
  { day: "Sat", text: "Off", rest: true },
  { day: "Sun", text: "Pull-up heavy · Row" },
];

function shortDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function DayCard({ day, week, today }: { day: ProgramDay; week: number; today: string }) {
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

      <p className="border-b border-line px-5 py-2.5 text-sm text-muted">{day.note}</p>

      <ul>
        {day.exercises.map((ex, i) => {
          const rx = ex.rx(week);
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
                <p className="font-semibold">{ex.name}</p>
                <p className="mt-0.5 max-w-prose text-[13px] leading-snug text-muted">{cueFor(ex, week)}</p>
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

  const weeks = Array.from({ length: PROGRAM_WEEKS }, (_, i) => i + 1);
  const panels = weeks.map((week) => (
    <div key={week} className="flex flex-col gap-4">
      {PROGRAM_DAYS.map((day) => (
        <DayCard key={day.key} day={day} week={week} today={today} />
      ))}
    </div>
  ));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      {/* Hero */}
      <div className="gradient-accent relative overflow-hidden rounded-3xl p-6 text-accent-foreground shadow-card sm:p-8">
        <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide opacity-80">
          <CalendarDays className="h-4 w-4" strokeWidth={2.5} /> 6-week block · Oct 5 – Nov 15, 2026
        </p>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{PROGRAM_NAME}</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-90">
          Bench and weighted pull-up first, squat and conventional deadlift second. Bench runs 3× a week, always first:
          volume Monday, paused Wednesday, heavy Friday, following the day order from Zourdos et al. (2016). Pull-up,
          squat and deadlift use GZCLP&apos;s tiers. Elbow loading and dragon boat trunk work are built in.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs opacity-90">
          <span>{currentWeek ? `Week ${currentWeek} of ${PROGRAM_WEEKS}` : weekNow === 0 ? "Starts Mon, Oct 5" : "Block complete"}</span>
          <span>4 gym days + 1 home day</span>
          <span>Bench 3× a week</span>
          <span>60–65 min per session</span>
          <span>No supersets on main lifts</span>
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
          Pull-ups and deadlifts never land on a paddling day, so your lats, grip, elbow and lower back reach the boat
          fresh. Bench comes first on Mon, Wed and Fri. Sunday has no bench and no hinging, because Monday brings bench,
          squats and paddling.
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
              <b>Bench, 3 days.</b> Monday is 8s at 135 → 155, with sets dropping from 4 to 3 as the weight climbs.
              Wednesday is paused bench at 130 → 150, going from 4 × 5 to 3 × 4. Friday is 5 × 3+ at 150 → 170. Week 6
              tapers into a max test on Friday.
            </li>
            <li>
              <b>Bench auto-adjust:</b> if Friday&apos;s AMRAP set reaches 6+ reps, add an extra 5 lb to every bench
              number from next week.
            </li>
            <li>
              <b>Squat, deadlift, pull-up (GZCLP).</b> Heavy days are 5 × 3+ with the last set AMRAP, stopping one
              clean rep short. +5 lb a week on pull-ups, +10 lb on squat and deadlift. Missed reps: repeat the weight
              as 6 × 2, then 10 × 1. Volume days are 3 × 10 at about RPE 8. Missed reps: same weight as 3 × 8, then
              3 × 6.
            </li>
            <li>
              <b>Accessories:</b> stay inside the rep range. When every set reaches the top of the range, move up by
              the smallest jump available.
            </li>
            <li>The exercises stay the same for all six weeks, and only the loads change.</li>
          </ul>
        </Panel>

        <Panel title="Starting numbers">
          <p className="text-[13px] text-muted">
            From your Hevy logs since Sep 18, after the August break. Heavy sets start at 75–80% of your current
            estimated max.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-mono text-xs uppercase tracking-wide text-muted">
                  <th className="border-b border-line py-2 pr-3 font-medium">Lift</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Recent best</th>
                  <th className="border-b border-line py-2 pr-3 font-medium">Est. max now</th>
                  <th className="border-b border-line py-2 font-medium">Spring peak</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {[
                  ["Bench", "135×10", "≈185", "225×1"],
                  ["Weighted pull-up", "+25×8", "≈+75", "+70×4"],
                  ["Squat", "185×6 (Jul)", "≈215", "245×4"],
                  ["Deadlift (conv.)", "205×5", "≈245", "315×3"],
                ].map(([lift, recent, est, peak]) => (
                  <tr key={lift}>
                    <td className="border-b border-line py-2 pr-3 font-sans">{lift}</td>
                    <td className="border-b border-line py-2 pr-3">{recent}</td>
                    <td className="border-b border-line py-2 pr-3">{est}</td>
                    <td className="border-b border-line py-2">{peak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[13px] text-muted">
            Pull-up loads assume a bodyweight of about 165 lb (last weigh-in Apr 24).
          </p>
        </Panel>

        <Panel title="Elbow program">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
            <li>
              <b>Gym, 3× per week:</b> reverse wrist curl (Mon), forearm rotation (Wed), wrist curl (Fri). All 3 × 15
              with a slow 3 s lowering phase.
            </li>
            <li>
              <b>Home, Thursday:</b> isometric wrist holds of 45 s per set, plus forearm stretches.
            </li>
            <li>
              <b>Arm work that&apos;s easy on the elbow:</b> rope pushdowns and incline DB curls. No skull crushers or
              heavy hammer curls, since both have flared it before.
            </li>
            <li>
              <b>Pain rule:</b> up to 3/10 during an exercise is fine if it&apos;s back to normal by the next morning. If
              it&apos;s worse, drop that exercise one weight step for a week.
            </li>
          </ul>
        </Panel>

        <Panel title="Dragon boat trunk">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
            <li>
              <b>Bird dog and dead bug in the warm-up</b> on Thursday, Friday and Sunday: trunk control with low spinal
              load. Gym warm-ups are 1 set of shoulder and hip mobility chosen for that day&apos;s lifts.
            </li>
            <li>
              <b>Back extensor endurance</b> with 45° back extensions on Friday. Low extensor endurance is linked to
              back pain in rowing-type sports.
            </li>
            <li>
              <b>Rotation control</b> on Sunday: Pallof press, cable woodchop and suitcase carry.
            </li>
            <li>No loaded spinal flexion such as sit-ups or Russian twists. The boat already gives you plenty.</li>
          </ul>
        </Panel>
      </div>

      <details className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <summary className="cursor-pointer font-semibold">Why it&apos;s built this way</summary>
        <div className="mt-3 flex max-w-prose flex-col gap-3 text-sm">
          <p>
            <b>Bench gets 3 days, always first.</b> In Zourdos et al. (2016), powerlifters benched 3× a week for 6
            weeks. Running the days as volume → lighter middle day → heavy gave clearly bigger bench gains than putting
            the heavy day in the middle, so this block uses that order on Mon/Wed/Fri.
          </p>
          <p>
            <b>Paused bench on Wednesday.</b> It&apos;s the same movement as your bench, removes the bounce, builds
            strength off the chest, and needs less weight, which is easier on the elbow. Close-grip can swap in if your
            elbow handles it well.
          </p>
          <p>
            <b>Seated DB shoulder press on Monday.</b> All pressing happens Mon/Wed/Fri, so your shoulders rest on Sun,
            Tue and Thu, and nothing tires them the day before a bench session.
          </p>
          <p>
            <b>Rep ranges.</b> 1RM strength grows more with heavy loads, while muscle growth is similar across a wide
            rep range (Schoenfeld 2017). Strength work is 3–5 reps. Muscle building is 8s on Monday and 6–10 on incline
            and DB press. High reps remain only on small, elbow-sensitive exercises.
          </p>
          <p>
            <b>Pull-up, squat, deadlift</b> use GZCLP&apos;s tiers with fixed weekly increases. Deadlift stays once a
            week, on Friday, far from your paddling nights.
          </p>
        </div>
      </details>

      <Panel title="Sources">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          {[
            ["Modified daily undulating periodization in powerlifters (Zourdos et al., 2016)", "https://pubmed.ncbi.nlm.nih.gov/26332783/"],
            ["Low vs. high load: strength and hypertrophy meta-analysis (Schoenfeld et al., 2017)", "https://journals.lww.com/nsca-jscr/fulltext/2017/12000/strength_and_hypertrophy_adaptations_between_low_.31.aspx"],
            ["GZCLP rules (Cody Lefever)", "https://www.boostcamp.app/coaches/cody-lefever/gzcl-program-gzclp"],
            ["Weekly training frequency and strength gain, meta-analysis", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6081873/"],
            ["Isometric exercise for lateral elbow tendinopathy", "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9820871/"],
            ["Eccentric strengthening for lateral elbow tendinopathy, meta-analysis", "https://www.jhandtherapy.org/article/S0894-1130(20)30027-2/abstract"],
            ["Injuries in competitive dragon boating (Mukherjee et al., 2014)", "https://journals.sagepub.com/doi/10.1177/2325967114554550"],
            ["McGill Big 3 for core stability", "https://squatuniversity.com/2018/06/21/the-mcgill-big-3-for-core-stability/"],
            ["Stretching type and duration effects on range of motion (Thomas et al., 2018)", "https://pubmed.ncbi.nlm.nih.gov/29506306/"],
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
