import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb, type Db, type Tx } from "../db/client";
import { pricingConfigs, promotions, type PricingConfig, type Promotion } from "../db/schema";
import { conflict } from "../errors";

export async function getActivePricing(db?: Db | Tx): Promise<PricingConfig> {
  const conn = db ?? (await getDb());
  const rows = await conn
    .select()
    .from(pricingConfigs)
    .where(eq(pricingConfigs.active, true))
    .orderBy(desc(pricingConfigs.updatedAt))
    .limit(1);
  const cfg = rows[0];
  if (!cfg) throw conflict("no_pricing", "לא הוגדר תעריף פעיל. פנו למפעיל המערכת.");
  return cfg;
}

export async function findPromotion(code: string, db?: Db | Tx): Promise<Promotion | null> {
  const conn = db ?? (await getDb());
  const now = new Date();
  const rows = await conn
    .select()
    .from(promotions)
    .where(
      and(
        eq(promotions.code, code.trim().toUpperCase()),
        eq(promotions.active, true),
        or(isNull(promotions.startsAt), lt(promotions.startsAt, now)),
        or(isNull(promotions.endsAt), gt(promotions.endsAt, now)),
      ),
    )
    .limit(1);
  const p = rows[0];
  if (!p) return null;
  if (p.usageLimit != null && p.usedCount >= p.usageLimit) return null;
  return p;
}
