"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Dumbbell,
  Flame,
  LayoutDashboard,
  List,
  LogOut,
  RefreshCw,
  Settings,
  TrendingUp,
  XCircle,
} from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/activities", label: "Activities", icon: List },
  { href: "/dashboard/trends", label: "Trends", icon: TrendingUp },
  { href: "/dashboard/planned", label: "Planned", icon: ClipboardList },
  { href: "/dashboard/lifts", label: "Lifts", icon: Dumbbell },
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
    <header className="border-b border-line bg-surface">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-1.5 text-base font-bold tracking-tight">
            <Activity className="h-5 w-5 text-accent" strokeWidth={2.5} />
            Healfy
          </span>
          <ul className="flex items-center gap-1 text-sm">
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
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors ${
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-muted hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.5} />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sync Strava, Garmin & Hevy"
            className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground shadow-card transition-opacity hover:opacity-90 disabled:opacity-60"
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
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" strokeWidth={2.5} />
            Log out
          </button>
        </div>
      </nav>
    </header>
  );
}
