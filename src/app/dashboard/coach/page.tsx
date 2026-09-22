import { redirect } from "next/navigation";
import { requireAthlete } from "@/lib/auth";
import ChatPanel from "@/components/ChatPanel";
import { Flame } from "lucide-react";

export default async function CoachPage() {
  const athlete = await requireAthlete();
  if (!athlete) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Flame className="h-6 w-6 text-accent" strokeWidth={2.5} />
        Ask about your training
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Your coach answers from your actual activities, training load, and recovery data — not
        guesses. It&apos;ll flag real overtraining or injury-risk signals plainly, but it&apos;s
        not a substitute for a doctor or physio.
      </p>

      <div className="mt-6">
        <ChatPanel />
      </div>
    </main>
  );
}
