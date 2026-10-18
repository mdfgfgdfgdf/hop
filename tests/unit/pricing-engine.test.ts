import { describe, expect, it } from "vitest";
import { cancellationFee, computeFare, isNight, localMinutes, roundTo } from "@/server/pricing/engine";
import type { FareBreakdown } from "@/server/db/schema";
import { pricingConfig } from "../helpers/fixtures";

// Winter dates are UTC+2 in Israel, summer dates UTC+3 (IDT).
const WINTER_NOON = new Date("2026-01-15T10:00:00Z"); // 12:00 local
const WINTER_2330 = new Date("2026-01-15T21:30:00Z"); // 23:30 local
const WINTER_0300 = new Date("2026-01-16T01:00:00Z"); // 03:00 local
const SUMMER_2115 = new Date("2026-07-15T18:15:00Z"); // 21:15 local (18:15 UTC)

/** 10 km / 20 min on the fixture tariff: base 1000 + 5000 + 2000 = 8000 agorot. */
const TRIP = { distanceM: 10_000, durationS: 1200 };

const line = (f: FareBreakdown, key: string) => f.lines.find((l) => l.key === key);

describe("pricing/engine computeFare", () => {
  it("builds base, distance and time lines from the tariff", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig(), at: WINTER_NOON });
    expect(line(f, "base")?.amountAgorot).toBe(1000);
    expect(line(f, "distance")?.amountAgorot).toBe(5000);
    expect(line(f, "time")?.amountAgorot).toBe(2000);
    expect(line(f, "booking")?.amountAgorot).toBe(200);
    expect(f.lines.map((l) => l.key)).toEqual(["base", "distance", "time", "booking"]);
    expect(f.riderTotalAgorot).toBe(8200);
    // 15% of the 8000 ride fare + the whole booking fee.
    expect(f.hopCommissionAgorot).toBe(1200 + 200);
    expect(f.driverPayoutAgorot).toBe(6800);
    expect(f.currency).toBe("ILS");
    expect(f.nightSurchargeApplied).toBe(false);
    expect(f.discountAgorot).toBe(0);
  });

  it("adds a minimum-fare top-up line when the metered fare is below the minimum", () => {
    const f = computeFare({ distanceM: 500, durationS: 60, config: pricingConfig(), at: WINTER_NOON });
    // 1000 + 250 + 100 = 1350 → topped up to 2500.
    expect(line(f, "min")?.amountAgorot).toBe(1150);
    expect(f.riderTotalAgorot).toBe(2500 + 200);
  });

  it("clamps to the maximum fare with a negative cap line", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig({ maxFareAgorot: 5000 }), at: WINTER_NOON });
    expect(line(f, "max")?.amountAgorot).toBe(5000 - 8000);
    expect(line(f, "min")).toBeUndefined();
    expect(f.riderTotalAgorot).toBe(5000 + 200);
  });

  it("applies the night surcharge at 23:30 and 03:00 Israel time but not at noon", () => {
    const cfg = pricingConfig();
    for (const at of [WINTER_2330, WINTER_0300]) {
      const f = computeFare({ ...TRIP, config: cfg, at });
      expect(f.nightSurchargeApplied).toBe(true);
      expect(line(f, "night")?.amountAgorot).toBe(2000); // 25% of 8000
      expect(f.riderTotalAgorot).toBe(10_000 + 200);
    }
    const day = computeFare({ ...TRIP, config: cfg, at: WINTER_NOON });
    expect(day.nightSurchargeApplied).toBe(false);
    expect(line(day, "night")).toBeUndefined();
  });

  it("evaluates the night window in Asia/Jerusalem, not UTC (summer time)", () => {
    // 18:15 UTC is 21:15 in Israel during IDT → night.
    expect(computeFare({ ...TRIP, config: pricingConfig(), at: SUMMER_2115 }).nightSurchargeApplied).toBe(true);
    // An explicit UTC zone sees 18:15 → day.
    expect(computeFare({ ...TRIP, config: pricingConfig(), at: SUMMER_2115, timeZone: "UTC" }).nightSurchargeApplied).toBe(false);
  });

  it("never applies the surcharge when the night multiplier is ×1", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig({ nightMultiplierBp: 10000 }), at: WINTER_2330 });
    expect(f.nightSurchargeApplied).toBe(false);
    expect(line(f, "night")).toBeUndefined();
  });

  it("never applies the surcharge when nightStart === nightEnd", () => {
    const cfg = pricingConfig({ nightStart: "22:00", nightEnd: "22:00" });
    for (const at of [WINTER_NOON, WINTER_2330, WINTER_0300]) {
      expect(computeFare({ ...TRIP, config: cfg, at }).nightSurchargeApplied).toBe(false);
    }
  });

  it("applies the service multiplier after the night surcharge", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig(), serviceMultiplierBp: 13500, at: WINTER_2330 });
    // 8000 → +2000 night = 10000 → +35% = 13500.
    expect(line(f, "night")?.amountAgorot).toBe(2000);
    expect(line(f, "service")?.amountAgorot).toBe(3500);
    expect(f.serviceMultiplierBp).toBe(13500);
    expect(f.riderTotalAgorot).toBe(13_500 + 200);
  });

  it("supports discount multipliers below ×1 and omits the line at ×1", () => {
    const cheaper = computeFare({ ...TRIP, config: pricingConfig(), serviceMultiplierBp: 8500, at: WINTER_NOON });
    expect(line(cheaper, "service")?.amountAgorot).toBe(-1200);
    expect(cheaper.riderTotalAgorot).toBe(6800 + 200);
    const neutral = computeFare({ ...TRIP, config: pricingConfig(), serviceMultiplierBp: 10000, at: WINTER_NOON });
    expect(line(neutral, "service")).toBeUndefined();
  });

  it("caps percent promotions at maxDiscountAgorot", () => {
    const f = computeFare({
      ...TRIP,
      config: pricingConfig(),
      at: WINTER_NOON,
      promotion: { type: "percent", value: 1000, maxDiscountAgorot: 500 },
    });
    expect(f.discountAgorot).toBe(500); // 10% would be 800
    expect(line(f, "discount")?.amountAgorot).toBe(-500);
    expect(f.riderTotalAgorot).toBe(8000 - 500 + 200);
    // Commission is charged on the discounted fare.
    expect(f.hopCommissionAgorot).toBe(Math.round(7500 * 0.15) + 200);
  });

  it("applies uncapped percent promotions in full", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig(), at: WINTER_NOON, promotion: { type: "percent", value: 1000, maxDiscountAgorot: null } });
    expect(f.discountAgorot).toBe(800);
  });

  it("applies fixed promotions", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig(), at: WINTER_NOON, promotion: { type: "fixed", value: 1500, maxDiscountAgorot: null } });
    expect(f.discountAgorot).toBe(1500);
    expect(f.riderTotalAgorot).toBe(8000 - 1500 + 200);
  });

  it("never discounts more than the fare; the rider still pays the booking fee", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig(), at: WINTER_NOON, promotion: { type: "fixed", value: 1_000_000, maxDiscountAgorot: null } });
    expect(f.discountAgorot).toBe(8000);
    expect(f.riderTotalAgorot).toBe(200);
    expect(f.hopCommissionAgorot).toBe(200);
    expect(f.driverPayoutAgorot).toBe(0);
  });

  it("omits the discount line when the promotion is worth nothing", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig(), at: WINTER_NOON, promotion: { type: "fixed", value: 0, maxDiscountAgorot: null } });
    expect(line(f, "discount")).toBeUndefined();
  });

  it("rounds the rider total to roundingAgorot", () => {
    // 1000 + round(1.234 km × 500) = 1617 (no minimum), + 200 booking = 1817.
    const cfg = { minFareAgorot: 0, perMinuteAgorot: 0 };
    expect(computeFare({ distanceM: 1234, durationS: 0, config: pricingConfig({ ...cfg, roundingAgorot: 100 }), at: WINTER_NOON }).riderTotalAgorot).toBe(1800);
    expect(computeFare({ distanceM: 1234, durationS: 0, config: pricingConfig({ ...cfg, roundingAgorot: 10 }), at: WINTER_NOON }).riderTotalAgorot).toBe(1820);
    expect(computeFare({ distanceM: 1234, durationS: 0, config: pricingConfig({ ...cfg, roundingAgorot: 1 }), at: WINTER_NOON }).riderTotalAgorot).toBe(1817);
  });

  it("includes the fixed commission and booking fee in HOP's share", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig({ commissionFixedAgorot: 300 }), at: WINTER_NOON });
    expect(f.hopCommissionAgorot).toBe(1200 + 300 + 200);
    expect(f.commissionFixedAgorot).toBe(300);
    expect(f.bookingFeeAgorot).toBe(200);
    expect(f.commissionPercentBp).toBe(1500);
  });

  it("omits the booking line when there is no booking fee", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig({ bookingFeeAgorot: 0 }), at: WINTER_NOON });
    expect(line(f, "booking")).toBeUndefined();
    expect(f.riderTotalAgorot).toBe(8000);
  });

  it("propagates isDemoTariff and pricingConfigId", () => {
    const f = computeFare({ ...TRIP, config: pricingConfig({ id: "cfg-prod-7", isDemo: false }), at: WINTER_NOON });
    expect(f.isDemoTariff).toBe(false);
    expect(f.pricingConfigId).toBe("cfg-prod-7");
    expect(computeFare({ ...TRIP, config: pricingConfig(), at: WINTER_NOON }).isDemoTariff).toBe(true);
  });

  it("keeps the money invariants across a sweep of trips, tariffs and promotions", () => {
    // Deterministic LCG so the sweep is reproducible.
    let s = 42;
    const rnd = (n: number) => {
      s = (s * 1103515245 + 12345) % 2 ** 31;
      return s % n;
    };
    for (let i = 0; i < 400; i++) {
      const cfg = pricingConfig({
        baseFareAgorot: rnd(3000),
        perKmAgorot: rnd(900),
        perMinuteAgorot: rnd(200),
        bookingFeeAgorot: rnd(600),
        minFareAgorot: rnd(4000),
        maxFareAgorot: 4000 + rnd(80000),
        commissionPercentBp: rnd(5001),
        commissionFixedAgorot: rnd(800),
        roundingAgorot: [1, 10, 50, 100][rnd(4)],
      });
      const promo = [
        null,
        { type: "percent" as const, value: rnd(10001), maxDiscountAgorot: rnd(2) ? null : rnd(5000) },
        { type: "fixed" as const, value: rnd(20000), maxDiscountAgorot: null },
      ][rnd(3)];
      const f = computeFare({
        distanceM: rnd(60_000),
        durationS: rnd(7200),
        config: cfg,
        serviceMultiplierBp: 5000 + rnd(15000),
        at: rnd(2) ? WINTER_NOON : WINTER_2330,
        promotion: promo,
      });
      expect(f.hopCommissionAgorot + f.driverPayoutAgorot).toBe(f.riderTotalAgorot);
      expect(f.driverPayoutAgorot).toBeGreaterThanOrEqual(0);
      expect(f.hopCommissionAgorot).toBeGreaterThanOrEqual(Math.min(f.riderTotalAgorot, cfg.bookingFeeAgorot + cfg.commissionFixedAgorot));
      expect(f.riderTotalAgorot % cfg.roundingAgorot).toBe(0);
      expect(f.discountAgorot).toBeGreaterThanOrEqual(0);
      for (const l of f.lines) expect(Number.isInteger(l.amountAgorot)).toBe(true);
    }
  });
});

describe("pricing/engine roundTo", () => {
  it("rounds half up to the step and treats steps ≤ 1 as plain rounding", () => {
    expect(roundTo(1815, 10)).toBe(1820);
    expect(roundTo(1814, 10)).toBe(1810);
    expect(roundTo(1849, 100)).toBe(1800);
    expect(roundTo(1850, 100)).toBe(1900);
    expect(roundTo(12.5, 1)).toBe(13);
    expect(roundTo(12.4, 0)).toBe(12);
  });
});

describe("pricing/engine isNight & localMinutes", () => {
  const cfg = { nightStart: "21:00", nightEnd: "05:30" };
  // Israel winter: local = UTC + 2h.
  const local = (hhmm: string) => new Date(`2026-01-15T${hhmm}:00+02:00`);

  it("localMinutes converts to Israel wall-clock minutes", () => {
    expect(localMinutes(WINTER_NOON)).toBe(12 * 60);
    expect(localMinutes(new Date("2026-01-15T22:00:00Z"))).toBe(0); // local midnight → 0, not 1440
    expect(localMinutes(SUMMER_2115)).toBe(21 * 60 + 15);
    expect(localMinutes(SUMMER_2115, "UTC")).toBe(18 * 60 + 15);
  });

  it("handles a window that crosses midnight with an inclusive start and exclusive end", () => {
    expect(isNight(local("20:59"), cfg)).toBe(false);
    expect(isNight(local("21:00"), cfg)).toBe(true);
    expect(isNight(local("23:59"), cfg)).toBe(true);
    expect(isNight(local("00:00"), cfg)).toBe(true);
    expect(isNight(local("05:29"), cfg)).toBe(true);
    expect(isNight(local("05:30"), cfg)).toBe(false);
    expect(isNight(local("12:00"), cfg)).toBe(false);
  });

  it("handles a window inside a single day", () => {
    const early = { nightStart: "01:00", nightEnd: "04:00" };
    expect(isNight(local("00:59"), early)).toBe(false);
    expect(isNight(local("02:00"), early)).toBe(true);
    expect(isNight(local("04:00"), early)).toBe(false);
  });

  it("is never night when start equals end", () => {
    for (const t of ["00:00", "05:00", "21:00", "23:30"]) {
      expect(isNight(local(t), { nightStart: "05:00", nightEnd: "05:00" })).toBe(false);
    }
  });
});

describe("pricing/engine cancellationFee", () => {
  const config = { cancellationFeeAgorot: 1500, freeCancelWindowSec: 120 };
  const acceptedAt = new Date("2026-01-15T10:00:00Z");
  const after = (s: number) => new Date(acceptedAt.getTime() + s * 1000);

  it("is free for anyone but the rider", () => {
    for (const by of ["driver", "system", "admin"] as const) {
      expect(cancellationFee({ config, acceptedAt, cancelledAt: after(3600), quotedTotalAgorot: 5000, cancelledBy: by })).toBe(0);
    }
  });

  it("is free before a driver accepted", () => {
    expect(cancellationFee({ config, acceptedAt: null, cancelledAt: after(3600), quotedTotalAgorot: 5000, cancelledBy: "rider" })).toBe(0);
  });

  it("is free within the grace window (inclusive)", () => {
    expect(cancellationFee({ config, acceptedAt, cancelledAt: after(60), quotedTotalAgorot: 5000, cancelledBy: "rider" })).toBe(0);
    expect(cancellationFee({ config, acceptedAt, cancelledAt: after(120), quotedTotalAgorot: 5000, cancelledBy: "rider" })).toBe(0);
  });

  it("charges the configured fee after the window", () => {
    expect(cancellationFee({ config, acceptedAt, cancelledAt: after(121), quotedTotalAgorot: 5000, cancelledBy: "rider" })).toBe(1500);
  });

  it("never charges more than the quoted total", () => {
    expect(cancellationFee({ config, acceptedAt, cancelledAt: after(600), quotedTotalAgorot: 900, cancelledBy: "rider" })).toBe(900);
  });
});
