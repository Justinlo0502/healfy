import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
import { pushNewRoutine, type RoutineWritePayload } from "../../src/lib/hevy.ts";
const a = await db.athlete.findFirst();
const lb = (x: number) => Math.round(x * 0.45359237 * 1000) / 1000;
const W = (reps: number, n = 1) => Array.from({ length: n }, () => ({ type: "warmup", reps }));
const N = (n: number, reps: number, kg: number | null = null) => Array.from({ length: n }, () => ({ type: "normal", reps, weight_kg: kg }));
const payload: RoutineWritePayload = {
  title: "Fri Oct 2 · Ankle-friendly pull + posterior chain",
  folder_id: null,
  notes: "One-off before Week 1. Sore inside ankle: nothing standing on one leg, no squats/lunges/calf raises/jumping, no rower. Everything is seated, lying or kneeling. Keep it all at RPE 7. Monday is heavy, so leave the gym feeling fresher than you came in. If anything pokes the ankle, skip it.",
  exercises: [
    { exercise_template_id: "05017145-b9ae-4590-b694-c8eb2829f5cb", rest_seconds: 0, notes: "Warm-up: 8 slow reps. (Skip the rower today.)", sets: W(8) },
    { exercise_template_id: "57d77865-82cd-40d5-a273-fe1a73973dee", rest_seconds: 0, notes: "Warm-up: 6 / side. T-spine rotation.", sets: W(6) },
    { exercise_template_id: "3bfb0fb7-bf8e-47e9-959a-bd452ec34d69", rest_seconds: 0, notes: "Warm-up: 5 transitions / side. Hips.", sets: W(5) },
    { exercise_template_id: "BD0AD077", rest_seconds: 0, notes: "Warm-up: 6 / side, 3 s hold.", sets: W(6) },
    { exercise_template_id: "CDA23948", rest_seconds: 0, notes: "Warm-up: 12. Prime the glutes.", sets: W(12) },
    { exercise_template_id: "6A6C31A5", rest_seconds: 0, notes: "A1 · 3×10 @ 130 · RPE 7. Full stretch at the top, pull elbows to ribs.", sets: N(3, 10, lb(130)) },
    { exercise_template_id: "11A123F3", rest_seconds: 90, notes: "A2 · 3×12 · RPE 7. Pick a weight you could do ~3 more reps with. Pad above the heel. Stop if it presses on the sore spot.", sets: N(3, 12) },
    { exercise_template_id: "F1D60854", rest_seconds: 0, notes: "B1 · 3×10 @ 100 · RPE 7. Tall chest, squeeze shoulder blades, 1 s pause.", sets: N(3, 10, lb(100)) },
    { exercise_template_id: "75A4F6C4", rest_seconds: 90, notes: "B2 · 3×12 · RPE 7. Pad on the shin, well above the ankle. Slow 3 s lowering.", sets: N(3, 12) },
    { exercise_template_id: "D57C2EC7", rest_seconds: 0, notes: "C1 · 3×10 · RPE 7. Start light (bar or ~95) and build. Feet flat, drive through the heels. If the ankle complains, swap for glute bridges.", sets: N(3, 10) },
    { exercise_template_id: "F4B4C6EE", rest_seconds: 75, notes: "C2 · 3×15 · RPE 8. Glute med = hip and ankle stability when running. Lean slightly forward.", sets: N(3, 15) },
    { exercise_template_id: "BE640BA0", rest_seconds: 0, notes: "D1 · 2×15 · RPE 8. Rope to forehead, elbows high. Can do it kneeling.", sets: N(2, 15) },
    { exercise_template_id: "D8911FC4", rest_seconds: 60, notes: "D2 · 2×8 / side. Low back glued to the floor, slow.", sets: N(2, 8) },
    { exercise_template_id: "E3EDA509", rest_seconds: 0, notes: "E1 · 2×30 s / side. From the knees if the ankle doesn't like the stacked feet.", sets: Array.from({ length: 2 }, () => ({ type: "normal", duration_seconds: 30 })) },
    { exercise_template_id: "CC55119B", rest_seconds: 60, notes: "E2 · 2×10 / side @ light · 3 s hold. Tall-kneeling. Resist the twist.", sets: N(2, 10) },
  ],
};
const res = await pushNewRoutine(a!.id, payload, null);
console.log("CREATED", JSON.stringify(res));
await db.$disconnect();
