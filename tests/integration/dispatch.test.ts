import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { auditLogs, driverProfiles, ledgerEntries, ratings, rideOffers, rideTrackPoints, rides } from "@/server/db/schema";
import {
  cancelRide,
  completeRide,
  driverArrived,
  driverArriving,
  expireOffer,
  getActiveRideFor,
  getRideDTO,
  listRidesFor,
  rateRide,
  respondToOffer,
  runMatching,
  setDriverAvailability,
  startRide,
  updateDriverLocation,
} from "@/server/dispatch/service";
import { sweep } from "@/server/dispatch/scheduler";
import { setSetting } from "@/server/settings";
import { haversineM } from "@/server/geo";
import { freshDb, makeDriver, makeUser, profileRow, resetDispatch, rideRow, TLV } from "../helpers/db";
import { acceptAndStart, bookRide, driveToCompletion } from "../helpers/rides";

let db: Db;

beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await closeDb();
});
beforeEach(async () => {
  // Every test starts from a world with no active rides and no online drivers.
  await resetDispatch(db);
});

const NEAR = { lat: 32.0757, lng: 34.7756 }; // ~70 m from Dizengoff Center
const FARTHER = { lat: 32.0785, lng: 34.7785 }; // ~480 m

const offersOf = (rideId: string) => db.select().from(rideOffers).where(eq(rideOffers.rideId, rideId)).orderBy(rideOffers.createdAt);
const pastOffer = (rideId: string) => db.update(rides).set({ offerExpiresAt: new Date(Date.now() - 1000) }).where(eq(rides.id, rideId));

describe("dispatch offers: expiry and sweep", () => {
  it("expireOffer returns the ride to searching, marks the offer expired and excludes the driver", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    expect((await rideRow(db, ride.id)).offeredDriverId).toBe(d1.user.id);

    // Not yet due → no-op.
    expect(await expireOffer(ride.id)).toBe(false);
    expect((await rideRow(db, ride.id)).status).toBe("offered");

    await pastOffer(ride.id);
    expect(await expireOffer(ride.id)).toBe(true);
    const row = await rideRow(db, ride.id);
    expect(row.status).toBe("searching"); // nobody else to offer it to
    expect(row.offeredDriverId).toBeNull();
    expect(row.offerExpiresAt).toBeNull();
    expect(row.excludedDriverIds).toEqual([d1.user.id]);
    const [o] = await offersOf(ride.id);
    expect(o.status).toBe("expired");
    expect(o.respondedAt).not.toBeNull();
    // The expired driver can no longer accept.
    await expect(respondToOffer({ driver: d1.user, rideId: ride.id, accept: true })).rejects.toMatchObject({ code: "offer_unavailable" });
    // A second expiry is a no-op.
    expect(await expireOffer(ride.id)).toBe(false);
  });

  it("expireOffer re-offers to the next-best driver", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const d2 = await makeDriver(db, FARTHER);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await pastOffer(ride.id);
    await expireOffer(ride.id);
    const row = await rideRow(db, ride.id);
    expect(row.status).toBe("offered");
    expect(row.offeredDriverId).toBe(d2.user.id);
    expect(row.offerAttempts).toBe(2);
    const offers = await offersOf(ride.id);
    expect(offers.map((o) => [o.driverId, o.status, o.attempt])).toEqual([
      [d1.user.id, "expired", 1],
      [d2.user.id, "pending", 2],
    ]);
    expect((await profileRow(db, d1.user.id)).offersReceived).toBe(1);
    expect((await profileRow(db, d1.user.id)).offersAccepted).toBe(0);
  });

  it("rejects an accept after the offer deadline even before the sweep ran", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await pastOffer(ride.id);
    await expect(respondToOffer({ driver: d1.user, rideId: ride.id, accept: true })).rejects.toMatchObject({ status: 409, code: "offer_unavailable" });
  });

  it("sweep() expires past-due offers and cancels searches past searchExpiresAt", async () => {
    const r1 = await makeUser(db, "rider");
    const r2 = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride: offered } = await bookRide(r1, TLV.dizengoff, TLV.rabin);
    const { ride: lonely } = await bookRide(r2, TLV.dizengoff, TLV.rabin, { serviceTypeId: "premium" }); // no premium drivers
    expect(lonely.status).toBe("searching");
    await pastOffer(offered.id);
    await db.update(rides).set({ searchExpiresAt: new Date(Date.now() - 1000) }).where(eq(rides.id, lonely.id));

    await sweep();

    const a = await rideRow(db, offered.id);
    expect(a.status).toBe("searching");
    expect(a.excludedDriverIds).toContain(d1.user.id);
    expect((await offersOf(offered.id))[0].status).toBe("expired");
    const b = await rideRow(db, lonely.id);
    expect(b).toMatchObject({ status: "cancelled", cancelledBy: "system", cancelReason: "no_drivers_available", paymentStatus: "not_applicable" });
    expect(b.cancelledAt).not.toBeNull();
  });

  it("gives up after dispatch.maxOfferAttempts offers", async () => {
    const rider = await makeUser(db, "rider");
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    expect(ride.status).toBe("searching");
    await db.update(rides).set({ offerAttempts: 10 }).where(eq(rides.id, ride.id));
    expect(await runMatching(ride.id)).toBe("cancelled");
    expect((await rideRow(db, ride.id)).cancelReason).toBe("no_drivers_available");
    // Matching a finished ride is a no-op.
    expect(await runMatching(ride.id)).toBe("noop");
  });

  it("honours dispatch.searchRadiusM", async () => {
    const rider = await makeUser(db, "rider");
    await makeDriver(db, FARTHER); // ~480 m away
    await setSetting("dispatch.searchRadiusM", 300, null);
    try {
      const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
      expect(ride.status).toBe("searching");
      await setSetting("dispatch.searchRadiusM", 1000, null);
      expect(await runMatching(ride.id)).toBe("offered");
    } finally {
      await setSetting("dispatch.searchRadiusM", 9000, null);
    }
  });
});

describe("dispatch cancellation", () => {
  it("driver cancel after accepting: ride re-dispatched, driver excluded and back online, flagged", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const d2 = await makeDriver(db, FARTHER);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: true });
    await driverArriving({ driver: d1.user, rideId: ride.id });

    // The cancellation commits even though the response currently fails (see the BUG test below).
    await cancelRide({ actor: d1.user, rideId: ride.id, reason: "תקלה ברכב" }).catch(() => null);
    const row = await rideRow(db, ride.id);
    expect(row.status).toBe("offered"); // straight to the next driver
    expect(row.offeredDriverId).toBe(d2.user.id);
    expect(row.driverId).toBeNull();
    expect(row.acceptedAt).toBeNull();
    expect(row.arrivingAt).toBeNull();
    expect(row.excludedDriverIds).toContain(d1.user.id);
    expect(row.flags.map((f) => f.code)).toContain("driver_cancelled");
    expect(row.searchExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect((await profileRow(db, d1.user.id)).availability).toBe("online");
    // No fee for the rider when the driver cancels.
    expect(row.cancellationFeeAgorot).toBe(0);
  });

  it("driver cancel commits the re-dispatch but answers the driver with 403", async () => {
    // cancelRide() ends with getRideDTO(rideId, actor) without skipAuth; after a
    // driver cancel the driver is no longer a party, so assertCanView throws.
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: true });
    await expect(cancelRide({ actor: d1.user, rideId: ride.id })).resolves.toMatchObject({ id: ride.id });
  });

  it("a declining driver's response reveals the next offered driver and the rider", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    await makeDriver(db, FARTHER);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    const res = await respondToOffer({ driver: d1.user, rideId: ride.id, accept: false });
    expect(res.driver).toBeNull();
    expect(res.rider).toBeNull();
  });

  it("driver cannot cancel a ride in progress or someone else's ride", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const stranger = await makeDriver(db, { lat: 32.11, lng: 34.84, online: false });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await expect(cancelRide({ actor: stranger.user, rideId: ride.id })).rejects.toMatchObject({ status: 403 });
    await acceptAndStart(d1.user, ride.id);
    await expect(cancelRide({ actor: d1.user, rideId: ride.id })).rejects.toMatchObject({ status: 409, code: "cannot_cancel" });
  });

  it("admin cancel of an offered ride cancels the pending offer; the driver stays online", async () => {
    const admin = await makeUser(db, "admin");
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    const dto = await cancelRide({ actor: admin, rideId: ride.id, reason: "בדיקה", ip: "198.51.100.1" });
    expect(dto).toMatchObject({ status: "cancelled", cancelledBy: "admin", cancelReason: "בדיקה", paymentStatus: "not_applicable", cancellationFeeAgorot: 0 });
    const [o] = await offersOf(ride.id);
    expect(o.status).toBe("cancelled");
    expect((await rideRow(db, ride.id)).offeredDriverId).toBeNull();
    expect((await profileRow(db, d1.user.id)).availability).toBe("online");
    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.action, "ride.cancel"), eq(auditLogs.targetId, ride.id)));
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ actorId: admin.id, ip: "198.51.100.1" });
    // A finished ride cannot be cancelled again.
    await expect(cancelRide({ actor: admin, rideId: ride.id })).rejects.toMatchObject({ status: 409, code: "cannot_cancel" });
  });

  it("admin cancel of an accepted ride releases the driver", async () => {
    const support = await makeUser(db, "support");
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: true });
    expect((await profileRow(db, d1.user.id)).availability).toBe("busy");
    await cancelRide({ actor: support, rideId: ride.id, reason: "rider called support" });
    expect((await profileRow(db, d1.user.id)).availability).toBe("online");
  });

  it("rider cancel after the free window charges the fee and writes a ledger row", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: true });
    await db.update(rides).set({ acceptedAt: new Date(Date.now() - 10 * 60_000) }).where(eq(rides.id, ride.id));

    const dto = await cancelRide({ actor: rider, rideId: ride.id, reason: "late" });
    expect(dto.cancellationFeeAgorot).toBe(Math.min(1500, ride.quotedTotalAgorot)); // seeded demo tariff fee
    expect(dto.paymentStatus).toBe("paid");
    expect(dto.cancelledBy).toBe("rider");
    const ledger = await db.select().from(ledgerEntries).where(eq(ledgerEntries.rideId, ride.id));
    expect(ledger.map((l) => [l.type, l.amountAgorot, l.userId])).toEqual([["cancellation_fee", dto.cancellationFeeAgorot, rider.id]]);
    expect((await profileRow(db, d1.user.id)).availability).toBe("online");
  });

  it("rider cancel while still searching is free", async () => {
    const rider = await makeUser(db, "rider");
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    const dto = await cancelRide({ actor: rider, rideId: ride.id });
    expect(dto).toMatchObject({ status: "cancelled", cancellationFeeAgorot: 0, paymentStatus: "not_applicable" });
    expect(await db.select().from(ledgerEntries).where(eq(ledgerEntries.rideId, ride.id))).toHaveLength(0);
  });

  it("rider cannot cancel a ride in progress, a finished ride, or another rider's ride", async () => {
    const rider = await makeUser(db, "rider");
    const other = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await expect(cancelRide({ actor: other, rideId: ride.id })).rejects.toMatchObject({ status: 403 });
    await acceptAndStart(d1.user, ride.id);
    await expect(cancelRide({ actor: rider, rideId: ride.id })).rejects.toMatchObject({ status: 409, code: "cannot_cancel" });
    await completeRide({ driver: d1.user, rideId: ride.id });
    await expect(cancelRide({ actor: rider, rideId: ride.id })).rejects.toMatchObject({ status: 409, code: "invalid_transition" });
  });
});

describe("dispatch driver progress", () => {
  it("only the assigned driver can advance the ride; arrived may skip arriving", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const other = await makeDriver(db, { lat: 32.11, lng: 34.84, online: false });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await expect(startRide({ driver: d1.user, rideId: ride.id })).rejects.toMatchObject({ status: 403 }); // not accepted yet
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: true });
    await expect(driverArriving({ driver: other.user, rideId: ride.id })).rejects.toMatchObject({ status: 403 });
    await expect(completeRide({ driver: d1.user, rideId: ride.id })).rejects.toMatchObject({ code: "invalid_transition" });
    const arrived = await driverArrived({ driver: d1.user, rideId: ride.id });
    expect(arrived.status).toBe("driver_arriving");
    expect(arrived.arrivingAt).not.toBeNull();
    expect(arrived.arrivedAt).not.toBeNull();
    await startRide({ driver: d1.user, rideId: ride.id });
    await expect(driverArrived({ driver: d1.user, rideId: ride.id })).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("a driver busy on one ride cannot accept another (driver_busy)", async () => {
    const r1 = await makeUser(db, "rider");
    const r2 = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride: first } = await bookRide(r1, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d1.user, rideId: first.id, accept: true });
    const { ride: second } = await bookRide(r2, TLV.dizengoff, TLV.rabin);
    expect(second.status).toBe("searching"); // the busy driver is not offered it

    // Force an offer to the busy driver (e.g. a stale offer from a race).
    const offerExpiresAt = new Date(Date.now() + 60_000);
    await db.update(rides).set({ status: "offered", offeredDriverId: d1.user.id, offerExpiresAt }).where(eq(rides.id, second.id));
    await db.insert(rideOffers).values({ rideId: second.id, driverId: d1.user.id, attempt: 1, driverDistanceM: 10, driverEtaS: 60, driverPayoutAgorot: 100, expiresAt: offerExpiresAt });
    await expect(respondToOffer({ driver: d1.user, rideId: second.id, accept: true })).rejects.toMatchObject({ status: 409, code: "driver_busy" });

    // Even if the availability flag drifted back to online, the active ride blocks it.
    await db.update(driverProfiles).set({ availability: "online" }).where(eq(driverProfiles.userId, d1.user.id));
    await expect(respondToOffer({ driver: d1.user, rideId: second.id, accept: true })).rejects.toMatchObject({ status: 409, code: "driver_busy" });
    expect((await rideRow(db, second.id)).driverId).toBeNull();
  });

  it("records track points only while in progress and completes with the tracked distance", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: true });
    await updateDriverLocation({ driver: d1.user, lat: NEAR.lat, lng: NEAR.lng, heading: 180 });
    await driverArriving({ driver: d1.user, rideId: ride.id });
    await updateDriverLocation({ driver: d1.user, lat: TLV.dizengoff.lat, lng: TLV.dizengoff.lng });
    await driverArrived({ driver: d1.user, rideId: ride.id });
    expect(await db.select().from(rideTrackPoints).where(eq(rideTrackPoints.rideId, ride.id))).toHaveLength(0);

    await startRide({ driver: d1.user, rideId: ride.id });
    // A long detour north (~5 km) before reaching Rabin Square.
    const path = [TLV.dizengoff, { lat: 32.12, lng: 34.8 }, TLV.rabin];
    for (const p of path) await updateDriverLocation({ driver: d1.user, lat: p.lat, lng: p.lng, speedMps: 12 });
    const points = await db.select().from(rideTrackPoints).where(eq(rideTrackPoints.rideId, ride.id));
    expect(points).toHaveLength(3);
    expect(points[0].speedMps).toBe(12);

    const done = await completeRide({ driver: d1.user, rideId: ride.id });
    const expected = haversineM(path[0], path[1]) + haversineM(path[1], path[2]);
    expect(Math.abs(done.actualDistanceM! - expected)).toBeLessThanOrEqual(1);
    // Upfront pricing: the rider still pays the quote; the deviation is flagged for review.
    expect(done.finalTotalAgorot).toBe(ride.quotedTotalAgorot);
    const row = await rideRow(db, ride.id);
    expect(row.flags.map((f) => f.code)).toContain("distance_deviation");
    expect(row.paymentStatus).toBe("paid");
    // Location pings after completion are not tracked.
    await updateDriverLocation({ driver: d1.user, lat: 32.09, lng: 34.79 });
    expect(await db.select().from(rideTrackPoints).where(eq(rideTrackPoints.rideId, ride.id))).toHaveLength(3);
    expect((await profileRow(db, d1.user.id))).toMatchObject({ lastLat: 32.09, lastLng: 34.79, availability: "online" });
  });

  it("falls back to the estimated distance with fewer than two track points", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await acceptAndStart(d1.user, ride.id);
    await updateDriverLocation({ driver: d1.user, lat: TLV.rabin.lat, lng: TLV.rabin.lng });
    const done = await completeRide({ driver: d1.user, rideId: ride.id });
    expect(done.actualDistanceM).toBe(ride.estimatedDistanceM);
    expect(done.actualDurationS).toBeGreaterThanOrEqual(0);
  });
});

describe("dispatch ratings", () => {
  it("validates stars, completion and participation; driver→rider rating leaves the driver profile alone", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const outsider = await makeUser(db, "rider");
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);

    for (const stars of [0, 6, 2.5, -1, Number.NaN]) {
      await expect(rateRide({ actor: rider, rideId: ride.id, stars }), String(stars)).rejects.toMatchObject({ status: 400, code: "invalid_rating" });
    }
    await expect(rateRide({ actor: rider, rideId: ride.id, stars: 5 })).rejects.toMatchObject({ status: 409, code: "not_completed" });

    await driveToCompletion(d1.user, ride.id);
    await expect(rateRide({ actor: outsider, rideId: ride.id, stars: 5 })).rejects.toMatchObject({ status: 403 });

    const before = await profileRow(db, d1.user.id);
    const byDriver = await rateRide({ actor: d1.user, rideId: ride.id, stars: 2, comment: "late to the curb" });
    expect(byDriver.driverRating).toBe(2);
    expect(byDriver.riderRating).toBeNull();
    const after = await profileRow(db, d1.user.id);
    expect([after.ratingSum, after.ratingCount]).toEqual([before.ratingSum, before.ratingCount]);
    await expect(rateRide({ actor: d1.user, rideId: ride.id, stars: 3 })).rejects.toMatchObject({ code: "already_rated" });

    await rateRide({ actor: rider, rideId: ride.id, stars: 4 });
    const rated = await profileRow(db, d1.user.id);
    expect([rated.ratingSum, rated.ratingCount]).toEqual([before.ratingSum + 4, before.ratingCount + 1]);
    const rows = await db.select().from(ratings).where(eq(ratings.rideId, ride.id));
    expect(rows.map((r) => [r.fromUserId, r.toUserId, r.stars]).sort()).toEqual(
      [
        [d1.user.id, rider.id, 2],
        [rider.id, d1.user.id, 4],
      ].sort(),
    );
  });
});

describe("dispatch driver presence", () => {
  it("going online requires approval and a location", async () => {
    const d = await makeDriver(db, { online: false });
    await db.update(driverProfiles).set({ lastLat: null, lastLng: null }).where(eq(driverProfiles.userId, d.user.id));
    await expect(setDriverAvailability({ driver: d.user, online: true })).rejects.toMatchObject({ status: 400, code: "location_required" });
    const p = await setDriverAvailability({ driver: d.user, online: true, location: { lat: 32.08, lng: 34.78 } });
    expect(p).toMatchObject({ availability: "online", lastLat: 32.08, lastLng: 34.78 });
    expect(p.lastLocationAt!.getTime()).toBeGreaterThan(Date.now() - 5000);
    // Going online again without a location reuses the last known one.
    const off = await setDriverAvailability({ driver: d.user, online: false });
    expect(off.availability).toBe("offline");
    expect((await setDriverAvailability({ driver: d.user, online: true })).availability).toBe("online");

    for (const status of ["under_review", "rejected", "suspended", "documents_required"] as const) {
      const u = await makeDriver(db, { online: false, verificationStatus: status });
      await expect(setDriverAvailability({ driver: u.user, online: true, location: NEAR }), status).rejects.toMatchObject({ status: 403 });
    }
  });

  it("a busy driver cannot go offline, and going online keeps them busy", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: true });
    await expect(setDriverAvailability({ driver: d1.user, online: false })).rejects.toMatchObject({ status: 409, code: "driver_busy" });
    expect((await setDriverAvailability({ driver: d1.user, online: true, location: NEAR })).availability).toBe("busy");
  });

  it("offline drivers get no offers", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    await setDriverAvailability({ driver: d1.user, online: false });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    expect(ride.status).toBe("searching");
  });
});

describe("dispatch queries", () => {
  it("getActiveRideFor serves the rider, the offered driver and the assigned driver", async () => {
    const rider = await makeUser(db, "rider");
    const admin = await makeUser(db, "admin");
    const d1 = await makeDriver(db, NEAR);
    const d2 = await makeDriver(db, { lat: 32.11, lng: 34.84, online: false });
    expect(await getActiveRideFor(rider)).toBeNull();
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);

    expect((await getActiveRideFor(rider))?.id).toBe(ride.id);
    const offer = await getActiveRideFor(d1.user);
    expect(offer?.status).toBe("offered");
    expect(offer?.offer?.driverPayoutAgorot).toBe(ride.quotedFare.driverPayoutAgorot);
    expect(offer?.rider?.name).toBe(rider.name);
    expect(await getActiveRideFor(d2.user)).toBeNull();
    expect(await getActiveRideFor(admin)).toBeNull();

    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: true });
    const forDriver = await getActiveRideFor(d1.user);
    expect(forDriver?.status).toBe("accepted");
    expect(forDriver?.offer).toBeNull();
    expect(forDriver?.flags).toEqual([]);

    await acceptAndStartFromAccepted(d1.user, ride.id);
    await completeRide({ driver: d1.user, rideId: ride.id });
    expect(await getActiveRideFor(rider)).toBeNull();
    expect(await getActiveRideFor(d1.user)).toBeNull();
  });

  it("getRideDTO enforces who may view a ride", async () => {
    const rider = await makeUser(db, "rider");
    const support = await makeUser(db, "support");
    const d1 = await makeDriver(db, NEAR);
    const stranger = await makeDriver(db, { lat: 32.11, lng: 34.84, online: false });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    expect((await getRideDTO(ride.id, d1.user)).offer).not.toBeNull(); // offered driver
    await expect(getRideDTO(ride.id, stranger.user)).rejects.toMatchObject({ status: 403 });
    await expect(getRideDTO(ride.id, await makeUser(db, "rider"))).rejects.toMatchObject({ status: 403 });
    const staffView = await getRideDTO(ride.id, support);
    expect(staffView.rider?.phoneMasked).toBe(rider.phone);
    await expect(getRideDTO("missing", support)).rejects.toMatchObject({ status: 404 });
    // After declining, the driver loses access.
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: false });
    await expect(getRideDTO(ride.id, d1.user)).rejects.toMatchObject({ status: 403 });
  });

  it("listRidesFor returns newest first, scoped to the viewer's role", async () => {
    const rider = await makeUser(db, "rider");
    const other = await makeUser(db, "rider");
    const d1 = await makeDriver(db, NEAR);
    const { ride: first } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await driveToCompletion(d1.user, first.id);
    const { ride: second } = await bookRide(rider, TLV.dizengoff, TLV.airport);
    await cancelRide({ actor: rider, rideId: second.id });
    const { ride: third } = await bookRide(rider, TLV.rabin, TLV.dizengoff, { serviceTypeId: "premium" });
    await cancelRide({ actor: rider, rideId: third.id });

    expect((await listRidesFor(rider)).map((r) => r.id)).toEqual([third.id, second.id, first.id]);
    expect((await listRidesFor(rider, { limit: 1, offset: 1 })).map((r) => r.id)).toEqual([second.id]);
    // The second ride was offered to d1 and cancelled before acceptance → not theirs.
    expect((await listRidesFor(d1.user)).map((r) => r.id)).toEqual([first.id]);
    expect(await listRidesFor(other)).toEqual([]);
    // The rider's own history never includes themselves as counterpart.
    expect((await listRidesFor(rider))[2].rider).toBeNull();
    expect((await listRidesFor(rider))[2].driver?.id).toBe(d1.user.id);
  });
});

async function acceptAndStartFromAccepted(driver: Parameters<typeof startRide>[0]["driver"], rideId: string) {
  await driverArriving({ driver, rideId });
  await driverArrived({ driver, rideId });
  await startRide({ driver, rideId });
}
