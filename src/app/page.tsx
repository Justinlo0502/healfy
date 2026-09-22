import { redirect } from "next/navigation";
import { getSessionAthleteId } from "@/lib/auth";

export default async function Home() {
  const athleteId = await getSessionAthleteId();
  redirect(athleteId ? "/dashboard" : "/login");
}
