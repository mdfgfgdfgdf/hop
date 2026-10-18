import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { promotions, quotes, serviceTypes, users } from "@/server/db/schema";
import { cancelRide, createQuotes, createRide } from "@/server/dispatch/service";
import { getActivePricing } from "@/server/pricing/config";
import { computeFare } from "@/server/pricing/engine";
import { isInServiceArea } from "@/server/geo";
import { freshDb, makeDriver, makeUser, resetDispatch, rideRow, TLV } from "../helpers/db";

let db: Db;

beforeAll(async () => {
  db = await freshDb();
  await db.insert(promotions).values([
    { code: "TEST10", type: "percent", value: 1000, maxDiscountAgorot: 300, active: true },
    { code: "FLAT5", type: "fixed", value: 500, active: true },
    { code: "OFF", type: "percent", value: 1000, active: false },
    { code: "OVER", type: "percent", value: 1000, active: true, endsAt: new Date(Date.now() - 60_000) },
    { code: "SOON", type: "percent", value: 1000, active: true, startsAt: new Date(Date.now() + 86_400_000) },
    { code: "USEDUP", type: "percent", value: 1000, active: true, usageLimit: 5, usedCount: 5 },
    { code: "ONCE", type: "fixed", value: 500, active: true, usageLimit: 1 },
  ]);
});
afterAll(async () => {
  await closeDb();
});
beforeEach(async () => {
  await resetDispatch(db);
});

const byId = (q: Awaited<ReturnType<typeof createQuotes>>, id: string) => q.quotes.find((x) => x.serviceType.id === id);

describe("dispatch/service createQuotes", () => {
  it("returns one quote per enabled + approved service type, sorted, never rideshare", async () => {
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    expect(q.quotes.map((x) => x.serviceType.id)).toEqual(["taxi", "taxi_xl", "premium", "accessible"]);
    expect(q.isDemoTariff).toBe(true);
    expect(q.geoProvider).toBe("demo");
    expect(q.route.provider).toBe("demo");
    expect(q.pickup).toMatchObject({ address: TLV.dizengoff.address, lat: TLV.dizengoff.lat, lng: TLV.dizengoff.lng });
    const rows = await db.select().from(quotes).where(eq(quotes.riderId, rider.id));
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.usedByRideId === null && r.promoCode === null)).toBe(true);
  });

  it("drops a service type as soon as it is disabled", async () => {
    const rider = await makeUser(db, "rider");
    await db.update(serviceTypes).set({ enabled: false }).where(eq(serviceTypes.id, "premium"));
    try {
      const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
      expect(q.quotes.map((x) => x.serviceType.id)).toEqual(["taxi", "taxi_xl", "accessible"]);
    } finally {
      await db.update(serviceTypes).set({ enabled: true }).where(eq(serviceTypes.id, "premium"));
    }
  });

  it("never quotes an enabled service type that lacks regulatory approval", async () => {
    const rider = await makeUser(db, "rider");
    // Simulate a bad manual edit: enabled but still unapproved.
    await db.update(serviceTypes).set({ enabled: true }).where(eq(serviceTypes.id, "rideshare"));
    try {
      const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
      expect(q.quotes.map((x) => x.serviceType.id)).not.toContain("rideshare");
    } finally {
      await db.update(serviceTypes).set({ enabled: false }).where(eq(serviceTypes.id, "rideshare"));
    }
  });

  it("prices each service with its multiplier using the server-side tariff", async () => {
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport });
    const [taxi, xl, premium, accessible] = ["taxi", "taxi_xl", "premium", "accessible"].map((id) => byId(q, id)!);
    expect(taxi.fare.serviceMultiplierBp).toBe(10000);
    expect(xl.fare.serviceMultiplierBp).toBe(13500);
    expect(premium.fare.serviceMultiplierBp).toBe(16000);
    expect(taxi.riderTotalAgorot).toBeLessThan(xl.riderTotalAgorot);
    expect(xl.riderTotalAgorot).toBeLessThan(premium.riderTotalAgorot);
    expect(accessible.riderTotalAgorot).toBe(taxi.riderTotalAgorot);
    const cfg = await getActivePricing();
    for (const quote of q.quotes) {
      expect(quote.fare.pricingConfigId).toBe(cfg.id);
      expect(quote.fare.hopCommissionAgorot + quote.fare.driverPayoutAgorot).toBe(quote.riderTotalAgorot);
      const expected = computeFare({
        distanceM: q.route.distanceM,
        durationS: q.route.durationS,
        config: cfg,
        serviceMultiplierBp: quote.serviceType.priceMultiplierBp,
        at: new Date(new Date(quote.expiresAt).getTime() - cfg.quoteTtlSec * 1000),
      });
      expect(quote.riderTotalAgorot).toBe(expected.riderTotalAgorot);
    }
  });

  it("sets the quote expiry from the tariff's quoteTtlSec", async () => {
    const rider = await makeUser(db, "rider");
    const before = Date.now();
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    const cfg = await getActivePricing();
    const exp = new Date(q.quotes[0].expiresAt).getTime();
    expect(exp).toBeGreaterThanOrEqual(before + cfg.quoteTtlSec * 1000 - 5);
    expect(exp).toBeLessThanOrEqual(Date.now() + cfg.quoteTtlSec * 1000);
  });

  it("counts only online, approved, fresh, active drivers of a matching class", async () => {
    const rider = await makeUser(db, "rider");
    const std = await makeDriver(db, { lat: 32.0762, lng: 34.7761, vehicleClass: "standard" });
    await makeDriver(db, { lat: 32.0795, lng: 34.7775, vehicleClass: "xl" });
    await makeDriver(db, { lat: 32.0753, lng: 34.7752, online: false }); // offline
    await makeDriver(db, { lat: 32.0753, lng: 34.7752, approved: false }); // under review
    await makeDriver(db, { lat: 32.0753, lng: 34.7752, verificationStatus: "suspended" });
    await makeDriver(db, { lat: 32.0753, lng: 34.7752, lastLocationAt: new Date(Date.now() - 10 * 60_000) }); // stale GPS
    await makeDriver(db, { lat: 32.0753, lng: 34.7752, lastLocationAt: null }); // never reported
    const banned = await makeDriver(db, { lat: 32.0753, lng: 34.7752 });
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, banned.user.id));

    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    expect(byId(q, "taxi")!.availableDrivers).toBe(2); // taxi accepts every class
    expect(byId(q, "taxi_xl")!.availableDrivers).toBe(1);
    expect(byId(q, "premium")!.availableDrivers).toBe(0);
    expect(byId(q, "premium")!.etaToPickupS).toBeNull();
    expect(byId(q, "accessible")!.etaToPickupS).toBeNull();
    // The nearest eligible driver sets the ETA.
    const taxiEta = byId(q, "taxi")!.etaToPickupS!;
    const xlEta = byId(q, "taxi_xl")!.etaToPickupS!;
    expect(taxiEta).toBeGreaterThan(0);
    expect(taxiEta).toBeLessThan(xlEta);

    // A driver holding a pending offer is not available to others.
    const other = await makeUser(db, "rider");
    const q2 = await createQuotes({ rider: other, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    const ride = await createRide({ rider: other, quoteId: byId(q2, "taxi")!.id, paymentMethod: "cash" });
    expect(ride.status).toBe("offered");
    expect((await rideRow(db, ride.id)).offeredDriverId).toBe(std.user.id);
    const q3 = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    expect(byId(q3, "taxi")!.availableDrivers).toBe(1);
    await cancelRide({ actor: other, rideId: ride.id });
  });

  it.skip("BUG: availableDrivers/etaToPickupS count drivers far beyond dispatch.searchRadiusM", async () => {
    const rider = await makeUser(db, "rider");
    // Herzliya driver ~20 km from Holon: runMatching would never offer this ride to them.
    await makeDriver(db, { lat: 32.1636, lng: 34.7966 });
    const q = await createQuotes({ rider, pickup: { lat: 32.0146, lng: 34.7727, address: "חולון" }, dropoff: { lat: 32.0113, lng: 34.778, address: "קניון חולון" } });
    expect(byId(q, "taxi")!.availableDrivers).toBe(0);
    expect(byId(q, "taxi")!.etaToPickupS).toBeNull();
  });

  it("rejects pickup and dropoff closer than 50 m", async () => {
    const rider = await makeUser(db, "rider");
    await expect(
      createQuotes({ rider, pickup: TLV.dizengoff, dropoff: { ...TLV.dizengoff, lat: TLV.dizengoff.lat + 0.0002 } }),
    ).rejects.toMatchObject({ status: 400, code: "same_point" });
  });

  it("only requires the pickup to be inside the service area", async () => {
    const rider = await makeUser(db, "rider");
    expect(await isInServiceArea(TLV.dizengoff)).toBe(true);
    expect(await isInServiceArea(TLV.jerusalem)).toBe(false);
    const q = await createQuotes({ rider, pickup: TLV.rabin, dropoff: TLV.jerusalem });
    expect(q.route.distanceM).toBeGreaterThan(50_000);
    await expect(createQuotes({ rider, pickup: TLV.jerusalem, dropoff: TLV.rabin })).rejects.toMatchObject({ status: 400, code: "outside_service_area" });
  });

  it("rejects unknown, inactive, expired, not-yet-started and used-up promo codes", async () => {
    const rider = await makeUser(db, "rider");
    for (const promoCode of ["NOPE", "OFF", "OVER", "SOON", "USEDUP"]) {
      await expect(createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport, promoCode }), promoCode).rejects.toMatchObject({
        status: 400,
        code: "invalid_promo",
      });
    }
  });

  it("applies a valid percent promo (case/whitespace-insensitive) capped at its maximum", async () => {
    const rider = await makeUser(db, "rider");
    const plain = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport });
    const promo = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport, promoCode: "  test10 " });
    for (const id of ["taxi", "premium"]) {
      const a = byId(plain, id)!;
      const b = byId(promo, id)!;
      // 10% of these fares is well above the 3 ₪ cap.
      expect(b.fare.discountAgorot).toBe(300);
      expect(b.riderTotalAgorot).toBeLessThan(a.riderTotalAgorot);
      expect(a.riderTotalAgorot - b.riderTotalAgorot).toBeGreaterThanOrEqual(300 - 10);
      expect(a.riderTotalAgorot - b.riderTotalAgorot).toBeLessThanOrEqual(300 + 10);
      expect(b.fare.lines.find((l) => l.key === "discount")?.amountAgorot).toBe(-300);
    }
    const [row] = await db.select().from(quotes).where(eq(quotes.id, byId(promo, "taxi")!.id));
    expect(row.promoCode).toBe("TEST10");
  });

  it("applies a fixed promo", async () => {
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport, promoCode: "flat5" });
    expect(byId(q, "taxi")!.fare.discountAgorot).toBe(500);
  });

  it.skip("BUG: promo usage is never counted, so usageLimit is never enforced", async () => {
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin, promoCode: "ONCE" });
    const ride = await createRide({ rider, quoteId: q.quotes[0].id, paymentMethod: "cash" });
    await cancelRide({ actor: rider, rideId: ride.id });
    const [promo] = await db.select().from(promotions).where(eq(promotions.code, "ONCE"));
    expect(promo.usedCount).toBe(1);
    await expect(createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin, promoCode: "ONCE" })).rejects.toMatchObject({ code: "invalid_promo" });
  });
});

describe("dispatch/service createRide (quote handling)", () => {
  it("marks the quote used by the new ride and copies the quoted fare", async () => {
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    const taxi = byId(q, "taxi")!;
    const ride = await createRide({ rider, quoteId: taxi.id, paymentMethod: "card_demo" });
    const [row] = await db.select().from(quotes).where(eq(quotes.id, taxi.id));
    expect(row.usedByRideId).toBe(ride.id);
    expect(ride.quotedTotalAgorot).toBe(taxi.riderTotalAgorot);
    expect(ride.quotedFare).toEqual(taxi.fare);
    expect(ride.paymentMethod).toBe("card_demo");
    expect(ride.estimatedDistanceM).toBe(q.route.distanceM);
    // Other quotes of the same request stay unused.
    const [xl] = await db.select().from(quotes).where(eq(quotes.id, byId(q, "taxi_xl")!.id));
    expect(xl.usedByRideId).toBeNull();
    await cancelRide({ actor: rider, rideId: ride.id });
  });

  it("rejects an expired quote", async () => {
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    await db.update(quotes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(quotes.id, q.quotes[0].id));
    await expect(createRide({ rider, quoteId: q.quotes[0].id, paymentMethod: "cash" })).rejects.toMatchObject({ status: 409, code: "quote_expired" });
  });

  it("rejects someone else's quote and unknown quotes as not found", async () => {
    const rider = await makeUser(db, "rider");
    const thief = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    await expect(createRide({ rider: thief, quoteId: q.quotes[0].id, paymentMethod: "cash" })).rejects.toMatchObject({ status: 404 });
    await expect(createRide({ rider, quoteId: "missing", paymentMethod: "cash" })).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a quote whose service type was disabled after quoting", async () => {
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    await db.update(serviceTypes).set({ enabled: false }).where(eq(serviceTypes.id, "accessible"));
    try {
      await expect(createRide({ rider, quoteId: byId(q, "accessible")!.id, paymentMethod: "cash" })).rejects.toMatchObject({
        status: 409,
        code: "service_unavailable",
      });
    } finally {
      await db.update(serviceTypes).set({ enabled: true }).where(eq(serviceTypes.id, "accessible"));
    }
  });
});
