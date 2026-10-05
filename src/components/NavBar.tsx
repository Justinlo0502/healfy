"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Flame,
  LayoutDashboard,
  List,
  LogOut,
  Mountain,
  RefreshCw,
  Scale,
  Settings,
  TrendingUp,
  XCircle,
} from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/activities", label: "Activities", icon: List },
  { href: "/dashboard/trends", label: "Trends", icon: TrendingUp },
  { href: "/dashboard/planned", label: "Planned", icon: ClipboardList },
  { href: "/dashboard/program", label: "Program", icon: CalendarDays },
  { href: "/dashboard/lifts", label: "Lifts", icon: Dumbbell },
  { href: "/dashboard/body", label: "Body", icon: Scale },
  { href: "/dashboard/coach", label: "Coach", icon: Flame },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<"ok" | "error" | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  if (pathname === "/login") return null;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const results = await Promise.allSettled([
        fetch("/api/sync", { method: "POST" }),
        fetch("/api/sync/garmin", { method: "POST" }),
        fetch("/api/sync/hevy", { method: "POST" }),
        fetch("/api/sync/renpho", { method: "POST" }),
      ]);
      const failed = results.some((r) => r.status === "rejected" || !r.value.ok);
      setSyncResult(failed ? "error" : "ok");
      router.refresh();
    } catch {
      setSyncResult("error");
    } finally {
      setSyncing(false);
      clearTimer.current = setTimeout(() => setSyncResult(null), 3000);
    }
  }

  return (
    <header className="relative border-b border-line bg-surface/95 backdrop-blur-sm">
      <div className="gradient-accent absolute inset-x-0 top-0 h-[3px]" />
      {/* Below xl the links don't fit beside the logo and buttons, so they wrap
          to their own full-width, horizontally scrollable row. At xl they share
          one row, which only fits with the link icons dropped. */}
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 xl:max-w-6xl xl:flex-nowrap">
        <div className="contents xl:flex xl:min-w-0 xl:items-center xl:gap-8">
          <span className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold italic tracking-tight text-accent2">
            <Mountain className="h-5 w-5 text-accent" strokeWidth={2.5} />
            Healfy
          </span>
          <ul className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 text-sm [scrollbar-width:none] xl:order-none xl:mx-0 xl:w-auto xl:px-0">
            {LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname?.startsWith(link.href)) ||
                (link.href === "/dashboard" && pathname === "/dashboard");
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition-colors ${
                      active
                        ? "trail-marker bg-accent2/10 text-accent2"
                        : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 xl:hidden" strokeWidth={2.5} />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sync Strava, Garmin, Hevy & Renpho"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground shadow-card transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {syncResult === "ok" ? (
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
            ) : syncResult === "error" ? (
              <XCircle className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} strokeWidth={2.5} />
            )}
            {syncing ? "Syncing…" : syncResult === "ok" ? "Synced" : syncResult === "error" ? "Sync failed" : "Sync now"}
          </button>
          <button
            onClick={handleLogout}
            title="Log out"
            aria-label="Log out"
            className="flex items-center rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </nav>
    </header>
  );
}
