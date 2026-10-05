import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
import { pushNewRoutine, type RoutineWritePayload } from "../../src/lib/hevy.ts";
const a = await db.athlete.findFirst();
const folder = await db.hevyRoutineFolder.findFirstOrThrow({ where: { athleteId: a!.id, title: "Promptaneous" } });
const lb = (x: number) => Math.round(x * 0.45359237 * 1000) / 1000;
const W = (reps: number, n = 1) => Array.from({ length: n }, () => ({ type: "warmup", reps }));
const Ws = (sec: number, n = 1) => Array.from({ length: n }, () => ({ type: "warmup", duration_seconds: sec }));
const N = (n: number, reps: number, l: number | null = null) => Array.from({ length: n }, () => ({ type: "normal", reps, weight_kg: l == null ? null : lb(l) }));
const payload: RoutineWritePayload = {
  title: "W0 Fri · Pull + posterior chain (ankle-friendly)",
  folder_id: Number(folder.hevyFolderId),
  notes: "Intro week before W1. Sore inner ankle: no rower, lunges, squats, calf raises or jumping. Everything is hanging, seated, lying or kneeling. Main lifts at RPE 7, everything a step lighter than W1. Sunday is the long run, so leave the gym feeling fresher than you came in. If anything pokes the ankle, skip it.",
  exercises: [
    { exercise_template_id: "7FD2EC3E", rest_seconds: 0, notes: "Warm-up: 5 min easy. Replaces the rower. Skip it if pedalling bothers the ankle.", sets: Ws(300) },
    { exercise_template_id: "05017145-b9ae-4590-b694-c8eb2829f5cb", rest_seconds: 0, notes: "Warm-up: 8 slow reps.", sets: W(8) },
    { exercise_template_id: "57d77865-82cd-40d5-a273-fe1a73973dee", rest_seconds: 0, notes: "Warm-up: 6 / side. T-spine rotation.", sets: W(6) },
    { exercise_template_id: "3bfb0fb7-bf8e-47e9-959a-bd452ec34d69", rest_seconds: 0, notes: "Warm-up: 5 transitions / side. Hips.", sets: W(5) },
    { exercise_template_id: "B9380898", rest_seconds: 0, notes: "Warm-up: 2 × 20 s. Decompress, grip, shoulder position. Use a box to get down, don't drop onto the ankle.", sets: Ws(20, 2) },
    { exercise_template_id: "E8D86EE8", rest_seconds: 0, notes: "Warm-up: 15. Shoulder blades.", sets: W(15) },
    { exercise_template_id: "BD0AD077", rest_seconds: 0, notes: "Warm-up: 6 / side, 3 s hold. Low-back stabilisers.", sets: W(6) },
    { exercise_template_id: "CDA23948", rest_seconds: 0, notes: "Warm-up: 12. Prime the glutes for hip thrusts.", sets: W(12) },
    { exercise_template_id: "729237D1", superset_id: 0, rest_seconds: 120, notes: "A1 · 3×6 @ +25 · RPE 7. Ramp: BW×5, +15×3. Wed you did +25 for 8, 8, 5, so stop each set with 2 in the tank. Overhand, dead hang to chin over bar. Step down onto a box.", sets: [{ type: "warmup", reps: 5, weight_kg: 0 }, { type: "warmup", reps: 3, weight_kg: lb(15) }, ...N(3, 6, 25)] },
    { exercise_template_id: "35B51B87", superset_id: 0, rest_seconds: 90, notes: "A2 · 3×8 @ 105 · RPE 6–7. Hands just inside shoulder width, elbows tucked. Calibrates W1's 115.", sets: N(3, 8, 105) },
    { exercise_template_id: "D57C2EC7", superset_id: 1, rest_seconds: 90, notes: "B1 · 3×10 · RPE 7. Stands in for RDLs this week. Start with 95 and build. Feet flat, drive through the heels, 1 s squeeze at the top. If the ankle complains, swap to glute bridges.", sets: N(3, 10, 95) },
    { exercise_template_id: "CC55119B", superset_id: 1, rest_seconds: 60, notes: "B2 · 3×10 / side @ light · 3 s hold · RPE 7. Tall-kneeling, not half-kneeling, so the ankle stays unloaded. Resist the twist.", sets: N(3, 10) },
    { exercise_template_id: "c933bd5b-ae22-4195-8f11-36eff9a2fd3c", superset_id: 2, rest_seconds: 0, notes: "C1 · 3×10 @ 100 · RPE 7. Same as Monday's 100×10s. Chest on the pad, squeeze shoulder blades.", sets: N(3, 10, 100) },
    { exercise_template_id: "878CD1D0", superset_id: 2, rest_seconds: 75, notes: "C2 · 3×8 @ 35s · RPE 7. Seated, back supported. Sep 23 was 40×6, so W1 goes up to 40×8.", sets: N(3, 8, 35) },
    { exercise_template_id: "11A123F3", superset_id: 3, rest_seconds: 0, notes: "D1 · 2×12 · RPE 7. Pick a weight you could do ~3 more reps with. Pad above the heel. Stop if it presses on the sore spot.", sets: N(2, 12) },
    { exercise_template_id: "82f27ee8-27f6-401c-b91e-0ddfd32e9b09", superset_id: 3, rest_seconds: 60, notes: "D2 · 2×10 @ 25 · RPE 7–8. Arms long, lead with the elbows, 1 s squeeze.", sets: N(2, 10, 25) },
    { exercise_template_id: "37FCC2BB", rest_seconds: 60, notes: "E · 2×8 @ 25s · RPE 8. Seated. No swinging, controlled lowering.", sets: N(2, 8, 25) },
  ],
};
const res = await pushNewRoutine(a!.id, payload, folder.id);
console.log("CREATED", JSON.stringify(res));
const r: any = await db.hevyRoutine.findUnique({ where: { hevyRoutineId: res.hevyRoutineId } });
for (const e of r.exercises) console.log(" ", e.title, "| ss", e.superset_id, "|", e.sets.map((s: any) => `${s.type[0]}:${s.weight_kg != null ? Math.round(s.weight_kg / 0.45359237) + "lb" : "-"}x${s.reps ?? s.duration_seconds + "s"}`).join(" "));
await db.$disconnect();
