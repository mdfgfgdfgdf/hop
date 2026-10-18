/**
 * Seed data.
 *   seedBaseline — what the platform needs to function at all: service types,
 *                  a clearly-labelled DEMO tariff, the pilot service area,
 *                  settings and the bootstrap admin.
 *   seedDemo     — demo riders/drivers/rides for development & demos only.
 * Both are idempotent.
 */
import { eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import {
  driverProfiles,
  ledgerEntries,
  pricingConfigs,
  promotions,
  rides,
  serviceAreas,
  serviceTypes,
  settings,
  users,
  type FareBreakdown,
} from "./schema";
import { env, isDemoMode } from "../env";
import { hashPassword } from "../auth/password";
import { SETTING_DEFAULTS } from "../settings";
import { computeFare } from "../pricing/engine";
import { estimateRoute } from "../geo/demo-provider";
import { DEMO_PLACES } from "../geo/demo-places";

export const DEMO_ACCOUNTS = {
  admin: { email: "admin@hop.local", password: "Admin1234!", name: "מנהל HOP" },
  support: { email: "support@hop.local", password: "Support1234!", name: "תמיכת HOP" },
  rider: { email: "rider@hop.local", password: "Rider1234!", name: "נועה לוי" },
  driver: { email: "driver@hop.local", password: "Driver1234!", name: "דני כהן" },
} as const;

export async function seedBaseline(db: Db) {
  // Service types — only services that may be operated lawfully in Israel are
  // enabled. "rideshare" (private cars) stays off until regulatory approval.
  const types = [
    { id: "taxi", nameHe: "מונית", descriptionHe: "מונית מורשית, עד 4 נוסעים", enabled: true, legalStatus: "approved" as const, vehicleClasses: ["standard", "xl", "premium", "accessible"], priceMultiplierBp: 10000, seats: 4, sortOrder: 1 },
    { id: "taxi_xl", nameHe: "מונית גדולה", descriptionHe: "מונית מורשית, עד 6 נוסעים", enabled: true, legalStatus: "approved" as const, vehicleClasses: ["xl"], priceMultiplierBp: 13500, seats: 6, sortOrder: 2 },
    { id: "premium", nameHe: "פרימיום", descriptionHe: "רכב יוקרה עם נהג מורשה", enabled: true, legalStatus: "approved" as const, vehicleClasses: ["premium"], priceMultiplierBp: 16000, seats: 3, sortOrder: 3 },
    { id: "accessible", nameHe: "מונית נגישה", descriptionHe: "מונית מותאמת לכיסא גלגלים", enabled: true, legalStatus: "approved" as const, vehicleClasses: ["accessible"], priceMultiplierBp: 10000, seats: 3, sortOrder: 4 },
    { id: "rideshare", nameHe: "נהג פרטי (שיתוף נסיעות)", descriptionHe: "כבוי — מחייב אישור רגולטורי וביטוחי לפני הפעלה", enabled: false, legalStatus: "requires_regulatory_approval" as const, vehicleClasses: ["standard"], priceMultiplierBp: 8500, seats: 4, sortOrder: 9 },
  ];
  for (const t of types) {
    await db.insert(serviceTypes).values(t).onConflictDoNothing();
  }

  const existingPricing = await db.select({ id: pricingConfigs.id }).from(pricingConfigs).limit(1);
  if (existingPricing.length === 0) {
    await db.insert(pricingConfigs).values({
      name: "תעריף הדגמה (פיתוח)",
      active: true,
      isDemo: true,
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
      notes: "ערכי הדגמה בלבד. אינם תעריף רשמי. יש לעדכן לאחר אישור המודל העסקי והרגולטורי.",
    });
  }

  const existingArea = await db.select({ id: serviceAreas.id }).from(serviceAreas).limit(1);
  if (existingArea.length === 0) {
    // Pilot area: Gush Dan (approximate bounding polygon, [lng, lat]).
    await db.insert(serviceAreas).values({
      name: "גוש דן (פיילוט)",
      active: true,
      polygon: {
        type: "Polygon",
        coordinates: [[
          [34.70, 31.95], [34.70, 32.22], [34.95, 32.22], [34.95, 31.95], [34.70, 31.95],
        ]],
      },
    });
  }

  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing();
  }

  const adminEmail = env().HOP_ADMIN_EMAIL.toLowerCase();
  const admin = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${adminEmail}`).limit(1);
  if (admin.length === 0) {
    await db.insert(users).values({
      role: "admin",
      name: "מנהל HOP",
      email: adminEmail,
      passwordHash: await hashPassword(env().HOP_ADMIN_PASSWORD),
      isDemo: false,
    });
  }

  if (isDemoMode()) await seedDemo(db);
}

async function upsertUser(db: Db, u: { role: "rider" | "driver" | "support"; name: string; email: string; password: string; phone?: string }) {
  const existing = await db.select().from(users).where(sql`lower(${users.email}) = ${u.email.toLowerCase()}`).limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(users)
    .values({ role: u.role, name: u.name, email: u.email.toLowerCase(), phone: u.phone ?? null, passwordHash: await hashPassword(u.password), isDemo: true })
    .returning();
  return row;
}

const DEMO_DRIVERS = [
  { email: DEMO_ACCOUNTS.driver.email, password: DEMO_ACCOUNTS.driver.password, name: DEMO_ACCOUNTS.driver.name, phone: "0501110001", make: "סקודה", model: "אוקטביה", color: "לבן", plate: "25-371-82", cls: "standard" as const, lat: 32.0752, lng: 34.7751, status: "approved" as const, online: true, rating: [47, 10] },
  { email: "driver2@hop.local", password: "Driver1234!", name: "מיכל אברהם", phone: "0501110002", make: "טויוטה", model: "קורולה", color: "אפור", plate: "81-204-33", cls: "standard" as const, lat: 32.0838, lng: 34.7980, status: "approved" as const, online: true, rating: [96, 20] },
  { email: "driver3@hop.local", password: "Driver1234!", name: "יוסי מזרחי", phone: "0501110003", make: "מרצדס", model: "ויטו", color: "שחור", plate: "17-889-20", cls: "xl" as const, lat: 32.0629, lng: 34.7700, status: "approved" as const, online: true, rating: [44, 9] },
  { email: "driver4@hop.local", password: "Driver1234!", name: "רונית שרון", phone: "0501110004", make: "מרצדס", model: "E-Class", color: "שחור", plate: "90-115-67", cls: "premium" as const, lat: 32.0717, lng: 34.7869, status: "approved" as const, online: true, rating: [50, 10] },
  { email: "driver5@hop.local", password: "Driver1234!", name: "אבי פרץ", phone: "0501110005", make: "יונדאי", model: "איוניק", color: "כחול", plate: "63-442-19", cls: "standard" as const, lat: 32.0994, lng: 34.8244, status: "approved" as const, online: true, rating: [38, 8] },
  { email: "driver6@hop.local", password: "Driver1234!", name: "סמיר חורי", phone: "0501110006", make: "קיה", model: "נירו", color: "לבן", plate: "44-901-77", cls: "standard" as const, lat: 32.0146, lng: 34.7727, status: "approved" as const, online: false, rating: [29, 6] },
  { email: "driver7@hop.local", password: "Driver1234!", name: "תמר גולן", phone: "0501110007", make: "פולקסווגן", model: "קאדי", color: "כסף", plate: "12-567-90", cls: "accessible" as const, lat: 32.0807, lng: 34.7805, status: "approved" as const, online: true, rating: [15, 3] },
  { email: "driver.pending@hop.local", password: "Driver1234!", name: "אלון ברק", phone: "0501110008", make: "מאזדה", model: "3", color: "אדום", plate: "77-310-55", cls: "standard" as const, lat: 32.07, lng: 34.78, status: "under_review" as const, online: false, rating: [0, 0] },
  { email: "driver.rejected@hop.local", password: "Driver1234!", name: "גיא נחום", phone: "0501110009", make: "סוזוקי", model: "סוויפט", color: "ירוק", plate: "31-222-18", cls: "standard" as const, lat: 32.07, lng: 34.78, status: "rejected" as const, online: false, rating: [0, 0] },
];

export async function seedDemo(db: Db) {
  const marker = await db.select().from(settings).where(eq(settings.key, "demo.seeded")).limit(1);
  if (marker[0]?.value === true) return;

  await upsertUser(db, { role: "support", ...DEMO_ACCOUNTS.support, phone: "0500000002" });
  const rider = await upsertUser(db, { role: "rider", ...DEMO_ACCOUNTS.rider, phone: "0522220001" });
  await upsertUser(db, { role: "rider", name: "עומר ביטון", email: "rider2@hop.local", password: "Rider1234!", phone: "0522220002" });

  const driverUsers: { id: string; cls: string }[] = [];
  for (const d of DEMO_DRIVERS) {
    const u = await upsertUser(db, { role: "driver", name: d.name, email: d.email, password: d.password, phone: d.phone });
    driverUsers.push({ id: u.id, cls: d.cls });
    await db
      .insert(driverProfiles)
      .values({
        userId: u.id,
        verificationStatus: d.status,
        availability: d.online ? "online" : "offline",
        serviceTypeIds: d.cls === "xl" ? ["taxi", "taxi_xl"] : d.cls === "premium" ? ["premium"] : d.cls === "accessible" ? ["taxi", "accessible"] : ["taxi"],
        vehicleClass: d.cls,
        vehicleMake: d.make,
        vehicleModel: d.model,
        vehicleColor: d.color,
        vehiclePlate: d.plate,
        vehicleYear: 2021,
        seats: d.cls === "xl" ? 6 : 4,
        licenseNumber: `0${Math.floor(1000000 + Math.random() * 8999999)}`,
        taxiLicenseNumber: d.status === "approved" ? `ת-${Math.floor(10000 + Math.random() * 89999)}` : null,
        lastLat: d.lat,
        lastLng: d.lng,
        lastHeading: 0,
        lastLocationAt: new Date(),
        offersReceived: d.rating[1] * 2,
        offersAccepted: Math.round(d.rating[1] * 1.7),
        ratingSum: d.rating[0],
        ratingCount: d.rating[1],
        reviewedAt: d.status === "approved" || d.status === "rejected" ? new Date() : null,
        rejectionReason: d.status === "rejected" ? "רישיון להסעת נוסעים בשכר אינו בתוקף" : null,
      })
      .onConflictDoNothing();
  }

  await db
    .insert(promotions)
    .values({ code: "HOP10", type: "percent", value: 1000, maxDiscountAgorot: 2000, active: true })
    .onConflictDoNothing();

  // Historical demo rides for history / earnings / reports.
  const [cfg] = await db.select().from(pricingConfigs).where(eq(pricingConfigs.active, true)).limit(1);
  if (cfg) {
    const pairs: [number, number][] = [[0, 5], [1, 7], [3, 8], [10, 25], [14, 6], [2, 15], [20, 11]];
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i];
      const from = DEMO_PLACES[a];
      const to = DEMO_PLACES[b];
      const route = estimateRoute(from, to);
      const daysAgo = pairs.length - i;
      const requestedAt = new Date(Date.now() - daysAgo * 86_400_000 - 3_600_000);
      const fare: FareBreakdown = computeFare({ distanceM: route.distanceM, durationS: route.durationS, config: cfg, at: requestedAt });
      const driver = driverUsers[i % 2];
      const startedAt = new Date(requestedAt.getTime() + 6 * 60_000);
      const completedAt = new Date(startedAt.getTime() + route.durationS * 1000);
      const [ride] = await db
        .insert(rides)
        .values({
          riderId: rider.id,
          driverId: driver.id,
          serviceTypeId: "taxi",
          status: "completed",
          pickupLat: from.lat, pickupLng: from.lng, pickupAddress: `${from.name}, ${from.city}`,
          dropoffLat: to.lat, dropoffLng: to.lng, dropoffAddress: `${to.name}, ${to.city}`,
          polyline: route.polyline,
          estimatedDistanceM: route.distanceM,
          estimatedDurationS: route.durationS,
          actualDistanceM: route.distanceM,
          actualDurationS: route.durationS,
          quotedFare: fare,
          finalFare: fare,
          quotedTotalAgorot: fare.riderTotalAgorot,
          finalTotalAgorot: fare.riderTotalAgorot,
          commissionAgorot: fare.hopCommissionAgorot,
          driverPayoutAgorot: fare.driverPayoutAgorot,
          paymentMethod: i % 2 ? "cash" : "card_demo",
          paymentStatus: "paid",
          requestedAt,
          acceptedAt: new Date(requestedAt.getTime() + 20_000),
          arrivingAt: new Date(requestedAt.getTime() + 25_000),
          arrivedAt: new Date(startedAt.getTime() - 60_000),
          startedAt,
          completedAt,
          riderRating: 5,
          isDemo: true,
          createdAt: requestedAt,
        })
        .returning();
      await db.insert(ledgerEntries).values([
        { rideId: ride.id, userId: rider.id, type: "rider_charge", amountAgorot: fare.riderTotalAgorot, createdAt: completedAt },
        { rideId: ride.id, userId: null, type: "hop_commission", amountAgorot: fare.hopCommissionAgorot, createdAt: completedAt },
        { rideId: ride.id, userId: driver.id, type: "driver_payout", amountAgorot: fare.driverPayoutAgorot, createdAt: completedAt },
      ]);
    }
  }

  await db.insert(settings).values({ key: "demo.seeded", value: true }).onConflictDoUpdate({ target: settings.key, set: { value: true } });
}
