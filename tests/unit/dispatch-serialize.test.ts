import { describe, expect, it } from "vitest";
import { maskPhone, ratingOf, serializeCounterpart, serializeRide, type Viewer } from "@/server/dispatch/serialize";
import { driverProfile, offer, ride, serviceType, user } from "../helpers/fixtures";

const rider = user({ id: "rider-1", role: "rider", name: "נועה", phone: "052-222-0001" });
const driver = user({ id: "driver-1", role: "driver", name: "דני", phone: "050-111-0001" });
const profile = driverProfile({ userId: "driver-1", ratingSum: 47, ratingCount: 10, lastLat: 32.07, lastLng: 34.78, lastHeading: 45 });
const flags = [{ code: "distance_deviation", message: "x", severity: "warning" as const, at: "2026-01-01T00:00:00.000Z" }];

const asRider: Viewer = { id: "rider-1", role: "rider" };
const asDriver: Viewer = { id: "driver-1", role: "driver" };
const asOtherDriver: Viewer = { id: "driver-2", role: "driver" };
const asAdmin: Viewer = { id: "admin-1", role: "admin" };
const asSupport: Viewer = { id: "support-1", role: "support" };

const accepted = ride({ status: "accepted", riderId: "rider-1", driverId: "driver-1", flags, adminNotes: "refund pending" });
const acceptedCtx = { serviceType: serviceType(), rider, driver, driverProfile: profile };

describe("dispatch/serialize maskPhone", () => {
  it("keeps only the last four digits", () => {
    expect(maskPhone("050-111-0001")).toBe("•••-0001");
    expect(maskPhone("+972 50 123 4567")).toBe("•••-4567");
  });
  it("handles missing and short numbers", () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
    expect(maskPhone("")).toBeNull();
    expect(maskPhone("12")).toBe("•••");
  });
});

describe("dispatch/serialize ratingOf", () => {
  it("averages to one decimal place", () => {
    expect(ratingOf({ ratingSum: 47, ratingCount: 10 })).toBe(4.7);
    expect(ratingOf({ ratingSum: 14, ratingCount: 3 })).toBe(4.7); // 4.666…
    expect(ratingOf({ ratingSum: 5, ratingCount: 1 })).toBe(5);
  });
  it("is null with no ratings or no profile", () => {
    expect(ratingOf({ ratingSum: 0, ratingCount: 0 })).toBeNull();
    expect(ratingOf(null)).toBeNull();
    expect(ratingOf(undefined)).toBeNull();
  });
});

describe("dispatch/serialize serializeCounterpart", () => {
  it("masks the phone for riders and drivers", () => {
    expect(serializeCounterpart(driver, profile, asRider)?.phoneMasked).toBe("•••-0001");
    expect(serializeCounterpart(rider, null, asDriver)?.phoneMasked).toBe("•••-0001");
  });

  it("shows the full phone to staff", () => {
    expect(serializeCounterpart(driver, profile, asAdmin)?.phoneMasked).toBe("050-111-0001");
    expect(serializeCounterpart(driver, profile, asSupport)?.phoneMasked).toBe("050-111-0001");
  });

  it("includes vehicle and rating only when a profile is given", () => {
    const d = serializeCounterpart(driver, profile, asRider)!;
    expect(d.vehicle).toEqual({ make: "Toyota", model: "Corolla", color: "white", plate: "12-345-67", class: "standard" });
    expect(d.rating).toBe(4.7);
    expect(d.ratingCount).toBe(10);
    const r = serializeCounterpart(rider, null, asDriver)!;
    expect(r.vehicle).toBeUndefined();
    expect(r.rating).toBeNull();
    expect(r.ratingCount).toBe(0);
  });

  it("includes the location only when asked and known", () => {
    expect(serializeCounterpart(driver, profile, asRider)?.location).toBeUndefined();
    expect(serializeCounterpart(driver, profile, asRider, { includeLocation: true })?.location).toMatchObject({ lat: 32.07, lng: 34.78, heading: 45 });
    const unknown = driverProfile({ userId: "driver-1", lastLat: null, lastLng: null });
    expect(serializeCounterpart(driver, unknown, asRider, { includeLocation: true })?.location).toBeUndefined();
  });

  it("returns null without a user", () => {
    expect(serializeCounterpart(null, profile, asRider)).toBeNull();
    expect(serializeCounterpart(undefined, null, asRider)).toBeNull();
  });
});

describe("dispatch/serialize serializeRide", () => {
  it("hides flags and admin notes from non-staff", () => {
    for (const v of [asRider, asDriver]) {
      const dto = serializeRide(accepted, acceptedCtx, v);
      expect(dto.flags).toEqual([]);
      expect(dto.adminNotes).toBeUndefined();
    }
    for (const v of [asAdmin, asSupport]) {
      const dto = serializeRide(accepted, acceptedCtx, v);
      expect(dto.flags).toEqual(flags);
      expect(dto.adminNotes).toBe("refund pending");
    }
  });

  it("gives the rider the driver (with live location) but not themselves", () => {
    const dto = serializeRide(accepted, acceptedCtx, asRider);
    expect(dto.rider).toBeNull();
    expect(dto.driver?.id).toBe("driver-1");
    expect(dto.driver?.phoneMasked).toBe("•••-0001");
    expect(dto.driver?.location).toMatchObject({ lat: 32.07, lng: 34.78 });
  });

  it("gives the driver the rider but not themselves", () => {
    const dto = serializeRide(accepted, acceptedCtx, asDriver);
    expect(dto.driver).toBeNull();
    expect(dto.rider?.id).toBe("rider-1");
    expect(dto.rider?.phoneMasked).toBe("•••-0001");
  });

  it("gives staff both parties, unmasked, with the driver location", () => {
    const dto = serializeRide(accepted, acceptedCtx, asAdmin);
    expect(dto.rider?.phoneMasked).toBe("052-222-0001");
    expect(dto.driver?.phoneMasked).toBe("050-111-0001");
    expect(dto.driver?.location).toBeDefined();
  });

  it("withholds the driver location from a third-party driver", () => {
    const dto = serializeRide(accepted, acceptedCtx, asOtherDriver);
    expect(dto.driver?.location).toBeUndefined();
  });

  it("includes the offer only for the offered driver and staff", () => {
    const offered = ride({ status: "offered", riderId: "rider-1", offeredDriverId: "driver-1", offerAttempts: 1 });
    const o = offer({ rideId: offered.id, driverId: "driver-1", driverDistanceM: 650, driverEtaS: 150, driverPayoutAgorot: 2100 });
    const ctx = { serviceType: serviceType(), rider, driver, driverProfile: profile, offer: o };
    const forDriver = serializeRide(offered, ctx, asDriver);
    expect(forDriver.offer).toEqual({ id: o.id, driverDistanceM: 650, driverEtaS: 150, driverPayoutAgorot: 2100, expiresAt: o.expiresAt.toISOString() });
    // The offered driver sees the rider, not themselves.
    expect(forDriver.driver).toBeNull();
    expect(forDriver.rider?.name).toBe("נועה");
    expect(serializeRide(offered, ctx, asAdmin).offer?.id).toBe(o.id);
    expect(serializeRide(offered, ctx, asRider).offer).toBeNull();
    expect(serializeRide(offered, ctx, asOtherDriver).offer).toBeNull();
    expect(serializeRide(offered, { ...ctx, offer: null }, asDriver).offer).toBeNull();
  });

  it("serializes timestamps as ISO strings and nulls", () => {
    const at = new Date("2026-03-01T08:00:00.000Z");
    const dto = serializeRide(ride({ requestedAt: at, acceptedAt: at, completedAt: null }), { serviceType: serviceType() }, asAdmin);
    expect(dto.requestedAt).toBe("2026-03-01T08:00:00.000Z");
    expect(dto.acceptedAt).toBe("2026-03-01T08:00:00.000Z");
    expect(dto.completedAt).toBeNull();
    expect(dto.offerExpiresAt).toBeNull();
    expect(dto.serviceType).toMatchObject({ id: "taxi", enabled: true, legalStatus: "approved" });
    expect(dto.rider).toBeNull();
    expect(dto.driver).toBeNull();
  });
});
