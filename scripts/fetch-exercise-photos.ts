// Matches your top lifts (by working sets logged) against the free, public
// domain exercise photo set at yuhonas/free-exercise-db, downloads the
// start/finish frames for confident matches into public/hevy-photos/, and
// writes a manifest the dashboard reads at request time.
//
// Re-run this whenever your top lifts change (e.g. after `npm run seed`-ing
// more Hevy history, or a new lift breaks into your top 6):
//   npx tsx scripts/fetch-exercise-photos.ts
import "dotenv/config";
import fs from "fs";
import path from "path";
import { db } from "../src/lib/db";
import { topLifts } from "../src/lib/hevyInsights";

const FREE_EXERCISE_DB_INDEX =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json";
const FREE_EXERCISE_DB_IMAGE_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";

const OUTPUT_DIR = path.join(__dirname, "..", "public", "hevy-photos");
const MATCH_THRESHOLD = 0.5;

const STOPWORDS = new Set(["the", "a", "an", "with", "of", "on", "to", "and", "-"]);

function normalizeWords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ") // drop "(Barbell)" style equipment suffixes
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

function overlapScore(a: string[], b: string[]): number {
  const bSet = new Set(b);
  const shared = a.filter((w) => bSet.has(w)).length;
  return shared / Math.max(a.length, 1);
}

type FreeExerciseDbEntry = { id: string; name: string; images: string[] };

async function main() {
  const athlete = await db.athlete.findFirst();
  if (!athlete) {
    console.log("No athlete found — nothing to match.");
    return;
  }

  const [workouts, templates] = await Promise.all([
    db.hevyWorkout.findMany({ where: { athleteId: athlete.id } }),
    db.hevyExerciseTemplate.findMany({ where: { athleteId: athlete.id } }),
  ]);

  const lifts = topLifts(workouts, templates, 6);
  if (lifts.length === 0) {
    console.log("No weight_reps lifts with logged sets yet — nothing to match.");
    return;
  }

  console.log(`Matching photos for: ${lifts.map((l) => l.title).join(", ")}`);

  const indexRes = await fetch(FREE_EXERCISE_DB_INDEX);
  if (!indexRes.ok) throw new Error(`Failed to fetch exercise index: ${indexRes.status}`);
  const entries = (await indexRes.json()) as FreeExerciseDbEntry[];

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const manifest: Record<string, { matched: boolean; sourceName?: string }> = {};

  for (const lift of lifts) {
    const liftWords = normalizeWords(lift.title);
    let best: { entry: FreeExerciseDbEntry; score: number } | null = null;
    for (const entry of entries) {
      if (!entry.images || entry.images.length < 2) continue;
      const score = overlapScore(liftWords, normalizeWords(entry.name));
      if (!best || score > best.score) best = { entry, score };
    }

    if (!best || best.score < MATCH_THRESHOLD) {
      console.log(`  ${lift.title}: no confident match — falling back to text tile`);
      manifest[lift.exerciseTemplateId] = { matched: false };
      continue;
    }

    console.log(`  ${lift.title} -> "${best.entry.name}" (score ${best.score.toFixed(2)})`);
    const destDir = path.join(OUTPUT_DIR, lift.exerciseTemplateId);
    fs.mkdirSync(destDir, { recursive: true });

    for (const frame of [0, 1]) {
      const url = `${FREE_EXERCISE_DB_IMAGE_BASE}/${best.entry.id}/${frame}.jpg`;
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`    failed to download frame ${frame}: ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.join(destDir, `${frame}.jpg`), buf);
    }

    manifest[lift.exerciseTemplateId] = { matched: true, sourceName: best.entry.name };
  }

  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote ${Object.keys(manifest).length} entries to public/hevy-photos/manifest.json`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FAILED:", err);
    process.exit(1);
  });
