import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { driverProfiles, ledgerEntries, rideTrackPoints, type RideStatus } from "@/server/db/schema";
import { simulateDemoDrivers } from "@/server/demo/simulator";
import { setSetting } from "@/server/settings";
import { freshDb, makeDriver, makeUser, profileRow, resetDispatch, rideRow, TLV } from "../helpers/db";
import { bookRide } from "../helpers/rides";

let db: Db;

/**
 * The simulator waits ~4 s of wall-clock time at the pickup. Rather than
 * sleeping (or faking timers under PGlite), rewind its per-ride phase clock.
 */
function fastForwardSimulator(ms: number) {
  const state = (globalThis as { __hopSim?: Map<string, { phaseStart: number; progress: number }> }).__hopSim;
  for (const s of state?.values() ?? []) s.phaseStart -= ms;
}

const NEAR_PICKUP = { lat: 32.0775, lng: 34.7765 }; // ~290 m from Dizengoff Center

beforeAll(async () => {
  db = await freshDb();
  await setSetting("demo.autopilotAcceptDelaySec", 0, null);
});
afterAll(async () => {
  await closeDb();
});
beforeEach(async () => {
  await resetDispatch(db);
  await setSetting("demo.autopilot", true, null);
});

describe("demo/simulator", () => {
  it("does nothing while autopilot is off", async () => {
    await setSetting("demo.autopilot", false, null);
    const rider = await makeUser(db, "rider");
    const demo = await makeDriver(db, { ...NEAR_PICKUP, isDemo: true });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    expect((await rideRow(db, ride.id)).offeredDriverId).toBe(demo.user.id);
    for (let i = 0; i < 5; i++) await simulateDemoDrivers();
    expect((await rideRow(db, ride.id)).status).toBe("offered");
    expect((await profileRow(db, demo.user.id)).lastLat).toBe(NEAR_PICKUP.lat);
  });

  it("never drives real (non-demo) drivers", async () => {
    const rider = await makeUser(db, "rider");
    const real = await makeDriver(db, NEAR_PICKUP);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    expect((await rideRow(db, ride.id)).offeredDriverId).toBe(real.user.id);
    for (let i = 0; i < 5; i++) await simulateDemoDrivers();
    expect((await rideRow(db, ride.id)).status).toBe("offered");
  });

  it("accepts, drives to the pickup, carries the rider and completes the ride", async () => {
    const rider = await makeUser(db, "rider");
    const demo = await makeDriver(db, { ...NEAR_PICKUP, isDemo: true });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    expect(ride.status).toBe("offered");

    const seen: RideStatus[] = [];
    let arrived = false;
    for (let tick = 0; tick < 200; tick++) {
      await simulateDemoDrivers();
      fastForwardSimulator(5_000);
      const row = await rideRow(db, ride.id);
      if (seen[seen.length - 1] !== row.status) seen.push(row.status);
      arrived ||= row.arrivedAt != null;
      if (row.status === "completed") break;
    }

    expect(seen[seen.length - 1]).toBe("completed");
    expect(seen).toContain("driver_arriving");
    expect(seen).toContain("in_progress");
    expect(arrived).toBe(true);
    const done = await rideRow(db, ride.id);
    expect(done.driverId).toBe(demo.user.id);
    expect(done.acceptedAt).not.toBeNull();
    expect(done.startedAt).not.toBeNull();
    expect(done.finalTotalAgorot).toBe(ride.quotedTotalAgorot);
    const track = await db.select().from(rideTrackPoints).where(eq(rideTrackPoints.rideId, ride.id));
    expect(track.length).toBeGreaterThan(5);
    const ledger = await db.select().from(ledgerEntries).where(eq(ledgerEntries.rideId, ride.id));
    expect(ledger.map((l) => l.type).sort()).toEqual(["driver_payout", "hop_commission", "rider_charge"]);
    // The demo driver ends at the dropoff and is available again.
    const p = await profileRow(db, demo.user.id);
    expect(p.availability).toBe("online");
    expect(p.lastLat).toBeCloseTo(TLV.rabin.lat, 3);
    expect(p.lastLng).toBeCloseTo(TLV.rabin.lng, 3);
  });

  it("respects the accept delay", async () => {
    await setSetting("demo.autopilotAcceptDelaySec", 3600, null);
    try {
      const rider = await makeUser(db, "rider");
      await makeDriver(db, { ...NEAR_PICKUP, isDemo: true });
      const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
      await simulateDemoDrivers();
      await simulateDemoDrivers();
      expect((await rideRow(db, ride.id)).status).toBe("offered");
    } finally {
      await setSetting("demo.autopilotAcceptDelaySec", 0, null);
    }
  });

  it("keeps online demo drivers' locations fresh so they stay matchable", async () => {
    const demo = await makeDriver(db, { ...NEAR_PICKUP, isDemo: true, lastLocationAt: new Date(Date.now() - 10 * 60_000) });
    const offline = await makeDriver(db, { ...NEAR_PICKUP, isDemo: true, online: false, lastLocationAt: new Date(Date.now() - 10 * 60_000) });
    await simulateDemoDrivers();
    expect((await profileRow(db, demo.user.id)).lastLocationAt!.getTime()).toBeGreaterThan(Date.now() - 5_000);
    expect((await profileRow(db, offline.user.id)).lastLocationAt!.getTime()).toBeLessThan(Date.now() - 9 * 60_000);
    await db.update(driverProfiles).set({ availability: "offline" }).where(eq(driverProfiles.userId, demo.user.id));
  });
});
