import { describe, expect, it } from "vitest";
import { computeRideFlags, rankCandidates } from "@/server/dispatch/service";
import { candidate, ride } from "../helpers/fixtures";

const pickup = { lat: 32.0752, lng: 34.7751 };
const r = ride({ pickupLat: pickup.lat, pickupLng: pickup.lng });
const taxi = { vehicleClasses: ["standard", "xl", "premium", "accessible"] };
const opts = { radiusM: 9000, minAcceptanceRateBp: 0 };
/** Point roughly `m` metres north of the pickup. */
const north = (m: number) => ({ lat: pickup.lat + m / 111_195, lng: pickup.lng });

describe("dispatch/service rankCandidates", () => {
  it("orders by ETA, nearest first, and annotates distance/ETA", () => {
    const far = candidate(north(3000));
    const near = candidate(north(300));
    const mid = candidate(north(1200));
    const ranked = rankCandidates(r, taxi, [far, near, mid], opts);
    expect(ranked.map((c) => c.user.id)).toEqual([near.user.id, mid.user.id, far.user.id]);
    expect(ranked[0].distanceM).toBeGreaterThan(280);
    expect(ranked[0].distanceM).toBeLessThan(320);
    expect(Number.isInteger(ranked[0].distanceM)).toBe(true);
    expect(ranked[0].etaS).toBeLessThan(ranked[1].etaS);
  });

  it("drops drivers outside the search radius (inclusive bound)", () => {
    const inside = candidate(north(1900));
    const outside = candidate(north(2100));
    const ranked = rankCandidates(r, taxi, [inside, outside], { ...opts, radiusM: 2000 });
    expect(ranked.map((c) => c.user.id)).toEqual([inside.user.id]);
    const exact = rankCandidates(r, taxi, [inside], { ...opts, radiusM: ranked[0].distanceM });
    expect(exact).toHaveLength(1);
  });

  it("only keeps vehicle classes the service type accepts", () => {
    const std = candidate(north(200), { profile: { vehicleClass: "standard" } });
    const xl = candidate(north(400), { profile: { vehicleClass: "xl" } });
    const premium = candidate(north(600), { profile: { vehicleClass: "premium" } });
    expect(rankCandidates(r, { vehicleClasses: ["xl"] }, [std, xl, premium], opts).map((c) => c.user.id)).toEqual([xl.user.id]);
    expect(rankCandidates(r, { vehicleClasses: [] }, [std, xl, premium], opts)).toEqual([]);
  });

  it("skips drivers excluded from this ride", () => {
    const a = candidate(north(200));
    const b = candidate(north(500));
    const excluded = ride({ pickupLat: pickup.lat, pickupLng: pickup.lng, excludedDriverIds: [a.user.id] });
    expect(rankCandidates(excluded, taxi, [a, b], opts).map((c) => c.user.id)).toEqual([b.user.id]);
  });

  it("applies the minimum acceptance rate only after 10 offers", () => {
    const newbie = candidate(north(100), { profile: { offersReceived: 9, offersAccepted: 0 } });
    const picky = candidate(north(200), { profile: { offersReceived: 10, offersAccepted: 4 } }); // 40%
    const good = candidate(north(300), { profile: { offersReceived: 10, offersAccepted: 5 } }); // 50%
    const ids = rankCandidates(r, taxi, [newbie, picky, good], { ...opts, minAcceptanceRateBp: 5000 }).map((c) => c.user.id);
    expect(ids).toEqual([newbie.user.id, good.user.id]);
    // Disabled (0) → nobody is filtered.
    expect(rankCandidates(r, taxi, [newbie, picky, good], opts)).toHaveLength(3);
  });

  it("returns an empty list for no candidates", () => {
    expect(rankCandidates(r, taxi, [], opts)).toEqual([]);
  });
});

describe("dispatch/service computeRideFlags", () => {
  // Estimates: 2000 m / 600 s → distance flag above 3500 m, duration flag above 2100 s.
  const base = ride({ estimatedDistanceM: 2000, estimatedDurationS: 600, offerAttempts: 1 });
  const codes = (f: { code: string }[]) => f.map((x) => x.code);

  it("raises nothing for a normal trip", () => {
    expect(computeRideFlags(base, 2100, 700)).toEqual([]);
  });

  it("flags a distance deviation above estimate × 1.5 + 500 m", () => {
    expect(codes(computeRideFlags(base, 3500, 700))).toEqual([]);
    const f = computeRideFlags(base, 3501, 700);
    expect(codes(f)).toEqual(["distance_deviation"]);
    expect(f[0].severity).toBe("warning");
    expect(() => new Date(f[0].at).toISOString()).not.toThrow();
  });

  it("flags a duration deviation above estimate × 2.5 + 600 s", () => {
    expect(codes(computeRideFlags(base, 2100, 2100))).toEqual([]);
    expect(codes(computeRideFlags(base, 2100, 2101))).toEqual(["duration_deviation"]);
  });

  it("flags implausibly short trips (< 30 s for > 1.5 km) as critical", () => {
    const f = computeRideFlags(base, 2000, 29);
    expect(codes(f)).toEqual(["too_short"]);
    expect(f[0].severity).toBe("critical");
    expect(codes(computeRideFlags(base, 2000, 30))).toEqual([]);
    expect(codes(computeRideFlags(ride({ estimatedDistanceM: 1500, estimatedDurationS: 300 }), 1500, 5))).toEqual([]);
  });

  it("flags rides offered to 5+ drivers", () => {
    expect(codes(computeRideFlags({ ...base, offerAttempts: 4 }, 2000, 700))).toEqual([]);
    const f = computeRideFlags({ ...base, offerAttempts: 5 }, 2000, 700);
    expect(codes(f)).toEqual(["many_offers"]);
    expect(f[0].severity).toBe("info");
  });

  it("keeps existing flags and can raise several at once", () => {
    const prior = { code: "driver_cancelled", message: "x", severity: "info" as const, at: "2026-01-01T00:00:00.000Z" };
    const withPrior = { ...base, flags: [prior], offerAttempts: 6 };
    const f = computeRideFlags(withPrior, 10_000, 5000);
    expect(codes(f)).toEqual(["driver_cancelled", "distance_deviation", "duration_deviation", "many_offers"]);
    // The input ride's flags are not mutated.
    expect(withPrior.flags).toEqual([prior]);
  });
});
