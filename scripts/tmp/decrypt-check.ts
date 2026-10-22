import "dotenv/config";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
async function main() {
  const a = await db.garminAccount.findFirst();
  const p = a!.encryptedSession;
  console.log("parts:", p.split(".").map((s) => s.length), "keyLen:", process.env.ENCRYPTION_KEY?.length);
  try { JSON.parse(decrypt(p)); console.log("decrypt OK"); } catch (e) { console.log("decrypt FAIL:", (e as Error).message); }
}
main().finally(() => db.$disconnect());
