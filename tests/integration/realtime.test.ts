import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { rides } from "@/server/db/schema";
import { cancelRide, completeRide, expireOffer, respondToOffer, setDriverAvailability, updateDriverLocation } from "@/server/dispatch/service";
import { channels, subscribe, type RealtimeEvent } from "@/server/realtime/bus";
import { freshDb, makeDriver, makeUser, resetDispatch, TLV } from "../helpers/db";
import { acceptAndStart, bookRide } from "../helpers/rides";

let db: Db;

beforeAll(async () => {
  db = await freshDb();
});
afterAll(async () => {
  await closeDb();
});
beforeEach(async () => {
  await resetDispatch(db);
});

function record(chs: string[]) {
  const events: (RealtimeEvent & { channel: string })[] = [];
  const offs = chs.map((channel) => subscribe([channel], (e) => events.push({ ...e, channel })));
  return {
    events,
    off: () => offs.forEach((o) => o()),
    of: (channel: string, type: RealtimeEvent["type"]) => events.filter((e) => e.channel === channel && e.type === type),
  };
}
const statusesOf = (es: RealtimeEvent[]) => es.map((e) => (e.data as { status: string }).status);

describe("realtime events from the ride lifecycle", () => {
  it("publishes ride.offer to the offered driver and ride.updated to rider, driver, ride and admin channels", async () => {
    const rider = await makeUser(db, "rider");
    const driver = await makeDriver(db, { lat: 32.0757, lng: 34.7756 });
    const rec = record([channels.user(rider.id), channels.user(driver.user.id), channels.admin]);

    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    const rideFeed = record([channels.ride(ride.id)]);
    await acceptAndStart(driver.user, ride.id);
    await updateDriverLocation({ driver: driver.user, lat: 32.078, lng: 34.778, heading: 45 });
    await completeRide({ driver: driver.user, rideId: ride.id });
    rec.off();
    rideFeed.off();

    const offers = rec.of(channels.user(driver.user.id), "ride.offer");
    expect(offers).toHaveLength(1);
    expect(offers[0].data).toMatchObject({ rideId: ride.id });
    expect(new Date((offers[0].data as { expiresAt: string }).expiresAt).getTime()).toBeGreaterThan(Date.now());
    // Nothing about the offer leaks to the rider channel.
    expect(rec.of(channels.user(rider.id), "ride.offer")).toHaveLength(0);

    const riderStatuses = statusesOf(rec.of(channels.user(rider.id), "ride.updated"));
    expect(riderStatuses).toEqual(["searching", "offered", "accepted", "driver_arriving", "driver_arriving", "in_progress", "completed"]);
    const driverStatuses = statusesOf(rec.of(channels.user(driver.user.id), "ride.updated"));
    expect(driverStatuses).toEqual(["offered", "accepted", "driver_arriving", "driver_arriving", "in_progress", "completed"]);
    expect(statusesOf(rec.of(channels.admin, "admin.ride"))).toEqual(riderStatuses);
    expect(statusesOf(rideFeed.of(channels.ride(ride.id), "ride.updated"))).toEqual(riderStatuses.slice(2));

    // Versions only ever increase.
    const versions = rec.of(channels.user(rider.id), "ride.updated").map((e) => (e.data as { version: number }).version);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
    expect(new Set(versions).size).toBe(versions.length);
    // Event ids are unique.
    expect(new Set(rec.events.map((e) => e.id)).size).toBe(rec.events.length);

    // Live location reaches the rider and the ride channel while the ride is active.
    expect(rec.of(channels.user(rider.id), "driver.location")[0].data).toMatchObject({ rideId: ride.id, lat: 32.078, lng: 34.778, heading: 45 });
    expect(rideFeed.of(channels.ride(ride.id), "driver.location")).toHaveLength(1);
    expect(rec.of(channels.admin, "driver.location")).toHaveLength(1);
  });

  it("publishes ride.offer.cancelled when an offer expires or the ride is cancelled", async () => {
    const r1 = await makeUser(db, "rider");
    const r2 = await makeUser(db, "rider");
    const d1 = await makeDriver(db, { lat: 32.0757, lng: 34.7756 });
    const rec = record([channels.user(d1.user.id)]);

    const { ride: first } = await bookRide(r1, TLV.dizengoff, TLV.rabin);
    await db.update(rides).set({ offerExpiresAt: new Date(Date.now() - 1000) }).where(eq(rides.id, first.id));
    await expireOffer(first.id);
    await cancelRide({ actor: r1, rideId: first.id });

    const { ride: second } = await bookRide(r2, TLV.dizengoff, TLV.rabin);
    await cancelRide({ actor: r2, rideId: second.id });
    rec.off();

    expect(rec.of(channels.user(d1.user.id), "ride.offer.cancelled").map((e) => e.data)).toEqual([
      { rideId: first.id, reason: "expired" },
      { rideId: second.id, reason: "cancelled_by_rider" },
    ]);
  });

  it("does not publish location to the rider when the driver has no active ride", async () => {
    const rider = await makeUser(db, "rider");
    const d1 = await makeDriver(db, { lat: 32.0757, lng: 34.7756 });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver: d1.user, rideId: ride.id, accept: false }); // declined
    const rec = record([channels.user(rider.id), channels.user(d1.user.id)]);
    await updateDriverLocation({ driver: d1.user, lat: 32.08, lng: 34.78 });
    await setDriverAvailability({ driver: d1.user, online: false });
    rec.off();
    expect(rec.of(channels.user(rider.id), "driver.location")).toHaveLength(0);
    expect(rec.of(channels.user(d1.user.id), "driver.availability").map((e) => e.data)).toEqual([{ availability: "offline" }]);
  });
});
