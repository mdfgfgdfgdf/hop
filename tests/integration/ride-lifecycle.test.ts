import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { driverProfiles, ledgerEntries, rideOffers, rides } from "@/server/db/schema";
import {
  cancelRide,
  completeRide,
  createQuotes,
  createRide,
  driverArrived,
  driverArriving,
  getActiveRideFor,
  rateRide,
  respondToOffer,
  runMatching,
  startRide,
  updateDriverLocation,
} from "@/server/dispatch/service";
import { freshDb, makeDriver, makeUser, TLV } from "../helpers/db";

let db: Db;

beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await closeDb();
});

describe("ride lifecycle", () => {
  it("quotes → ride → offer → accept → arrive → start → complete, with ledger", async () => {
    const rider = await makeUser(db, "rider");
    const near = await makeDriver(db, { lat: 32.076, lng: 34.776, name: "near" });
    const far = await makeDriver(db, { lat: 32.11, lng: 34.80, name: "far" });

    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    expect(q.quotes.length).toBeGreaterThan(0);
    expect(q.route.distanceM).toBeGreaterThan(500);
    const taxi = q.quotes.find((x) => x.serviceType.id === "taxi")!;
    expect(taxi.fare.riderTotalAgorot).toBeGreaterThanOrEqual(2500);
    expect(taxi.fare.hopCommissionAgorot + taxi.fare.driverPayoutAgorot).toBe(taxi.fare.riderTotalAgorot);
    expect(taxi.fare.isDemoTariff).toBe(true);
    expect(taxi.availableDrivers).toBe(2);

    const ride = await createRide({ rider, quoteId: taxi.id, paymentMethod: "cash" });
    expect(ride.status).toBe("offered");

    // Nearest driver receives the offer.
    const [row] = await db.select().from(rides).where(eq(rides.id, ride.id));
    expect(row.offeredDriverId).toBe(near.user.id);
    const offers = await db.select().from(rideOffers).where(eq(rideOffers.rideId, ride.id));
    expect(offers).toHaveLength(1);
    expect(offers[0].driverPayoutAgorot).toBe(taxi.fare.driverPayoutAgorot);

    // The far driver cannot accept an offer not addressed to them.
    await expect(respondToOffer({ driver: far.user, rideId: ride.id, accept: true })).rejects.toMatchObject({ code: "offer_unavailable" });

    const accepted = await respondToOffer({ driver: near.user, rideId: ride.id, accept: true });
    expect(accepted.status).toBe("accepted");
    expect(accepted.rider?.name).toBe(rider.name);
    const [p] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, near.user.id));
    expect(p.availability).toBe("busy");

    // Rider sees driver vehicle & masked phone.
    const riderView = await getActiveRideFor(rider);
    expect(riderView?.driver?.vehicle?.plate).toBeTruthy();
    expect(riderView?.driver?.phoneMasked).toMatch(/^•••-\d{4}$/);

    // A second accept must fail (ride is no longer offered).
    await expect(respondToOffer({ driver: near.user, rideId: ride.id, accept: true })).rejects.toMatchObject({ code: "offer_unavailable" });

    await driverArriving({ driver: near.user, rideId: ride.id });
    await driverArrived({ driver: near.user, rideId: ride.id });
    const started = await startRide({ driver: near.user, rideId: ride.id });
    expect(started.status).toBe("in_progress");
    // Starting twice is rejected.
    await expect(startRide({ driver: near.user, rideId: ride.id })).rejects.toMatchObject({ code: "invalid_transition" });

    await updateDriverLocation({ driver: near.user, lat: 32.0775, lng: 34.777 });
    await updateDriverLocation({ driver: near.user, lat: 32.0807, lng: 34.7805 });
    const done = await completeRide({ driver: near.user, rideId: ride.id });
    expect(done.status).toBe("completed");
    expect(done.finalTotalAgorot).toBe(taxi.fare.riderTotalAgorot);
    expect(done.driverPayoutAgorot).toBe(taxi.fare.driverPayoutAgorot);
    // Completing twice is rejected.
    await expect(completeRide({ driver: near.user, rideId: ride.id })).rejects.toMatchObject({ code: "invalid_transition" });

    const ledger = await db.select().from(ledgerEntries).where(eq(ledgerEntries.rideId, ride.id));
    const byType = Object.fromEntries(ledger.map((l) => [l.type, l.amountAgorot]));
    expect(byType.rider_charge).toBe(taxi.fare.riderTotalAgorot);
    expect(byType.hop_commission).toBe(taxi.fare.hopCommissionAgorot);
    expect(byType.driver_payout).toBe(taxi.fare.driverPayoutAgorot);

    const [p2] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, near.user.id));
    expect(p2.availability).toBe("online");

    const rated = await rateRide({ actor: rider, rideId: ride.id, stars: 5 });
    expect(rated.riderRating).toBe(5);
    await expect(rateRide({ actor: rider, rideId: ride.id, stars: 4 })).rejects.toMatchObject({ code: "already_rated" });
    const [p3] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, near.user.id));
    expect(p3.ratingCount).toBe(1);
  });

  it("prevents two drivers from accepting the same ride under a concurrent race", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, { lat: 32.0753, lng: 34.7752 });
    const d2 = await makeDriver(db, { lat: 32.0754, lng: 34.7753 });
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    const ride = await createRide({ rider, quoteId: q.quotes[0].id, paymentMethod: "cash" });
    const [row] = await db.select().from(rides).where(eq(rides.id, ride.id));
    const offered = row.offeredDriverId === d1.user.id ? d1 : d2;
    const other = offered === d1 ? d2 : d1;

    const results = await Promise.allSettled([
      respondToOffer({ driver: offered.user, rideId: ride.id, accept: true }),
      respondToOffer({ driver: other.user, rideId: ride.id, accept: true }),
      respondToOffer({ driver: offered.user, rideId: ride.id, accept: true }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled).toHaveLength(1);
    const [final] = await db.select().from(rides).where(eq(rides.id, ride.id));
    expect(final.status).toBe("accepted");
    expect(final.driverId).toBe(offered.user.id);
  });

  it("decline → re-offer to next driver; rider cancel releases driver", async () => {
    // Herzliya: far from drivers created by the other tests in this file.
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, { lat: 32.164, lng: 34.797 });
    const d2 = await makeDriver(db, { lat: 32.17, lng: 34.81 });
    const q = await createQuotes({ rider, pickup: { lat: 32.1636, lng: 34.7966, address: "מרינה הרצליה" }, dropoff: { lat: 32.1605, lng: 34.812, address: "שבעת הכוכבים" } });
    const ride = await createRide({ rider, quoteId: q.quotes[0].id, paymentMethod: "card_demo" });
    let [row] = await db.select().from(rides).where(eq(rides.id, ride.id));
    expect(row.offeredDriverId).toBe(d1.user.id);

    const declined = await respondToOffer({ driver: d1.user, rideId: ride.id, accept: false });
    expect(declined.status).toBe("offered");
    [row] = await db.select().from(rides).where(eq(rides.id, ride.id));
    expect(row.offeredDriverId).toBe(d2.user.id);
    expect(row.excludedDriverIds).toContain(d1.user.id);

    await respondToOffer({ driver: d2.user, rideId: ride.id, accept: true });
    const cancelled = await cancelRide({ actor: rider, rideId: ride.id, reason: "שיניתי תוכניות" });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledBy).toBe("rider");
    expect(cancelled.cancellationFeeAgorot).toBe(0); // within grace window
    const [p] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, d2.user.id));
    expect(p.availability).toBe("online");
  });

  it("cancels with no drivers available after the search window", async () => {
    const rider = await makeUser(db, "rider");
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.rabin });
    // Make every driver busy/offline for this test by using an XL-only quote with no XL drivers.
    const xl = q.quotes.find((x) => x.serviceType.id === "taxi_xl")!;
    const ride = await createRide({ rider, quoteId: xl.id, paymentMethod: "cash" });
    expect(ride.status).toBe("searching");
    await db.update(rides).set({ searchExpiresAt: new Date(Date.now() - 1000) }).where(eq(rides.id, ride.id));
    const result = await runMatching(ride.id);
    expect(result).toBe("cancelled");
    const [row] = await db.select().from(rides).where(eq(rides.id, ride.id));
    expect(row.cancelReason).toBe("no_drivers_available");
  });

  it("rejects quotes outside the service area and reuse of a quote", async () => {
    const rider = await makeUser(db, "rider");
    await expect(createQuotes({ rider, pickup: TLV.jerusalem, dropoff: TLV.rabin })).rejects.toMatchObject({ code: "outside_service_area" });
    const q = await createQuotes({ rider, pickup: TLV.dizengoff, dropoff: TLV.airport });
    await makeDriver(db, { lat: 32.0753, lng: 34.7752 });
    const ride = await createRide({ rider, quoteId: q.quotes[0].id, paymentMethod: "cash" });
    await expect(createRide({ rider, quoteId: q.quotes[0].id, paymentMethod: "cash" })).rejects.toMatchObject({ code: "quote_used" });
    await expect(createRide({ rider, quoteId: q.quotes[1].id, paymentMethod: "cash" })).rejects.toMatchObject({ code: "ride_active" });
    await cancelRide({ actor: rider, rideId: ride.id });
  });

  it("unverified drivers never receive offers and cannot go online", async () => {
    const rider = await makeUser(db, "rider");
    // Fresh area of the map so only this driver is nearby.
    const pending = await makeDriver(db, { lat: 32.014, lng: 34.772, approved: false });
    const { setDriverAvailability } = await import("@/server/dispatch/service");
    await expect(setDriverAvailability({ driver: pending.user, online: true, location: { lat: 32.014, lng: 34.772 } })).rejects.toMatchObject({ status: 403 });
    const q = await createQuotes({ rider, pickup: { lat: 32.0146, lng: 34.7727, address: "חולון" }, dropoff: { lat: 32.0113, lng: 34.778, address: "קניון חולון" } });
    const premium = q.quotes.find((x) => x.serviceType.id === "premium")!;
    const ride = await createRide({ rider, quoteId: premium.id, paymentMethod: "cash" });
    expect(ride.status).toBe("searching");
    await cancelRide({ actor: rider, rideId: ride.id });
  });
});
