import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { count, eq, sql } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import {
  driverProfiles,
  ledgerEntries,
  pricingConfigs,
  promotions,
  rides,
  serviceAreas,
  serviceTypes,
  settings,
  users,
} from "@/server/db/schema";
import { DEMO_ACCOUNTS, seedBaseline, seedDemo } from "@/server/db/seed";
import { SETTING_DEFAULTS, getAllSettings, getSetting } from "@/server/settings";
import { verifyPassword } from "@/server/auth/password";
import { login } from "@/server/auth/service";
import { freshDb } from "../helpers/db";

let db: Db;

const TABLES = { users, serviceTypes, pricingConfigs, serviceAreas, settings, driverProfiles, rides, ledgerEntries, promotions };
async function counts() {
  const out: Record<string, number> = {};
  for (const [name, table] of Object.entries(TABLES)) {
    const [row] = await db.select({ n: count() }).from(table);
    out[name] = Number(row.n);
  }
  return out;
}

beforeAll(async () => {
  db = await freshDb(); // runs seedBaseline once (demo mode off)
});
afterAll(async () => {
  await closeDb();
});

describe("db/seed seedBaseline", () => {
  it("is idempotent", async () => {
    const before = await counts();
    await seedBaseline(db);
    await seedBaseline(db);
    expect(await counts()).toEqual(before);
    // Demo data is not created outside demo mode.
    expect(before.rides).toBe(0);
    expect(before.driverProfiles).toBe(0);
  });

  it("creates the five service types; only approved ones are enabled, rideshare stays off", async () => {
    const types = await db.select().from(serviceTypes).orderBy(serviceTypes.sortOrder);
    expect(types.map((t) => t.id)).toEqual(["taxi", "taxi_xl", "premium", "accessible", "rideshare"]);
    for (const t of types) {
      if (t.enabled) expect(t.legalStatus, t.id).toBe("approved");
    }
    const rideshare = types.find((t) => t.id === "rideshare")!;
    expect(rideshare.enabled).toBe(false);
    expect(rideshare.legalStatus).toBe("requires_regulatory_approval");
    expect(types.filter((t) => t.enabled).map((t) => t.id)).toEqual(["taxi", "taxi_xl", "premium", "accessible"]);
    expect(types.find((t) => t.id === "taxi_xl")!.vehicleClasses).toEqual(["xl"]);
  });

  it("creates exactly one active, clearly-labelled demo tariff", async () => {
    const all = await db.select().from(pricingConfigs);
    expect(all).toHaveLength(1);
    const [cfg] = all;
    expect(cfg.active).toBe(true);
    expect(cfg.isDemo).toBe(true);
    expect(cfg.currency).toBe("ILS");
    expect(cfg.minFareAgorot).toBeLessThan(cfg.maxFareAgorot);
    expect(cfg.commissionPercentBp).toBeGreaterThan(0);
  });

  it("creates the single active Gush Dan service area", async () => {
    const areas = await db.select().from(serviceAreas);
    expect(areas).toHaveLength(1);
    expect(areas[0].active).toBe(true);
    const ring = areas[0].polygon.coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]); // closed ring
  });

  it("writes every setting default", async () => {
    const rows = await db.select().from(settings);
    expect(rows.map((r) => r.key).sort()).toEqual(Object.keys(SETTING_DEFAULTS).sort());
    expect(await getAllSettings(db)).toEqual(SETTING_DEFAULTS);
    expect(await getSetting("dispatch.offerTimeoutSec")).toBe(SETTING_DEFAULTS["dispatch.offerTimeoutSec"]);
  });

  it("creates the bootstrap admin with the configured password", async () => {
    const admins = await db.select().from(users).where(eq(users.role, "admin"));
    expect(admins).toHaveLength(1);
    expect(admins[0].email).toBe("admin@hop.local");
    expect(admins[0].isDemo).toBe(false);
    expect(await verifyPassword(admins[0].passwordHash, DEMO_ACCOUNTS.admin.password)).toBe(true);
  });
});

describe("db/seed seedDemo", () => {
  it("creates demo users, drivers, the HOP10 promotion and historical rides with ledger rows", async () => {
    await seedDemo(db);
    const demoUsers = await db.select().from(users).where(eq(users.isDemo, true));
    expect(demoUsers.filter((u) => u.role === "rider")).toHaveLength(2);
    expect(demoUsers.filter((u) => u.role === "support")).toHaveLength(1);
    expect(demoUsers.filter((u) => u.role === "driver")).toHaveLength(9);

    const profiles = await db.select().from(driverProfiles);
    expect(profiles).toHaveLength(9);
    expect(profiles.filter((p) => p.verificationStatus === "approved")).toHaveLength(7);
    expect(profiles.some((p) => p.verificationStatus === "under_review")).toBe(true);
    expect(profiles.some((p) => p.verificationStatus === "rejected")).toBe(true);
    // Unapproved drivers are never online.
    for (const p of profiles.filter((x) => x.verificationStatus !== "approved")) expect(p.availability).toBe("offline");

    const [promo] = await db.select().from(promotions).where(eq(promotions.code, "HOP10"));
    expect(promo).toMatchObject({ type: "percent", value: 1000, maxDiscountAgorot: 2000, active: true });

    const history = await db.select().from(rides);
    expect(history).toHaveLength(7);
    for (const r of history) {
      expect(r.status).toBe("completed");
      expect(r.isDemo).toBe(true);
      expect(r.commissionAgorot! + r.driverPayoutAgorot!).toBe(r.finalTotalAgorot);
      const ledger = await db.select().from(ledgerEntries).where(eq(ledgerEntries.rideId, r.id));
      expect(ledger.map((l) => l.type).sort()).toEqual(["driver_payout", "hop_commission", "rider_charge"]);
    }
    const [marker] = await db.select().from(settings).where(eq(settings.key, "demo.seeded"));
    expect(marker?.value).toBe(true);
  });

  it("is idempotent thanks to the demo.seeded marker", async () => {
    const before = await counts();
    await seedDemo(db);
    await seedBaseline(db);
    expect(await counts()).toEqual(before);
  });

  it("lets the documented demo accounts log in", async () => {
    for (const acct of [DEMO_ACCOUNTS.rider, DEMO_ACCOUNTS.driver, DEMO_ACCOUNTS.support]) {
      const res = await login({ email: acct.email, password: acct.password }, {});
      expect(res.user.email).toBe(acct.email);
    }
    const [row] = await db.select({ n: count() }).from(users).where(sql`lower(${users.email}) = ${DEMO_ACCOUNTS.driver.email}`);
    expect(Number(row.n)).toBe(1);
  });
});
