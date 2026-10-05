// Renpho (smart scale) integration: a minimal client for the unofficial
// Renpho Health cloud API plus pull sync (Renpho -> our DB). The API routes
// under src/app/api/auth/renpho and src/app/api/sync/renpho are thin wrappers
// around this file, same as hevy.ts.
//
// Renpho has no public API. This talks to the same cloud.renpho.com
// endpoints the Renpho Health mobile app uses, ported from
// github.com/StartupBros-com/renpho-mcp-server (src/services/renpho-api.ts):
// every request/response body is `{ encryptData }`, AES-128-ECB with a key
// baked into the app, and responses carry `code: 101` on success. It can
// break whenever Renpho changes their app — failures surface as
// RenphoApiError rather than silently syncing nothing.
//
// Auth, like Hevy, is a single server-side credential pair (RENPHO_EMAIL /
// RENPHO_PASSWORD). The login token is short-lived, so each sync logs in
// fresh rather than persisting a session.

import crypto from "crypto";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const BASE_URL = "https://cloud.renpho.com";
const AES_KEY = Buffer.from("ed*wijdi$h6fe3ew", "utf8");
const APP_VERSION = "7.0.0";
const PAGE_SIZE = 200;
const SUCCESS_CODE = 101;

function requireCredentials(): { email: string; password: string } {
  const email = process.env.RENPHO_EMAIL;
  const password = process.env.RENPHO_PASSWORD;
  if (!email || !password) {
    throw new Error("RENPHO_EMAIL and RENPHO_PASSWORD must be set. See .env.example.");
  }
  return { email, password };
}

export class RenphoApiError extends Error {
  code: number | null;
  constructor(message: string, code: number | null) {
    super(message);
    this.name = "RenphoApiError";
    this.code = code;
  }
}

function encrypt(plaintext: string): string {
  const cipher = crypto.createCipheriv("aes-128-ecb", AES_KEY, null);
  return Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]).toString("base64");
}

function decrypt(base64: string): string {
  const decipher = crypto.createDecipheriv("aes-128-ecb", AES_KEY, null);
  return Buffer.concat([decipher.update(Buffer.from(base64, "base64")), decipher.final()]).toString(
    "utf8"
  );
}

// Renpho ids are 64-bit integers that JSON.parse would round, so they're
// pulled out of the raw decrypted text as strings, in document order.
function extractIds(raw: string, key: string): string[] {
  return Array.from(raw.matchAll(new RegExp(`"${key}":(\\d+)`, "g")), (m) => m[1]);
}

type Session = { token: string; userId: string };

/**
 * POSTs an encrypted body and returns the decrypted response text. `body:
 * null` sends an encrypted empty payload, which some endpoints require.
 */
async function renphoPost(path: string, body: unknown, session?: Session): Promise<string> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session
        ? { token: session.token, userId: session.userId, appVersion: APP_VERSION, platform: "android" }
        : {}),
    },
    body: JSON.stringify({ encryptData: encrypt(body === null ? "" : JSON.stringify(body)) }),
  });

  let json: { code?: number; msg?: string; data?: string };
  try {
    json = await res.json();
  } catch {
    throw new RenphoApiError(`Renpho ${path} returned non-JSON (HTTP ${res.status})`, null);
  }
  if (json.code !== SUCCESS_CODE) {
    throw new RenphoApiError(`Renpho ${path} failed: ${json.msg ?? "unknown error"}`, json.code ?? null);
  }
  if (!json.data) throw new RenphoApiError(`Renpho ${path} returned no data`, json.code);
  return decrypt(json.data);
}

async function login(): Promise<Session> {
  const { email, password } = requireCredentials();
  const raw = await renphoPost("renpho-aggregation/user/login", {
    questionnaire: {},
    login: {
      email,
      password,
      areaCode: "US",
      appRevision: APP_VERSION,
      cellphoneType: "Healfy",
      systemType: "11",
      platform: "android",
    },
    bindingList: { deviceTypes: ["2"] },
  });
  const parsed = JSON.parse(raw) as { login: { token: string; id: number } };
  return {
    token: parsed.login.token,
    userId: extractIds(raw, "id")[0] ?? String(parsed.login.id),
  };
}

type ScaleTable = { tableName: string; count: number; userIds: string[] };

/** Lists the scale data tables (and scale-user ids) this account has data in. */
async function listScaleTables(session: Session): Promise<ScaleTable[]> {
  const raw = await renphoPost("renpho-aggregation/device/count", null, session);
  const parsed = JSON.parse(raw) as { scale?: Array<{ tableName: string; count: number }> };
  const userIdGroups = Array.from(raw.matchAll(/"userIds":\[(\d+(?:,\d+)*)\]/g), (m) =>
    m[1].split(",")
  );
  return (parsed.scale ?? []).map((t, i) => ({
    tableName: t.tableName,
    count: t.count ?? 0,
    userIds: userIdGroups[i] ?? [],
  }));
}

/**
 * The fields of one queryAllMeasureDataList entry we read. Observed units:
 * weight/bone/sinew (muscle mass)/fatFreeWeight in kg, bodyfat/water/muscle
 * (skeletal muscle) in %, timeStamp in unix seconds.
 */
export type RenphoMeasurementDto = {
  id: string;
  bUserId?: string;
  subUserId?: string;
  timeStamp: number;
  weight: number;
  bmi?: number;
  bodyfat?: number;
  muscle?: number;
  sinew?: number;
  water?: number;
  bone?: number;
  visfat?: number;
  bmr?: number;
  bodyage?: number;
  fatFreeWeight?: number;
  [key: string]: unknown;
};

async function fetchTable(session: Session, table: ScaleTable): Promise<RenphoMeasurementDto[]> {
  const pages = Math.max(1, Math.ceil(table.count / PAGE_SIZE));
  const out: RenphoMeasurementDto[] = [];
  for (let pageNum = 1; pageNum <= pages; pageNum++) {
    const raw = await renphoPost(
      "RenphoHealth/scale/queryAllMeasureDataList",
      { pageNum, pageSize: PAGE_SIZE, userIds: table.userIds, tableName: table.tableName },
      session
    );
    const entries = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (entries.length === 0) break;
    const ids = extractIds(raw, "id");
    const bUserIds = extractIds(raw, "bUserId");
    const subUserIds = extractIds(raw, "subUserId");
    entries.forEach((e, i) => {
      out.push({
        ...e,
        id: ids[i] ?? String(e.id),
        bUserId: bUserIds[i] ?? (e.bUserId != null ? String(e.bUserId) : undefined),
        subUserId: subUserIds[i] ?? (e.subUserId != null ? String(e.subUserId) : undefined),
      } as RenphoMeasurementDto);
    });
  }
  return out;
}

/**
 * Every weigh-in on this Renpho account that belongs to the logged-in user —
 * a shared scale also records family members, so entries are kept only if
 * bound to our user id, falling back to the first scale-user id when nothing
 * is directly bound (same heuristic as the MCP server).
 */
export async function listAllMeasurements(): Promise<RenphoMeasurementDto[]> {
  const session = await login();
  const tables = await listScaleTables(session);
  const all = (await Promise.all(tables.map((t) => fetchTable(session, t)))).flat();

  const unique = new Map(all.map((m) => [m.id, m]));
  const deduped = Array.from(unique.values());

  const bound = deduped.filter((m) => m.bUserId === session.userId);
  if (bound.length > 0) return bound;
  const firstScaleUser = tables.flatMap((t) => t.userIds)[0];
  return firstScaleUser ? deduped.filter((m) => m.subUserId === firstScaleUser) : [];
}

/** Verifies the configured credentials by logging in. */
export async function verifyCredentials(): Promise<void> {
  await login();
}

// Renpho reports unmeasured composition fields as 0 rather than omitting them.
function positive(value: unknown): number | null {
  return typeof value === "number" && value > 0 ? value : null;
}

export type RenphoSyncResult = { measurementsSynced: number };

/**
 * Pulls the full weigh-in history and inserts any we don't have yet. Weigh-ins
 * aren't edited after the fact, so existing rows are left alone. Bumps
 * RenphoAccount.lastSyncedAt on success.
 */
export async function syncRenphoForAthlete(athleteId: string): Promise<RenphoSyncResult> {
  const account = await db.renphoAccount.findUnique({ where: { athleteId } });
  if (!account) throw new Error(`Athlete ${athleteId} has no connected RenphoAccount`);

  const measurements = await listAllMeasurements();
  const data: Prisma.RenphoMeasurementCreateManyInput[] = measurements
    .filter((m) => positive(m.weight) != null && m.timeStamp > 0)
    .map((m) => ({
      athleteId,
      renphoMeasurementId: m.id,
      measuredAt: new Date(m.timeStamp * 1000),
      weightKg: m.weight,
      bmi: positive(m.bmi),
      bodyFatPct: positive(m.bodyfat),
      skeletalMusclePct: positive(m.muscle),
      muscleMassKg: positive(m.sinew),
      waterPct: positive(m.water),
      boneMassKg: positive(m.bone),
      visceralFat: positive(m.visfat),
      bmrKcal: positive(m.bmr),
      metabolicAge: positive(m.bodyage) != null ? Math.round(m.bodyage as number) : null,
      fatFreeWeightKg: positive(m.fatFreeWeight),
      raw: m as unknown as Prisma.InputJsonValue,
    }));

  const { count } = await db.renphoMeasurement.createMany({ data, skipDuplicates: true });

  await db.renphoAccount.update({
    where: { id: account.id },
    data: { lastSyncedAt: new Date() },
  });

  return { measurementsSynced: count };
}
