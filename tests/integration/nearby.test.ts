import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, type Db } from "@/server/db/client";
import { nearbyCars } from "@/server/dispatch/service";
import { freshDb, makeDriver, makeUser, resetDispatch, TLV } from "../helpers/db";
import { bookRide } from "../helpers/rides";

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

describe("nearbyCars (rider map)", () => {
  it("lists available cars nearest first without identifying the drivers", async () => {
    const near = await makeDriver(db, { lat: 32.0757, lng: 34.7756 });
    const farther = await makeDriver(db, { lat: 32.0785, lng: 34.7785 });
    const cars = await nearbyCars(TLV.dizengoff);
    expect(cars).toHaveLength(2);
    const ids = new Set([near.user.id, farther.user.id]);
    for (const car of cars) {
      expect(ids.has(car.id)).toBe(false);
      expect(Object.keys(car).sort()).toEqual(["heading", "id", "lat", "lng", "vehicleClass"]);
      // ~10 m precision only
      expect(Math.round(car.lat * 1e4)).toBeCloseTo(car.lat * 1e4, 6);
    }
    expect(cars[0].lat).toBeCloseTo(32.0757, 3);
    // The token is stable within the day, so cars can glide between polls.
    expect((await nearbyCars(TLV.dizengoff)).map((c) => c.id)).toEqual(cars.map((c) => c.id));
  });

  it("excludes offline, unapproved, stale, busy and out-of-radius drivers", async () => {
    await makeDriver(db, { lat: 32.0757, lng: 34.7756, online: false });
    await makeDriver(db, { lat: 32.0757, lng: 34.7756, approved: false });
    await makeDriver(db, { lat: 32.0757, lng: 34.7756, lastLocationAt: new Date(Date.now() - 24 * 3600_000) });
    await makeDriver(db, { ...TLV.airport });
    const offered = await makeDriver(db, { lat: 32.0757, lng: 34.7756 });
    const rider = await makeUser(db, "rider");
    await bookRide(rider, TLV.dizengoff, TLV.rabin); // the only available driver now holds the offer
    expect(offered.user.id).toBeTruthy();
    expect(await nearbyCars(TLV.dizengoff)).toEqual([]);
  });
});
