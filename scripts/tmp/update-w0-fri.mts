import "../../mcp-server/env.ts";
import { db } from "../../src/lib/db.ts";
import { pushRoutineUpdate, type RoutineWritePayload } from "../../src/lib/hevy.ts";
const local = await db.hevyRoutine.findUniqueOrThrow({ where: { hevyRoutineId: "f98de52a-3d26-481e-a723-d3e00941cbf2" } });
const lb = (x: number) => Math.round(x * 0.45359237 * 1000) / 1000;
const W = (reps: number, n = 1) => Array.from({ length: n }, () => ({ type: "warmup", reps }));
const Ws = (sec: number, n = 1) => Array.from({ length: n }, () => ({ type: "warmup", duration_seconds: sec }));
const N = (n: number, reps: number, l: number | null = null) => Array.from({ length: n }, () => ({ type: "normal", reps, weight_kg: l == null ? null : lb(l) }));
const WL = (reps: number, l: number) => ({ type: "warmup", reps, weight_kg: lb(l) });
const payload: RoutineWritePayload = {
  title: "W0 Fri · Pull + posterior chain (ankle-friendly)",
  notes: "Intro week before W1. Sore inner ankle: no rower, lunges, squats, calf raises or jumping. Deadlift is the only standing lift; everything else is hanging, seated, lying or kneeling. Main lifts at RPE 7, everything a step lighter than W1. Sunday is the long run, so leave the gym feeling fresher than you came in. If anything pokes the ankle, skip it.",
  exercises: [
    { exercise_template_id: "05017145-b9ae-4590-b694-c8eb2829f5cb", rest_seconds: 0, sets: W(8),
      notes: "Warm-up: 8 slow reps. On hands and knees, hands under shoulders, knees under hips. Cat: exhale, push the floor away and round from tailbone to neck, chin to chest. Camel: inhale, let the belly drop and lift chest and tailbone. Move one vertebra at a time, ~3 s each way, no forcing end range. Kneel on a pad and keep the tops of the feet relaxed on the floor." },
    { exercise_template_id: "57d77865-82cd-40d5-a273-fe1a73973dee", rest_seconds: 0, sets: W(6),
      notes: "Warm-up: 6 / side. From all fours, slide one arm under the body, palm up, until the shoulder and side of the head rest on the floor. Hips stay stacked over knees, don't sit back. Then open up: reach the same arm to the ceiling and follow the hand with your eyes. Rotate from the mid-back, not the low back. 2 s pause each end." },
    { exercise_template_id: "3bfb0fb7-bf8e-47e9-959a-bd452ec34d69", rest_seconds: 0, sets: W(5),
      notes: "Warm-up: 5 transitions / side. Sit with both knees bent ~90°, front shin across the body, back shin out to the side. Sit tall, hands behind you if needed. Lift both knees and windshield-wiper them to the other side, heels staying on the floor. Lead with the knees, not the torso. Keep the feet relaxed; if the sore ankle doesn't like the back-leg position, take a smaller range on that side." },
    { exercise_template_id: "B9380898", rest_seconds: 0, sets: Ws(20, 2),
      notes: "Warm-up: 2 × 20 s. Overhand grip just outside shoulder width. First 10 s fully relaxed, letting the shoulders ride up to the ears to decompress. Last 10 s active: pull the shoulders down and back a little without bending the elbows. Ribs down, legs together and slightly in front. Step up and down on a box, never drop onto the ankle." },
    { exercise_template_id: "E8D86EE8", rest_seconds: 0, sets: W(15),
      notes: "Warm-up: 15. Light band, hands shoulder-width, arms straight out at chest height, palms down. Pull the band apart until it touches the chest by squeezing the shoulder blades together and down. Elbows stay nearly straight, ribs down, no shrugging and no leaning back. 1 s squeeze, 2 s back to the start." },
    { exercise_template_id: "BD0AD077", rest_seconds: 0, sets: W(6),
      notes: "Warm-up: 6 / side, 3 s hold. From all fours, brace the trunk like you're about to be poked. Reach the opposite arm and leg out long, not up: hand at thumb height, heel pushed back at hip height. Hips stay level (imagine a glass of water on the low back). Make a fist and squeeze hard during the hold, then sweep back under without touching down." },
    { exercise_template_id: "CDA23948", rest_seconds: 0, sets: W(12),
      notes: "Warm-up: 12. Primes the glutes for deadlifts. On your back, knees bent, feet flat, hip-width apart and about a hand's length from the glutes. Tuck the pelvis slightly (low back flat), then push through the heels and lift until knees, hips and shoulders line up. Squeeze the glutes 2 s at the top and don't arch the low back. If you feel it in the hamstrings, bring the feet closer." },
    { exercise_template_id: "729237D1", superset_id: 0, rest_seconds: 120, sets: [{ type: "warmup", reps: 5, weight_kg: 0 }, WL(3, 15), ...N(3, 6, 25)],
      notes: "A1 · 3×6 @ +25 · RPE 7. Ramp: BW×5, +15×3. Wed you did +25 for 8, 8, 5, so stop each set with 2 in the tank. Belt or DB between the feet, step on from a box. Overhand grip just outside the shoulders. Start each rep from a dead hang, then set the shoulders down first. Drive the elbows down into the back pockets, chest to the bar, chin clearly over. Legs together, glutes and abs tight, no kipping. Lower under control for 2 s to full lockout. Step down onto the box." },
    { exercise_template_id: "35B51B87", superset_id: 0, rest_seconds: 90, sets: N(3, 8, 105),
      notes: "A2 · 3×8 @ 105 · RPE 6–7. Calibrates W1's 115. Hands just inside shoulder width (index fingers on the smooth part). Shoulder blades squeezed back and down, slight arch, butt on the bench. Use the feet for balance only, no hard leg drive through the sore ankle. Lower to the lower chest/sternum with elbows tucked ~30° from the body and forearms vertical. Press back and up toward the face, full lockout. Wrists stacked, not bent back." },
    { exercise_template_id: "C6272009", superset_id: 1, rest_seconds: 120, sets: [WL(5, 95), WL(3, 135), ...N(3, 5, 155)],
      notes: "B1 · 3×5 @ 155 · RPE 7. Ramp: 95×5, 135×3. Sep 25 was 135×10s, so this should move fast. Conventional: flat shoes or socks, feet hip-width, bar over mid-foot (about 1 inch from the shins). Weight spread over the whole foot, not rolling onto the inside of the sore ankle. Hinge down and grip just outside the legs, double overhand (mixed only if grip fails). Shins to the bar, chest up, pull the slack out until the bar clicks. Lats tight (squeeze oranges in the armpits), big breath into the belly and brace. Push the floor away; hips and shoulders rise together, bar dragging up the legs. Finish standing tall with glutes, no leaning back. Lower by pushing the hips back first, then bend the knees once the bar passes them. Reset each rep, no bouncing." },
    { exercise_template_id: "CC55119B", superset_id: 1, rest_seconds: 60, sets: N(3, 10),
      notes: "B2 · 3×10 / side @ light · 3 s hold · RPE 7. Tall-kneeling, not half-kneeling, so the ankle stays unloaded. Kneel side-on to the cable at chest height, far enough out that it pulls hard. Handle at the sternum with both hands. Glutes squeezed, ribs down, hips and shoulders square to the front. Press straight out to full arm extension, hold 3 s without letting the cable rotate you, then bring it back in slowly. Breathe out on the press. Turn around for the other side." },
    { exercise_template_id: "c933bd5b-ae22-4195-8f11-36eff9a2fd3c", superset_id: 2, rest_seconds: 0, sets: N(3, 10, 100),
      notes: "C1 · 3×10 @ 100 · RPE 7. Same as Monday's 100×10s. Seat height so the handles line up with mid-chest, chest pressed into the pad the whole time. Start with arms long and let the shoulder blades spread. Pull the shoulder blades together first, then drive the elbows back past the torso. Don't lift the chest off the pad or shrug. 1 s squeeze, 2 s on the way back." },
    { exercise_template_id: "878CD1D0", superset_id: 2, rest_seconds: 75, sets: N(3, 8, 35),
      notes: "C2 · 3×8 @ 35s · RPE 7. Sep 23 was 40×6, so W1 goes up to 40×8. Bench at 80–90°, back and head on the pad, feet flat. Start with the DBs at ear height, palms forward or slightly in, elbows a bit in front of the body (not flared straight out). Press up and slightly in until the arms lock out over the shoulders, without clanking the bells. Ribs down, don't arch off the pad. Lower 2 s back to ear height." },
    { exercise_template_id: "11A123F3", superset_id: 3, rest_seconds: 0, sets: N(2, 12),
      notes: "D1 · 2×12 · RPE 7. Pick a weight you could do ~3 more reps with. Line the knee joint up with the machine's pivot point. Lower pad just above the heel, not on the sore spot. Lap pad snug on the thighs. Feet relaxed, don't point or flex the ankle hard. Curl the heels down and back as far as you can, 1 s squeeze, then 3 s back up. Hips stay down on the seat. Stop if the pad presses on the sore spot." },
    { exercise_template_id: "82f27ee8-27f6-401c-b91e-0ddfd32e9b09", superset_id: 3, rest_seconds: 60, sets: N(2, 10, 25),
      notes: "D2 · 2×10 @ 25 · RPE 7–8. Chest against the pad, handles at shoulder height, seat set so the arms are parallel to the floor. Arms long with a soft bend in the elbows. Sweep the arms out and back, leading with the elbows, until they're in line with the body. Think 'hands wide', not 'squeeze the shoulder blades'. 1 s hold, 2 s back. No shrugging." },
    { exercise_template_id: "37FCC2BB", rest_seconds: 60, sets: N(2, 8, 25),
      notes: "E · 2×8 @ 25s · RPE 8. Seated on the end of a bench, back tall, arms hanging straight, palms forward. Pin the elbows to your sides and curl up without the elbows drifting forward. Squeeze at the top, then lower in 3 s to full extension. No swinging or leaning back. Alternating or both together is fine." },
  ],
};
await pushRoutineUpdate(local.id, payload);
const r: any = await db.hevyRoutine.findUniqueOrThrow({ where: { id: local.id } });
console.log("UPDATED", r.title, r.exercises.length, "exercises");
for (const e of r.exercises) console.log(" ", e.title, "| ss", e.superset_id, "|", e.sets.map((s: any) => `${s.type[0]}:${s.weight_kg != null ? Math.round(s.weight_kg / 0.45359237) + "lb" : "-"}x${s.reps ?? s.duration_seconds + "s"}`).join(" "), "|", (e.notes ?? "").length, "chars, ends:", (e.notes ?? "").slice(-30));
await db.$disconnect();
