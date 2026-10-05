// Creates the one athlete login account from .env. Deliberately writes NO
// activity or metric rows — every number on the dashboard must come from a
// real connected source (Garmin / Strava / Hevy). Run with `npm run seed`.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding.");

  const passwordHash = await bcrypt.hash(password, 12);

  await db.athlete.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      displayName: "You",
    },
  });

  console.log(`Seeded athlete ${email}. Connect Garmin in Settings to load your data.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
