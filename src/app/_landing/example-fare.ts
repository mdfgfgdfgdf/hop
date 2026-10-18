/**
 * Data for the landing page, read from the live configuration so the page
 * never contradicts the app: the active tariff (run through the real server
 * fare engine for a few fixed example trips) and the service types with
 * their legal status. Example fares are illustrations ("דוגמה"), never
 * quotes: fixed distances at a fixed daytime hour, no promotion.
 * Server-only (reads the database).
 */
import { asc } from "drizzle-orm";
import { computeFare } from "@/server/pricing/engine";
import { getActivePricing } from "@/server/pricing/config";
import { getDb } from "@/server/db/client";
import { serviceTypes, type PricingConfig } from "@/server/db/schema";

export type ExampleTrip = {
  id: "short" | "city" | "long";
  label: string;
  km: number;
  minutes: number;
  riderTotal: number;
  driverPayout: number;
  hopCommission: number;
  lines: { key: string; label: string; amount: number }[];
};

export type RideOption = {
  id: string;
  name: string;
  description: string;
  seats: number;
  enabled: boolean;
  /** Example price for the "city" trip with this service's multiplier (agorot). */
  examplePrice: number;
};

export type LandingData = {
  trips: ExampleTrip[];
  options: RideOption[];
  commissionPercentBp: number;
  commissionFixedAgorot: number;
  bookingFeeAgorot: number;
  /** The active tariff is the seeded demo tariff (or the fallback below). */
  demoTariff: boolean;
  nightStart: string;
  nightEnd: string;
  nightMultiplierBp: number;
  freeCancelWindowSec: number;
  cancellationFeeAgorot: number;
  quoteTtlSec: number;
};

const TRIPS: Pick<ExampleTrip, "id" | "label" | "km" | "minutes">[] = [
  { id: "short", label: "קצרה", km: 2, minutes: 7 },
  { id: "city", label: "בעיר", km: 5, minutes: 15 },
  { id: "long", label: "ארוכה", km: 12, minutes: 24 },
];

/** 11:00 in Israel: a daytime hour, so no night surcharge is mixed into the example. */
const DAYTIME = new Date("2026-03-10T09:00:00Z");

/** Same values as the seeded demo tariff; used only if no tariff is configured. */
const FALLBACK: PricingConfig = {
  id: "landing-fallback",
  name: "תעריף הדגמה",
  active: true,
  isDemo: true,
  currency: "ILS",
  baseFareAgorot: 1250,
  perKmAgorot: 470,
  perMinuteAgorot: 75,
  bookingFeeAgorot: 200,
  minFareAgorot: 2500,
  maxFareAgorot: 80000,
  commissionPercentBp: 1200,
  commissionFixedAgorot: 0,
  cancellationFeeAgorot: 1500,
  freeCancelWindowSec: 120,
  nightMultiplierBp: 12500,
  nightStart: "21:00",
  nightEnd: "05:30",
  roundingAgorot: 10,
  quoteTtlSec: 300,
  notes: null,
  updatedBy: null,
  createdAt: DAYTIME,
  updatedAt: DAYTIME,
};

/** The seeded service catalogue; used only if the database cannot be read. */
const FALLBACK_TYPES = [
  { id: "taxi", nameHe: "מונית", descriptionHe: "מונית מורשית, עד 4 נוסעים", enabled: true, priceMultiplierBp: 10000, seats: 4 },
  { id: "taxi_xl", nameHe: "מונית גדולה", descriptionHe: "מונית מורשית, עד 6 נוסעים", enabled: true, priceMultiplierBp: 13500, seats: 6 },
  { id: "premium", nameHe: "פרימיום", descriptionHe: "רכב יוקרה עם נהג מורשה", enabled: true, priceMultiplierBp: 16000, seats: 3 },
  { id: "accessible", nameHe: "מונית נגישה", descriptionHe: "מונית מותאמת לכיסא גלגלים", enabled: true, priceMultiplierBp: 10000, seats: 3 },
  { id: "rideshare", nameHe: "נהג פרטי (שיתוף נסיעות)", descriptionHe: "כבוי — מחייב אישור רגולטורי וביטוחי לפני הפעלה", enabled: false, priceMultiplierBp: 8500, seats: 4 },
];

const fareFor = (config: PricingConfig, km: number, minutes: number, serviceMultiplierBp = 10000) =>
  computeFare({ distanceM: km * 1000, durationS: minutes * 60, config, serviceMultiplierBp, at: DAYTIME, timeZone: "Asia/Jerusalem" });

export async function getLandingData(): Promise<LandingData> {
  let config: PricingConfig;
  try {
    config = await getActivePricing();
  } catch {
    config = FALLBACK;
  }
  let types = FALLBACK_TYPES;
  try {
    const db = await getDb();
    const rows = await db.select().from(serviceTypes).orderBy(asc(serviceTypes.sortOrder));
    if (rows.length) types = rows;
  } catch {
    /* keep the seeded catalogue */
  }

  const trips = TRIPS.map((t): ExampleTrip => {
    const fare = fareFor(config, t.km, t.minutes);
    return {
      ...t,
      riderTotal: fare.riderTotalAgorot,
      driverPayout: fare.driverPayoutAgorot,
      hopCommission: fare.hopCommissionAgorot,
      lines: fare.lines.map((l) => ({ key: l.key, label: l.label, amount: l.amountAgorot })),
    };
  });
  const city = TRIPS[1];
  const options = types.map(
    (s): RideOption => ({
      id: s.id,
      name: s.nameHe,
      description: s.descriptionHe,
      seats: s.seats,
      enabled: s.enabled,
      examplePrice: fareFor(config, city.km, city.minutes, s.priceMultiplierBp).riderTotalAgorot,
    }),
  );

  return {
    trips,
    options,
    commissionPercentBp: config.commissionPercentBp,
    commissionFixedAgorot: config.commissionFixedAgorot,
    bookingFeeAgorot: config.bookingFeeAgorot,
    demoTariff: config.isDemo,
    nightStart: config.nightStart,
    nightEnd: config.nightEnd,
    nightMultiplierBp: config.nightMultiplierBp,
    freeCancelWindowSec: config.freeCancelWindowSec,
    cancellationFeeAgorot: config.cancellationFeeAgorot,
    quoteTtlSec: config.quoteTtlSec,
  };
}
