import { eq } from "drizzle-orm";
import { getDb, type Db, type Tx } from "./db/client";
import { settings } from "./db/schema";

export const SETTING_DEFAULTS = {
  "dispatch.offerTimeoutSec": 20,
  "dispatch.searchTimeoutSec": 150,
  "dispatch.searchRadiusM": 9000,
  "dispatch.maxOfferAttempts": 10,
  "dispatch.driverStaleLocationSec": 180,
  "dispatch.minAcceptanceRateBp": 0, // 0 = disabled (fairness: off until justified)
  "dispatch.retryIntervalSec": 4,
  "demo.autopilot": true,
  "demo.autopilotAcceptDelaySec": 3,
  "demo.driverSpeedMps": 14,
  "platform.operatingNotice":
    "HOP פועלת בסביבת פיילוט. שירותים מסחריים יופעלו רק לאחר אישור רגולטורי וביטוחי.",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type SettingValue<K extends SettingKey> = (typeof SETTING_DEFAULTS)[K];

export async function getSetting<K extends SettingKey>(key: K, db?: Db | Tx): Promise<SettingValue<K>> {
  const conn = db ?? (await getDb());
  const rows = await conn.select().from(settings).where(eq(settings.key, key)).limit(1);
  const row = rows[0];
  if (!row) return SETTING_DEFAULTS[key];
  return row.value as SettingValue<K>;
}

export async function getAllSettings(db?: Db | Tx): Promise<Record<SettingKey, unknown>> {
  const conn = db ?? (await getDb());
  const rows = await conn.select().from(settings);
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out as Record<SettingKey, unknown>;
}

export async function setSetting(key: SettingKey, value: unknown, updatedBy: string | null, db?: Db | Tx) {
  const conn = db ?? (await getDb());
  await conn
    .insert(settings)
    .values({ key, value, updatedBy })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy, updatedAt: new Date() } });
}
