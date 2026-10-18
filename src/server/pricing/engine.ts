/**
 * Server-side fare engine. Pure and deterministic: given a route, a tariff
 * and a timestamp it returns the full breakdown a rider, a driver and an
 * operator each need — never trusting any client-supplied amount.
 *
 * All amounts are integer agorot.
 */
import type { FareBreakdown, FareLine, PricingConfig, Promotion } from "../db/schema";

export type FareInput = {
  distanceM: number;
  durationS: number;
  config: PricingConfig;
  serviceMultiplierBp?: number; // 10000 = ×1
  at?: Date;
  promotion?: Pick<Promotion, "type" | "value" | "maxDiscountAgorot"> | null;
  timeZone?: string;
};

export function roundTo(amount: number, step: number) {
  if (step <= 1) return Math.round(amount);
  return Math.round(amount / step) * step;
}

/** HH:MM in the given time zone (Israel by default). */
export function localMinutes(at: Date, timeZone = "Asia/Jerusalem"): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

function parseHm(s: string) {
  const [h, m] = s.split(":").map(Number);
  return (h % 24) * 60 + (m || 0);
}

export function isNight(at: Date, config: Pick<PricingConfig, "nightStart" | "nightEnd">, timeZone?: string) {
  const now = localMinutes(at, timeZone);
  const start = parseHm(config.nightStart);
  const end = parseHm(config.nightEnd);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export function computeFare(input: FareInput): FareBreakdown {
  const { config } = input;
  const at = input.at ?? new Date();
  const km = input.distanceM / 1000;
  const minutes = input.durationS / 60;
  const serviceMultiplierBp = input.serviceMultiplierBp ?? 10000;

  const lines: FareLine[] = [];
  const base = config.baseFareAgorot;
  const distance = Math.round(km * config.perKmAgorot);
  const time = Math.round(minutes * config.perMinuteAgorot);
  lines.push({ key: "base", label: "דמי התחלה", amountAgorot: base });
  lines.push({ key: "distance", label: `מרחק (${km.toFixed(1)} ק"מ)`, amountAgorot: distance });
  lines.push({ key: "time", label: `זמן (${Math.round(minutes)} דק')`, amountAgorot: time });

  let fare = base + distance + time;

  const night = isNight(at, config, input.timeZone) && config.nightMultiplierBp !== 10000;
  if (night) {
    const extra = Math.round((fare * (config.nightMultiplierBp - 10000)) / 10000);
    lines.push({ key: "night", label: "תוספת לילה", amountAgorot: extra });
    fare += extra;
  }

  if (serviceMultiplierBp !== 10000) {
    const extra = Math.round((fare * (serviceMultiplierBp - 10000)) / 10000);
    lines.push({ key: "service", label: "תוספת סוג שירות", amountAgorot: extra });
    fare += extra;
  }

  // Min / max apply to the fare before the booking fee.
  if (fare < config.minFareAgorot) {
    lines.push({ key: "min", label: "השלמה למחיר מינימום", amountAgorot: config.minFareAgorot - fare });
    fare = config.minFareAgorot;
  }
  if (fare > config.maxFareAgorot) {
    lines.push({ key: "max", label: "הגבלת מחיר מקסימום", amountAgorot: config.maxFareAgorot - fare });
    fare = config.maxFareAgorot;
  }

  let discount = 0;
  if (input.promotion) {
    discount =
      input.promotion.type === "percent"
        ? Math.round((fare * input.promotion.value) / 10000)
        : input.promotion.value;
    if (input.promotion.maxDiscountAgorot != null) discount = Math.min(discount, input.promotion.maxDiscountAgorot);
    discount = Math.min(discount, fare);
    if (discount > 0) lines.push({ key: "discount", label: "הנחה", amountAgorot: -discount });
  }

  const bookingFee = config.bookingFeeAgorot;
  if (bookingFee > 0) lines.push({ key: "booking", label: "דמי הזמנה", amountAgorot: bookingFee });

  const riderTotal = roundTo(fare - discount + bookingFee, config.roundingAgorot);

  // Commission is charged on the ride fare (net of discount, excluding the
  // booking fee, which goes to HOP in full). Driver gets the rest.
  const netFare = fare - discount;
  const commissionOnFare =
    Math.round((netFare * config.commissionPercentBp) / 10000) + config.commissionFixedAgorot;
  const hopCommission = Math.max(0, Math.min(riderTotal, commissionOnFare + bookingFee));
  const driverPayout = riderTotal - hopCommission;

  return {
    currency: "ILS",
    riderTotalAgorot: riderTotal,
    hopCommissionAgorot: hopCommission,
    driverPayoutAgorot: driverPayout,
    lines,
    commissionPercentBp: config.commissionPercentBp,
    commissionFixedAgorot: config.commissionFixedAgorot,
    bookingFeeAgorot: bookingFee,
    discountAgorot: discount,
    nightSurchargeApplied: night,
    serviceMultiplierBp,
    isDemoTariff: config.isDemo,
    pricingConfigId: config.id,
  };
}

/**
 * Cancellation fee policy: free before a driver accepted, free within the
 * grace window after acceptance, otherwise the configured fee (never more
 * than the quoted total).
 */
export function cancellationFee(opts: {
  config: Pick<PricingConfig, "cancellationFeeAgorot" | "freeCancelWindowSec">;
  acceptedAt: Date | null;
  cancelledAt: Date;
  quotedTotalAgorot: number;
  cancelledBy: "rider" | "driver" | "system" | "admin";
}): number {
  if (opts.cancelledBy !== "rider") return 0;
  if (!opts.acceptedAt) return 0;
  const elapsed = (opts.cancelledAt.getTime() - opts.acceptedAt.getTime()) / 1000;
  if (elapsed <= opts.config.freeCancelWindowSec) return 0;
  return Math.min(opts.config.cancellationFeeAgorot, opts.quotedTotalAgorot);
}
