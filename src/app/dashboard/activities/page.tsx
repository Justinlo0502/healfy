import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import { db } from "@/lib/db";
import ActivityListItem from "@/components/ActivityListItem";
import { List } from "lucide-react";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  const { type: typeFilter } = await searchParams;

  const activities = await db.activity.findMany({
    where: { athleteId: athlete.id },
    orderBy: { startTime: "desc" },
  });

  const types = Array.from(new Set(activities.map((a) => a.type))).sort();
  const filtered = typeFilter ? activities.filter((a) => a.type === typeFilter) : activities;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <List className="h-6 w-6 text-accent" strokeWidth={2.5} />
        Activities
      </h1>
      <p className="mt-1 text-sm text-muted">{activities.length} total</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <FilterPill href="/dashboard/activities" active={!typeFilter} label="All" />
        {types.map((type) => (
          <FilterPill
            key={type}
            href={`/dashboard/activities?type=${encodeURIComponent(type)}`}
            active={typeFilter === type}
            label={type}
          />
        ))}
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {filtered.map((activity) => (
          <li key={activity.id}>
            <ActivityListItem activity={activity} />
          </li>
        ))}
      </ul>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted">No activities of this type yet.</p>
      ) : null}
    </main>
  );
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <a
      href={href}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted hover:text-foreground"
      }`}
    >
      {label}
    </a>
  );
}
