import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { closeDb, type Db } from "@/server/db/client";
import { ledgerEntries, rides } from "@/server/db/schema";
import { driverArrived, driverArriving, getRideDTO, respondToOffer, startRide } from "@/server/dispatch/service";
import { earnings } from "@/server/driver/service";
import { demandCells } from "@/server/driver/demand";
import { deletePlace, listPlaces, MAX_FAVOURITES, savePlace } from "@/server/places/service";
import { addTip, createShare, getSharedRide, listMessages, revokeShares, sendMessage } from "@/server/rides/extras";
import { setSetting } from "@/server/settings";
import { freshDb, makeDriver, makeUser, resetDispatch, TLV } from "../helpers/db";
import { bookRide, driveToCompletion } from "../helpers/rides";

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
afterEach(async () => {
  await setSetting("dispatch.requirePickupPin", false, null);
});

const NEAR = { lat: 32.0757, lng: 34.7756 };

async function completedRide() {
  const rider = await makeUser(db, "rider");
  const { user: driver } = await makeDriver(db, NEAR);
  const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
  await driveToCompletion(driver, ride.id);
  return { rider, driver, rideId: ride.id };
}

describe("tips", () => {
  it("adds a tip once, records it in the ledger and pays the driver in full", async () => {
    const { rider, driver, rideId } = await completedRide();
    const res = await addTip({ rider, rideId, amountAgorot: 1500 });
    expect(res.tipAgorot).toBe(1500);
    const rows = await db.select().from(ledgerEntries).where(eq(ledgerEntries.rideId, rideId));
    expect(rows.find((r) => r.type === "tip_charge")).toMatchObject({ userId: rider.id, amountAgorot: 1500 });
    expect(rows.find((r) => r.type === "tip_payout")).toMatchObject({ userId: driver.id, amountAgorot: 1500 });
    await expect(addTip({ rider, rideId, amountAgorot: 500 })).rejects.toMatchObject({ code: "tip_exists" });
    const e = await earnings(driver.id, { from: new Date(Date.now() - 3600_000), to: new Date(Date.now() + 60_000) });
    expect(e.tipsAgorot).toBe(1500);
    expect((await getRideDTO(rideId, rider)).tipAgorot).toBe(1500);
  });

  it("rejects other riders, bad amounts, unfinished and stale rides", async () => {
    const { rider, rideId } = await completedRide();
    const stranger = await makeUser(db, "rider");
    await expect(addTip({ rider: stranger, rideId, amountAgorot: 1000 })).rejects.toMatchObject({ status: 403 });
    await expect(addTip({ rider, rideId, amountAgorot: 50 })).rejects.toMatchObject({ code: "invalid_tip" });
    await expect(addTip({ rider, rideId, amountAgorot: 20_001 })).rejects.toMatchObject({ code: "invalid_tip" });
    await expect(addTip({ rider, rideId, amountAgorot: 10.5 })).rejects.toMatchObject({ code: "invalid_tip" });
    await db.update(rides).set({ completedAt: new Date(Date.now() - 8 * 24 * 3600_000) }).where(eq(rides.id, rideId));
    await expect(addTip({ rider, rideId, amountAgorot: 1000 })).rejects.toMatchObject({ code: "tip_window" });

    const r2 = await makeUser(db, "rider");
    await makeDriver(db, NEAR);
    const { ride } = await bookRide(r2, TLV.dizengoff, TLV.rabin);
    await expect(addTip({ rider: r2, rideId: ride.id, amountAgorot: 1000 })).rejects.toMatchObject({ code: "tip_not_allowed" });
  });
});

describe("pickup PIN", () => {
  it("is shown to the rider only, and enforced when the setting is on", async () => {
    const rider = await makeUser(db, "rider");
    const { user: driver } = await makeDriver(db, NEAR);
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver, rideId: ride.id, accept: true });
    const forRider = await getRideDTO(ride.id, rider);
    const forDriver = await getRideDTO(ride.id, driver);
    expect(forRider.pickupPin).toMatch(/^\d{4}$/);
    expect(forDriver.pickupPin).toBeNull();
    expect(forDriver.pickupPinRequired).toBe(false);

    await setSetting("dispatch.requirePickupPin", true, null);
    expect((await getRideDTO(ride.id, driver)).pickupPinRequired).toBe(true);
    await driverArriving({ driver, rideId: ride.id });
    await driverArrived({ driver, rideId: ride.id });
    const wrong = forRider.pickupPin === "0000" ? "1111" : "0000";
    await expect(startRide({ driver, rideId: ride.id, pin: wrong })).rejects.toMatchObject({ code: "pin_mismatch" });
    await expect(startRide({ driver, rideId: ride.id })).rejects.toMatchObject({ code: "pin_mismatch" });
    const started = await startRide({ driver, rideId: ride.id, pin: forRider.pickupPin! });
    expect(started.status).toBe("in_progress");
    expect((await getRideDTO(ride.id, rider)).pickupPin).toBeNull(); // no longer needed once on board
  });
});

describe("in-ride chat", () => {
  it("lets the rider and the driver talk while the ride is live, and nobody else", async () => {
    const rider = await makeUser(db, "rider", { name: "נועה לוי" });
    const { user: driver } = await makeDriver(db, { ...NEAR, name: "דני כהן" });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await expect(sendMessage({ actor: rider, rideId: ride.id, body: "שלום" })).rejects.toMatchObject({ code: "chat_closed" });
    await respondToOffer({ driver, rideId: ride.id, accept: true });
    await sendMessage({ actor: rider, rideId: ride.id, body: "  אני ליד הכניסה הראשית \u0007 " });
    await sendMessage({ actor: driver, rideId: ride.id, body: "מגיע בעוד 2 דקות" });
    const forRider = await listMessages({ actor: rider, rideId: ride.id });
    expect(forRider.map((m) => [m.senderRole, m.mine, m.body])).toEqual([
      ["rider", true, "אני ליד הכניסה הראשית"],
      ["driver", false, "מגיע בעוד 2 דקות"],
    ]);
    expect(forRider[1].senderName).toBe("דני");

    const stranger = await makeUser(db, "rider");
    await expect(sendMessage({ actor: stranger, rideId: ride.id, body: "hi" })).rejects.toMatchObject({ status: 403 });
    await expect(listMessages({ actor: stranger, rideId: ride.id })).rejects.toMatchObject({ status: 403 });
    const support = await makeUser(db, "support");
    expect(await listMessages({ actor: support, rideId: ride.id })).toHaveLength(2);
    await expect(sendMessage({ actor: rider, rideId: ride.id, body: "   " })).rejects.toMatchObject({ code: "empty_message" });
    await expect(sendMessage({ actor: rider, rideId: ride.id, body: "א".repeat(501) })).rejects.toMatchObject({ code: "message_too_long" });
  });
});

describe("trip sharing", () => {
  it("creates a token link that shows the trip without money or phone numbers, until revoked", async () => {
    const rider = await makeUser(db, "rider", { name: "נועה לוי", phone: "0501234567" });
    const { user: driver } = await makeDriver(db, { ...NEAR, name: "דני כהן" });
    const { ride } = await bookRide(rider, TLV.dizengoff, TLV.rabin);
    await respondToOffer({ driver, rideId: ride.id, accept: true });
    const share = await createShare({ rider, rideId: ride.id });
    expect(share.url).toMatch(/\/t\/[A-Za-z0-9_-]+$/);
    const view = await getSharedRide(share.token);
    expect(view).toMatchObject({ status: "accepted", riderFirstName: "נועה", driverFirstName: "דני" });
    expect(view?.driverLocation).not.toBeNull();
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/Agorot|0501234567|phone|fare/i);

    expect(await getSharedRide("not-a-real-token-xxxxxxxx")).toBeNull();
    const other = await makeUser(db, "rider");
    await expect(createShare({ rider: other, rideId: ride.id })).rejects.toMatchObject({ status: 403 });
    await revokeShares({ rider, rideId: ride.id });
    expect(await getSharedRide(share.token)).toBeNull();
  });
});

describe("saved places", () => {
  it("keeps one home and one work, caps favourites, and is private per user", async () => {
    const u = await makeUser(db, "rider");
    const home1 = await savePlace(u.id, { kind: "home", address: "דיזנגוף 50, תל אביב", lat: 32.0752, lng: 34.7751 });
    const home2 = await savePlace(u.id, { kind: "home", address: "בן יהודה 10, תל אביב", lat: 32.08, lng: 34.77 });
    expect(home2.id).toBe(home1.id);
    expect(home2.label).toBe("בית");
    await savePlace(u.id, { kind: "work", address: "עזריאלי", lat: 32.0745, lng: 34.792 });
    await savePlace(u.id, { kind: "other", label: "ההורים", address: "רמת גן", lat: 32.08, lng: 34.81 });
    const list = await listPlaces(u.id);
    expect(list.map((p) => p.kind)).toEqual(["home", "work", "other"]);
    expect(list[0].address).toBe("בן יהודה 10, תל אביב");

    const other = await makeUser(db, "rider");
    expect(await listPlaces(other.id)).toEqual([]);
    await expect(deletePlace(other.id, list[2].id)).rejects.toMatchObject({ status: 404 });
    await deletePlace(u.id, list[2].id);
    expect(await listPlaces(u.id)).toHaveLength(2);

    for (let i = 0; i < MAX_FAVOURITES; i++) await savePlace(u.id, { kind: "other", address: `מקום ${i}`, lat: 32.07, lng: 34.78 });
    await expect(savePlace(u.id, { kind: "other", address: "עוד אחד", lat: 32.07, lng: 34.78 })).rejects.toMatchObject({ code: "too_many_places" });
  });
});

describe("driver demand cells", () => {
  it("counts real recent requests per cell and hides single requests", async () => {
    const before = (await demandCells()).reduce((n, c) => n + c.requests, 0);
    const a = await makeUser(db, "rider");
    const b = await makeUser(db, "rider");
    await bookRide(a, TLV.dizengoff, TLV.rabin);
    await bookRide(b, { ...TLV.dizengoff, lat: TLV.dizengoff.lat + 0.0003 }, TLV.rabin);
    const cells = await demandCells();
    const total = cells.reduce((n, c) => n + c.requests, 0);
    expect(total).toBeGreaterThanOrEqual(before + 2);
    for (const c of cells) expect(c.requests).toBeGreaterThanOrEqual(2);
    expect(Object.keys(cells[0]).sort()).toEqual(["lat", "lng", "requests"]);
    // old requests do not count
    await db.update(rides).set({ requestedAt: new Date(Date.now() - 2 * 3600_000) }).where(and(eq(rides.riderId, a.id)));
    await db.update(rides).set({ requestedAt: new Date(Date.now() - 2 * 3600_000) }).where(and(eq(rides.riderId, b.id)));
    expect((await demandCells()).reduce((n, c) => n + c.requests, 0)).toBe(before);
  });
});
