/**
 * Ride lifecycle + matching. Every state change happens inside a transaction
 * that locks the ride row (SELECT … FOR UPDATE) and re-checks the current
 * status, so two drivers can never accept the same ride and a ride can never
 * be started or completed twice — regardless of how many requests race.
 */
import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, type Db, type Tx } from "../db/client";
import {
  driverProfiles,
  ledgerEntries,
  promotions,
  quotes,
  ratings,
  rideEvents,
  rideOffers,
  rideTrackPoints,
  rides,
  serviceTypes,
  users,
  type DriverProfile,
  type FareBreakdown,
  type LatLng,
  type Ride,
  type RideFlag,
  type ServiceType,
  type User,
} from "../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { geo, haversineM, isInServiceArea, polylineLengthM, type Place } from "../geo";
import { estimateRoute } from "../geo/demo-provider";
import { cancellationFee, computeFare } from "../pricing/engine";
import { findPromotion, getActivePricing } from "../pricing/config";
import { channels, publish } from "../realtime/bus";
import { getSetting } from "../settings";
import { audit } from "../audit";
import { ACTIVE_STATUSES, DRIVER_BUSY_STATUSES, assertTransition } from "./states";
import { serializeRide, type Viewer } from "./serialize";
import type { QuoteResponse, RideDTO } from "@/lib/types";
import { isDemoMode } from "../env";

type Actor = Pick<User, "id" | "role" | "name" | "isDemo">;

// ───────────────────────────── helpers ─────────────────────────────

async function lockRide(tx: Tx, rideId: string): Promise<Ride> {
  const rows = await tx.select().from(rides).where(eq(rides.id, rideId)).for("update");
  const ride = rows[0];
  if (!ride) throw notFound("הנסיעה לא נמצאה");
  return ride;
}

async function lockDriver(tx: Tx, driverId: string): Promise<DriverProfile> {
  const rows = await tx
    .select()
    .from(driverProfiles)
    .where(eq(driverProfiles.userId, driverId))
    .for("update");
  const p = rows[0];
  if (!p) throw notFound("פרופיל נהג לא נמצא");
  return p;
}

async function addEvent(
  tx: Tx | Db,
  rideId: string,
  type: string,
  actor: Actor | null,
  data: Record<string, unknown> = {},
) {
  await tx.insert(rideEvents).values({
    rideId,
    type,
    actorUserId: actor?.id ?? null,
    actorRole: actor?.role ?? "system",
    data,
  });
}

async function publishRide(rideId: string) {
  const db = await getDb();
  const ride = (await db.select().from(rides).where(eq(rides.id, rideId)))[0];
  if (!ride) return;
  const payload = { rideId, status: ride.status, version: ride.version, updatedAt: ride.updatedAt.toISOString() };
  publish(channels.user(ride.riderId), "ride.updated", payload);
  if (ride.driverId) publish(channels.user(ride.driverId), "ride.updated", payload);
  if (ride.offeredDriverId) publish(channels.user(ride.offeredDriverId), "ride.updated", payload);
  publish(channels.ride(ride.id), "ride.updated", payload);
  publish(channels.admin, "admin.ride", payload);
}

export async function loadRideContext(db: Db | Tx, ride: Ride) {
  const [serviceType] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, ride.serviceTypeId));
  const [rider] = await db.select().from(users).where(eq(users.id, ride.riderId));
  const driverId = ride.driverId ?? ride.offeredDriverId;
  const driver = driverId ? (await db.select().from(users).where(eq(users.id, driverId)))[0] ?? null : null;
  const driverProfile = driverId
    ? (await db.select().from(driverProfiles).where(eq(driverProfiles.userId, driverId)))[0] ?? null
    : null;
  const offer =
    ride.status === "offered" && ride.offeredDriverId
      ? (
          await db
            .select()
            .from(rideOffers)
            .where(and(eq(rideOffers.rideId, ride.id), eq(rideOffers.status, "pending")))
            .orderBy(desc(rideOffers.createdAt))
            .limit(1)
        )[0] ?? null
      : null;
  return { serviceType: serviceType!, rider: rider ?? null, driver, driverProfile, offer };
}

export async function getRideDTO(rideId: string, viewer: Viewer, opts: { skipAuth?: boolean; stripCounterparts?: boolean } = {}): Promise<RideDTO> {
  const db = await getDb();
  const ride = (await db.select().from(rides).where(eq(rides.id, rideId)))[0];
  if (!ride) throw notFound("הנסיעה לא נמצאה");
  if (!opts.skipAuth) assertCanView(ride, viewer);
  const ctx = await loadRideContext(db, ride);
  const dto = serializeRide(ride, ctx, viewer);
  // A driver who declined or cancelled is no longer a party: they get the
  // resulting status but no details about the rider or the next driver.
  return opts.stripCounterparts ? { ...dto, rider: null, driver: null, offer: null } : dto;
}

export function assertCanView(ride: Ride, viewer: Viewer) {
  if (viewer.role === "admin" || viewer.role === "support") return;
  if (ride.riderId === viewer.id) return;
  if (ride.driverId === viewer.id) return;
  if (ride.status === "offered" && ride.offeredDriverId === viewer.id) return;
  throw forbidden();
}

// ───────────────────────────── quotes ─────────────────────────────

export async function createQuotes(input: {
  rider: Actor;
  pickup: Place | { lat: number; lng: number; address: string; name?: string };
  dropoff: Place | { lat: number; lng: number; address: string; name?: string };
  promoCode?: string | null;
}): Promise<QuoteResponse> {
  const db = await getDb();
  const pickup: LatLng = { lat: input.pickup.lat, lng: input.pickup.lng };
  const dropoff: LatLng = { lat: input.dropoff.lat, lng: input.dropoff.lng };

  if (haversineM(pickup, dropoff) < 50) throw badRequest("same_point", "נקודת האיסוף והיעד קרובות מדי");
  if (!(await isInServiceArea(pickup))) {
    throw badRequest("outside_service_area", "HOP עדיין לא פועלת באזור האיסוף שבחרתם");
  }

  const route = await geo().route(pickup, dropoff);
  const config = await getActivePricing(db);
  const promotion = input.promoCode ? await findPromotion(input.promoCode, db) : null;
  if (input.promoCode && !promotion) throw badRequest("invalid_promo", "קוד הקופון אינו תקף");

  const types = (await db.select().from(serviceTypes).where(eq(serviceTypes.enabled, true))).filter(
    (t) => t.legalStatus === "approved",
  );
  if (types.length === 0) throw conflict("no_services", "אין כרגע שירותים פעילים");

  const drivers = await availableDrivers(db);
  const radiusM = await getSetting("dispatch.searchRadiusM", db);
  const minAcceptanceRateBp = await getSetting("dispatch.minAcceptanceRateBp", db);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.quoteTtlSec * 1000);

  const pickupAddress = input.pickup.address;
  const dropoffAddress = input.dropoff.address;

  const quoteRows = await Promise.all(
    types
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(async (st) => {
        const fare = computeFare({
          distanceM: route.distanceM,
          durationS: route.durationS,
          config,
          serviceMultiplierBp: st.priceMultiplierBp,
          at: now,
          promotion,
        });
        // Same filter the dispatcher uses, so riders never see drivers that could not be offered the ride.
        const eligible = rankCandidates({ pickupLat: pickup.lat, pickupLng: pickup.lng, excludedDriverIds: [] }, st, drivers, { radiusM, minAcceptanceRateBp });
        const nearestEta = eligible[0]?.etaS;
        const [row] = await db
          .insert(quotes)
          .values({
            riderId: input.rider.id,
            serviceTypeId: st.id,
            pickupLat: pickup.lat,
            pickupLng: pickup.lng,
            pickupAddress,
            dropoffLat: dropoff.lat,
            dropoffLng: dropoff.lng,
            dropoffAddress,
            distanceM: route.distanceM,
            durationS: route.durationS,
            polyline: route.polyline,
            traffic: route.traffic ?? null,
            geoProvider: route.provider,
            fare,
            riderTotalAgorot: fare.riderTotalAgorot,
            promoCode: promotion?.code ?? null,
            expiresAt,
          })
          .returning();
        return {
          id: row.id,
          serviceType: {
            id: st.id,
            nameHe: st.nameHe,
            descriptionHe: st.descriptionHe,
            enabled: st.enabled,
            legalStatus: st.legalStatus,
            vehicleClasses: st.vehicleClasses,
            priceMultiplierBp: st.priceMultiplierBp,
            seats: st.seats,
            sortOrder: st.sortOrder,
          },
          fare,
          riderTotalAgorot: fare.riderTotalAgorot,
          expiresAt: expiresAt.toISOString(),
          etaToPickupS: nearestEta ?? null,
          availableDrivers: eligible.length,
        };
      }),
  );

  const toPlace = (p: typeof input.pickup, fallbackName: string) => ({
    id: "id" in p && p.id ? String(p.id) : `pt-${p.lat}-${p.lng}`,
    name: ("name" in p && p.name) || fallbackName,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    provider: ("provider" in p && p.provider) || geo().name,
  });

  return {
    route,
    pickup: toPlace(input.pickup, "נקודת איסוף"),
    dropoff: toPlace(input.dropoff, "יעד"),
    quotes: quoteRows,
    geoProvider: route.provider,
    isDemoTariff: config.isDemo,
    cancellationPolicy: { freeCancelWindowSec: config.freeCancelWindowSec, feeAgorot: config.cancellationFeeAgorot },
  };
}

// ───────────────────────────── ride creation ─────────────────────────────

export async function createRide(input: {
  rider: Actor;
  quoteId: string;
  paymentMethod: "cash" | "card_demo";
}): Promise<RideDTO> {
  const db = await getDb();
  const rideId = await db.transaction(async (tx) => {
    // Serialise bookings per rider so two concurrent requests cannot both pass the active-ride check.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, input.rider.id)).for("update");
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, input.quoteId)).for("update");
    if (!quote || quote.riderId !== input.rider.id) throw notFound("הצעת המחיר לא נמצאה");
    if (quote.usedByRideId) throw conflict("quote_used", "הצעת המחיר כבר נוצלה");
    if (quote.expiresAt.getTime() < Date.now()) throw conflict("quote_expired", "הצעת המחיר פגה, בקשו מחיר מחדש");

    const [st] = await tx.select().from(serviceTypes).where(eq(serviceTypes.id, quote.serviceTypeId));
    if (!st || !st.enabled || st.legalStatus !== "approved") throw conflict("service_unavailable", "סוג השירות אינו זמין");

    const active = await tx
      .select({ id: rides.id })
      .from(rides)
      .where(and(eq(rides.riderId, input.rider.id), inArray(rides.status, [...ACTIVE_STATUSES])))
      .limit(1);
    if (active.length) throw conflict("ride_active", "כבר יש לכם נסיעה פעילה", { rideId: active[0].id });

    const searchTimeout = await getSetting("dispatch.searchTimeoutSec", tx);
    const now = new Date();
    const [ride] = await tx
      .insert(rides)
      .values({
        riderId: input.rider.id,
        quoteId: quote.id,
        serviceTypeId: quote.serviceTypeId,
        status: "requested",
        pickupLat: quote.pickupLat,
        pickupLng: quote.pickupLng,
        pickupAddress: quote.pickupAddress,
        dropoffLat: quote.dropoffLat,
        dropoffLng: quote.dropoffLng,
        dropoffAddress: quote.dropoffAddress,
        polyline: quote.polyline,
        traffic: quote.traffic,
        estimatedDistanceM: quote.distanceM,
        estimatedDurationS: quote.durationS,
        quotedFare: quote.fare,
        quotedTotalAgorot: quote.riderTotalAgorot,
        paymentMethod: input.paymentMethod,
        paymentStatus: "pending",
        searchExpiresAt: new Date(now.getTime() + searchTimeout * 1000),
        isDemo: isDemoMode() || input.rider.isDemo,
      })
      .returning();
    await tx.update(quotes).set({ usedByRideId: ride.id }).where(eq(quotes.id, quote.id));
    if (quote.promoCode) {
      await tx.update(promotions).set({ usedCount: sql`${promotions.usedCount} + 1` }).where(eq(promotions.code, quote.promoCode));
    }
    await addEvent(tx, ride.id, "requested", input.rider, { quoteId: quote.id, paymentMethod: input.paymentMethod });
    assertTransition("requested", "searching");
    await tx.update(rides).set({ status: "searching", version: sql`${rides.version} + 1` }).where(eq(rides.id, ride.id));
    await addEvent(tx, ride.id, "searching", null);
    return ride.id;
  });

  await publishRide(rideId);
  await runMatching(rideId);
  return getRideDTO(rideId, input.rider);
}

// ───────────────────────────── matching ─────────────────────────────

type Candidate = { user: User; profile: DriverProfile };

async function availableDrivers(db: Db | Tx): Promise<Candidate[]> {
  const stale = await getSetting("dispatch.driverStaleLocationSec", db);
  const since = new Date(Date.now() - stale * 1000);
  const rows = await db
    .select({ user: users, profile: driverProfiles })
    .from(driverProfiles)
    .innerJoin(users, eq(users.id, driverProfiles.userId))
    .where(
      and(
        eq(driverProfiles.verificationStatus, "approved"),
        eq(driverProfiles.availability, "online"),
        eq(users.status, "active"),
      ),
    );
  const busy = new Set(
    (
      await db
        .select({ driverId: rides.driverId, offered: rides.offeredDriverId })
        .from(rides)
        .where(inArray(rides.status, [...DRIVER_BUSY_STATUSES, "offered"]))
    ).flatMap((r) => [r.driverId, r.offered].filter(Boolean) as string[]),
  );
  return rows.filter(
    (r) =>
      r.profile.lastLat != null &&
      r.profile.lastLng != null &&
      r.profile.lastLocationAt != null &&
      r.profile.lastLocationAt >= since &&
      !busy.has(r.user.id),
  );
}

export type NearbyCar = { id: string; lat: number; lng: number; heading: number | null; vehicleClass: string };

/**
 * Available cars around a point, for the rider's map. Anonymous by design:
 * a per-day token instead of the driver id, coordinates rounded to ~10 m,
 * no names, plates or ratings. Busy drivers are excluded.
 */
export async function nearbyCars(at: { lat: number; lng: number }, opts: { radiusM?: number; limit?: number } = {}): Promise<NearbyCar[]> {
  const radiusM = Math.min(opts.radiusM ?? 3000, 5000);
  const limit = Math.min(opts.limit ?? 8, 12);
  const day = new Date().toISOString().slice(0, 10);
  const rows = await availableDrivers(await getDb());
  return rows
    .map((c) => ({ c, d: haversineM(at, { lat: c.profile.lastLat!, lng: c.profile.lastLng! }) }))
    .filter((x) => x.d <= radiusM)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(({ c }) => ({
      id: createHash("sha256").update(`${day}:${c.user.id}`).digest("hex").slice(0, 12),
      lat: Math.round(c.profile.lastLat! * 1e4) / 1e4,
      lng: Math.round(c.profile.lastLng! * 1e4) / 1e4,
      heading: c.profile.lastHeading ?? null,
      vehicleClass: c.profile.vehicleClass,
    }));
}

/** Scores candidates for a ride: nearest first, honouring class/exclusions. */
export function rankCandidates(
  ride: Pick<Ride, "pickupLat" | "pickupLng" | "excludedDriverIds">,
  serviceType: Pick<ServiceType, "vehicleClasses">,
  candidates: Candidate[],
  opts: { radiusM: number; minAcceptanceRateBp: number },
) {
  const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
  return candidates
    .filter((c) => !ride.excludedDriverIds.includes(c.user.id))
    .filter((c) => serviceType.vehicleClasses.includes(c.profile.vehicleClass))
    .filter((c) => {
      if (opts.minAcceptanceRateBp <= 0 || c.profile.offersReceived < 10) return true;
      const rate = (c.profile.offersAccepted * 10000) / c.profile.offersReceived;
      return rate >= opts.minAcceptanceRateBp;
    })
    .map((c) => {
      const distanceM = haversineM(pickup, { lat: c.profile.lastLat!, lng: c.profile.lastLng! });
      const etaS = estimateRoute(pickup, { lat: c.profile.lastLat!, lng: c.profile.lastLng! }).durationS;
      return { ...c, distanceM: Math.round(distanceM), etaS };
    })
    .filter((c) => c.distanceM <= opts.radiusM)
    .sort((a, b) => a.etaS - b.etaS || a.distanceM - b.distanceM);
}

/**
 * Attempts to offer the ride to the best available driver. Safe to call at
 * any time: it is a no-op unless the ride is currently `searching`.
 */
export async function runMatching(rideId: string): Promise<"offered" | "waiting" | "cancelled" | "noop"> {
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const ride = await lockRide(tx, rideId);
    if (ride.status !== "searching") return "noop" as const;

    const now = new Date();
    const maxAttempts = await getSetting("dispatch.maxOfferAttempts", tx);
    if ((ride.searchExpiresAt && ride.searchExpiresAt < now) || ride.offerAttempts >= maxAttempts) {
      await tx
        .update(rides)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: "system",
          cancelReason: "no_drivers_available",
          paymentStatus: "not_applicable",
          version: sql`${rides.version} + 1`,
        })
        .where(eq(rides.id, ride.id));
      await addEvent(tx, ride.id, "cancelled", null, { by: "system", reason: "no_drivers_available" });
      return "cancelled" as const;
    }

    const [st] = await tx.select().from(serviceTypes).where(eq(serviceTypes.id, ride.serviceTypeId));
    const radiusM = await getSetting("dispatch.searchRadiusM", tx);
    const minAcceptanceRateBp = await getSetting("dispatch.minAcceptanceRateBp", tx);
    const ranked = rankCandidates(ride, st, await availableDrivers(tx), { radiusM, minAcceptanceRateBp });
    const best = ranked[0];
    if (!best) return "waiting" as const;

    const offerTimeout = await getSetting("dispatch.offerTimeoutSec", tx);
    const expiresAt = new Date(now.getTime() + offerTimeout * 1000);
    const attempt = ride.offerAttempts + 1;
    assertTransition(ride.status, "offered");
    await tx.insert(rideOffers).values({
      rideId: ride.id,
      driverId: best.user.id,
      attempt,
      driverDistanceM: best.distanceM,
      driverEtaS: best.etaS,
      driverPayoutAgorot: ride.quotedFare.driverPayoutAgorot,
      expiresAt,
    });
    await tx
      .update(rides)
      .set({
        status: "offered",
        offeredDriverId: best.user.id,
        offerExpiresAt: expiresAt,
        offerAttempts: attempt,
        version: sql`${rides.version} + 1`,
      })
      .where(eq(rides.id, ride.id));
    await tx
      .update(driverProfiles)
      .set({ offersReceived: sql`${driverProfiles.offersReceived} + 1` })
      .where(eq(driverProfiles.userId, best.user.id));
    await addEvent(tx, ride.id, "offered", null, { driverId: best.user.id, attempt, distanceM: best.distanceM, etaS: best.etaS });
    publish(channels.user(best.user.id), "ride.offer", { rideId: ride.id, expiresAt: expiresAt.toISOString() });
    return "offered" as const;
  });
  if (result !== "noop" && result !== "waiting") await publishRide(rideId);
  return result;
}

/** Driver accepts or declines the offer currently addressed to them. */
export async function respondToOffer(input: { driver: Actor; rideId: string; accept: boolean }): Promise<RideDTO> {
  const db = await getDb();
  const outcome = await db.transaction(async (tx) => {
    const ride = await lockRide(tx, input.rideId);
    const now = new Date();
    if (ride.status !== "offered" || ride.offeredDriverId !== input.driver.id || !ride.offerExpiresAt || ride.offerExpiresAt < now) {
      throw conflict("offer_unavailable", "ההצעה כבר אינה זמינה");
    }
    const [offer] = await tx
      .select()
      .from(rideOffers)
      .where(and(eq(rideOffers.rideId, ride.id), eq(rideOffers.driverId, input.driver.id), eq(rideOffers.status, "pending")))
      .orderBy(desc(rideOffers.createdAt))
      .limit(1);

    if (input.accept) {
      const profile = await lockDriver(tx, input.driver.id);
      if (profile.verificationStatus !== "approved") throw forbidden("הנהג אינו מאושר");
      if (profile.availability !== "online") throw conflict("driver_busy", "הנהג אינו זמין");
      const busyRides = await tx
        .select({ id: rides.id })
        .from(rides)
        .where(and(eq(rides.driverId, input.driver.id), inArray(rides.status, [...DRIVER_BUSY_STATUSES])))
        .limit(1);
      if (busyRides.length) throw conflict("driver_busy", "כבר יש לך נסיעה פעילה");

      assertTransition(ride.status, "accepted");
      const updated = await tx
        .update(rides)
        .set({
          status: "accepted",
          driverId: input.driver.id,
          acceptedAt: now,
          offeredDriverId: null,
          offerExpiresAt: null,
          version: sql`${rides.version} + 1`,
        })
        .where(and(eq(rides.id, ride.id), eq(rides.status, "offered"), eq(rides.offeredDriverId, input.driver.id)))
        .returning({ id: rides.id });
      if (updated.length !== 1) throw conflict("offer_unavailable", "ההצעה כבר אינה זמינה");
      if (offer) await tx.update(rideOffers).set({ status: "accepted", respondedAt: now }).where(eq(rideOffers.id, offer.id));
      await tx
        .update(driverProfiles)
        .set({ availability: "busy", offersAccepted: sql`${driverProfiles.offersAccepted} + 1` })
        .where(eq(driverProfiles.userId, input.driver.id));
      await addEvent(tx, ride.id, "accepted", input.driver, { offerId: offer?.id });
      publish(channels.admin, "admin.driver", { driverId: input.driver.id, availability: "busy" });
      return "accepted" as const;
    }

    assertTransition(ride.status, "searching");
    await tx
      .update(rides)
      .set({
        status: "searching",
        offeredDriverId: null,
        offerExpiresAt: null,
        excludedDriverIds: [...ride.excludedDriverIds, input.driver.id],
        version: sql`${rides.version} + 1`,
      })
      .where(eq(rides.id, ride.id));
    if (offer) await tx.update(rideOffers).set({ status: "declined", respondedAt: now }).where(eq(rideOffers.id, offer.id));
    await addEvent(tx, ride.id, "offer_declined", input.driver, { offerId: offer?.id });
    return "declined" as const;
  });

  await publishRide(input.rideId);
  if (outcome === "declined") await runMatching(input.rideId);
  // After declining, the driver is no longer a party to the ride; return the
  // resulting state once, without counterpart details.
  return getRideDTO(input.rideId, input.driver, { skipAuth: outcome === "declined", stripCounterparts: outcome === "declined" });
}

/** Expires a pending offer whose deadline passed and re-dispatches. */
export async function expireOffer(rideId: string): Promise<boolean> {
  const db = await getDb();
  const expired = await db.transaction(async (tx) => {
    const ride = await lockRide(tx, rideId);
    if (ride.status !== "offered" || !ride.offerExpiresAt || ride.offerExpiresAt > new Date()) return false;
    const driverId = ride.offeredDriverId!;
    await tx
      .update(rides)
      .set({
        status: "searching",
        offeredDriverId: null,
        offerExpiresAt: null,
        excludedDriverIds: [...ride.excludedDriverIds, driverId],
        version: sql`${rides.version} + 1`,
      })
      .where(eq(rides.id, ride.id));
    await tx
      .update(rideOffers)
      .set({ status: "expired", respondedAt: new Date() })
      .where(and(eq(rideOffers.rideId, ride.id), eq(rideOffers.driverId, driverId), eq(rideOffers.status, "pending")));
    await addEvent(tx, ride.id, "offer_expired", null, { driverId });
    publish(channels.user(driverId), "ride.offer.cancelled", { rideId: ride.id, reason: "expired" });
    return true;
  });
  if (expired) {
    await publishRide(rideId);
    await runMatching(rideId);
  }
  return expired;
}

// ───────────────────────────── driver progress ─────────────────────────────

async function driverTransition(
  input: { driver: Actor; rideId: string },
  to: "driver_arriving" | "in_progress",
  patch: Partial<typeof rides.$inferInsert>,
  eventType: string,
) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ride = await lockRide(tx, input.rideId);
    if (ride.driverId !== input.driver.id) throw forbidden();
    assertTransition(ride.status, to);
    const updated = await tx
      .update(rides)
      .set({ ...patch, status: to, version: sql`${rides.version} + 1` })
      .where(and(eq(rides.id, ride.id), eq(rides.status, ride.status)))
      .returning({ id: rides.id });
    if (updated.length !== 1) throw conflict("stale", "המצב השתנה, נסו שוב");
    await addEvent(tx, ride.id, eventType, input.driver);
  });
  await publishRide(input.rideId);
  return getRideDTO(input.rideId, input.driver);
}

export const driverArriving = (input: { driver: Actor; rideId: string }) =>
  driverTransition(input, "driver_arriving", { arrivingAt: new Date() }, "driver_arriving");

export async function driverArrived(input: { driver: Actor; rideId: string }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ride = await lockRide(tx, input.rideId);
    if (ride.driverId !== input.driver.id) throw forbidden();
    if (ride.status !== "driver_arriving" && ride.status !== "accepted") throw conflict("invalid_transition", "לא ניתן לסמן הגעה במצב הנוכחי");
    await tx
      .update(rides)
      .set({ status: "driver_arriving", arrivingAt: ride.arrivingAt ?? new Date(), arrivedAt: new Date(), version: sql`${rides.version} + 1` })
      .where(eq(rides.id, ride.id));
    await addEvent(tx, ride.id, "driver_arrived", input.driver);
  });
  await publishRide(input.rideId);
  return getRideDTO(input.rideId, input.driver);
}

export const startRide = (input: { driver: Actor; rideId: string }) =>
  driverTransition(input, "in_progress", { startedAt: new Date() }, "started");

export function computeRideFlags(ride: Ride, actualDistanceM: number, actualDurationS: number): RideFlag[] {
  const flags: RideFlag[] = [...ride.flags];
  const at = new Date().toISOString();
  if (actualDistanceM > ride.estimatedDistanceM * 1.5 + 500) {
    flags.push({ code: "distance_deviation", severity: "warning", at, message: `המרחק בפועל (${(actualDistanceM / 1000).toFixed(1)} ק"מ) גבוה משמעותית מההערכה (${(ride.estimatedDistanceM / 1000).toFixed(1)} ק"מ)` });
  }
  if (actualDurationS > ride.estimatedDurationS * 2.5 + 600) {
    flags.push({ code: "duration_deviation", severity: "warning", at, message: `משך הנסיעה (${Math.round(actualDurationS / 60)} דק') חריג ביחס להערכה (${Math.round(ride.estimatedDurationS / 60)} דק')` });
  }
  if (actualDurationS < 30 && ride.estimatedDistanceM > 1500) {
    flags.push({ code: "too_short", severity: "critical", at, message: "הנסיעה הסתיימה תוך פחות מ-30 שניות" });
  }
  if (ride.offerAttempts >= 5) {
    flags.push({ code: "many_offers", severity: "info", at, message: `הנסיעה הוצעה ל-${ride.offerAttempts} נהגים לפני שהתקבלה` });
  }
  return flags;
}

export async function completeRide(input: { driver: Actor; rideId: string }) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ride = await lockRide(tx, input.rideId);
    if (ride.driverId !== input.driver.id) throw forbidden();
    assertTransition(ride.status, "completed");
    const now = new Date();
    const points = await tx
      .select({ lat: rideTrackPoints.lat, lng: rideTrackPoints.lng })
      .from(rideTrackPoints)
      .where(eq(rideTrackPoints.rideId, ride.id))
      .orderBy(rideTrackPoints.recordedAt);
    const tracked = points.length >= 2 ? Math.round(polylineLengthM(points.map((p) => [p.lat, p.lng]))) : null;
    // A track that barely moved (GPS off, parked) is not evidence of a shorter ride.
    const actualDistanceM = tracked != null && tracked >= 50 ? tracked : ride.estimatedDistanceM;
    const actualDurationS = Math.max(0, Math.round((now.getTime() - (ride.startedAt ?? now).getTime()) / 1000));

    // Upfront pricing: the rider pays what was quoted. Deviations are flagged
    // for operator review and can be adjusted from the dashboard.
    const finalFare: FareBreakdown = ride.quotedFare;
    const flags = computeRideFlags(ride, actualDistanceM, actualDurationS);

    const updated = await tx
      .update(rides)
      .set({
        status: "completed",
        completedAt: now,
        actualDistanceM,
        actualDurationS,
        finalFare,
        finalTotalAgorot: finalFare.riderTotalAgorot,
        commissionAgorot: finalFare.hopCommissionAgorot,
        driverPayoutAgorot: finalFare.driverPayoutAgorot,
        paymentStatus: "paid",
        flags,
        version: sql`${rides.version} + 1`,
      })
      .where(and(eq(rides.id, ride.id), eq(rides.status, "in_progress")))
      .returning({ id: rides.id });
    if (updated.length !== 1) throw conflict("stale", "הנסיעה כבר הושלמה");

    await tx.insert(ledgerEntries).values([
      { rideId: ride.id, userId: ride.riderId, type: "rider_charge", amountAgorot: finalFare.riderTotalAgorot, note: ride.paymentMethod === "cash" ? "מזומן לנהג" : "כרטיס (הדגמה)" },
      { rideId: ride.id, userId: null, type: "hop_commission", amountAgorot: finalFare.hopCommissionAgorot, note: `עמלה ${finalFare.commissionPercentBp / 100}%` },
      { rideId: ride.id, userId: input.driver.id, type: "driver_payout", amountAgorot: finalFare.driverPayoutAgorot },
    ]);
    await releaseDriverAvailability(tx, input.driver.id);
    await addEvent(tx, ride.id, "completed", input.driver, { actualDistanceM, actualDurationS, flags: flags.map((f) => f.code) });
  });
  await publishRide(input.rideId);
  return getRideDTO(input.rideId, input.driver);
}

// ───────────────────────────── cancellation ─────────────────────────────

export async function cancelRide(input: { actor: Actor; rideId: string; reason?: string | null; ip?: string | null }) {
  const db = await getDb();
  const outcome = await db.transaction(async (tx) => {
    const ride = await lockRide(tx, input.rideId);
    const now = new Date();
    const role = input.actor.role;

    if (role === "rider") {
      if (ride.riderId !== input.actor.id) throw forbidden();
      if (ride.status === "in_progress") throw conflict("cannot_cancel", "לא ניתן לבטל נסיעה שכבר החלה. פנו לתמיכה.");
      assertTransition(ride.status, "cancelled");
      const config = await getActivePricing(tx);
      const fee = cancellationFee({ config, acceptedAt: ride.acceptedAt, cancelledAt: now, quotedTotalAgorot: ride.quotedTotalAgorot, cancelledBy: "rider" });
      await tx
        .update(rides)
        .set({
          status: "cancelled",
          cancelledAt: now,
          cancelledBy: "rider",
          cancelReason: input.reason ?? null,
          cancellationFeeAgorot: fee,
          paymentStatus: fee > 0 ? "paid" : "not_applicable",
          offeredDriverId: null,
          offerExpiresAt: null,
          version: sql`${rides.version} + 1`,
        })
        .where(eq(rides.id, ride.id));
      if (fee > 0) {
        await tx.insert(ledgerEntries).values([
          { rideId: ride.id, userId: ride.riderId, type: "cancellation_fee", amountAgorot: fee, note: "דמי ביטול" },
        ]);
      }
      await releaseDriver(tx, ride, "cancelled_by_rider");
      await addEvent(tx, ride.id, "cancelled", input.actor, { by: "rider", reason: input.reason, feeAgorot: fee });
      return { kind: "cancelled" as const };
    }

    if (role === "driver") {
      if (ride.driverId !== input.actor.id) throw forbidden();
      if (ride.status !== "accepted" && ride.status !== "driver_arriving") throw conflict("cannot_cancel", "לא ניתן לבטל במצב הנוכחי");
      assertTransition(ride.status, "searching");
      const searchTimeout = await getSetting("dispatch.searchTimeoutSec", tx);
      await tx
        .update(rides)
        .set({
          status: "searching",
          driverId: null,
          acceptedAt: null,
          arrivingAt: null,
          arrivedAt: null,
          excludedDriverIds: [...ride.excludedDriverIds, input.actor.id],
          searchExpiresAt: new Date(now.getTime() + searchTimeout * 1000),
          flags: [...ride.flags, { code: "driver_cancelled", severity: "info", at: now.toISOString(), message: "הנהג ביטל לאחר שאישר" }],
          version: sql`${rides.version} + 1`,
        })
        .where(eq(rides.id, ride.id));
      await releaseDriverAvailability(tx, input.actor.id);
      await addEvent(tx, ride.id, "driver_cancelled", input.actor, { reason: input.reason });
      return { kind: "redispatch" as const };
    }

    // admin / support
    if (ride.status === "completed" || ride.status === "cancelled") throw conflict("cannot_cancel", "הנסיעה כבר הסתיימה");
    await tx
      .update(rides)
      .set({
        status: "cancelled",
        cancelledAt: now,
        cancelledBy: "admin",
        cancelReason: input.reason ?? null,
        paymentStatus: "not_applicable",
        offeredDriverId: null,
        offerExpiresAt: null,
        version: sql`${rides.version} + 1`,
      })
      .where(eq(rides.id, ride.id));
    await releaseDriver(tx, ride, "cancelled_by_admin");
    await addEvent(tx, ride.id, "cancelled", input.actor, { by: "admin", reason: input.reason });
    await audit({ actorId: input.actor.id, actorRole: role, action: "ride.cancel", targetType: "ride", targetId: ride.id, data: { reason: input.reason }, ip: input.ip }, tx);
    return { kind: "cancelled" as const };
  });

  await publishRide(input.rideId);
  if (outcome.kind === "redispatch") await runMatching(input.rideId);
  const left = outcome.kind === "redispatch"; // the driver is no longer a party after cancelling
  return getRideDTO(input.rideId, input.actor, { skipAuth: left, stripCounterparts: left });
}

/**
 * Puts a driver back in the pool after a ride ends — but only if they are
 * still approved and active. A driver suspended mid-ride ends up offline.
 */
async function releaseDriverAvailability(tx: Tx, driverId: string) {
  const [p] = await tx.select().from(driverProfiles).where(eq(driverProfiles.userId, driverId));
  const [u] = await tx.select({ status: users.status }).from(users).where(eq(users.id, driverId));
  const availability = p?.verificationStatus === "approved" && u?.status === "active" ? "online" : "offline";
  await tx.update(driverProfiles).set({ availability }).where(eq(driverProfiles.userId, driverId));
  publish(channels.admin, "admin.driver", { driverId, availability });
  publish(channels.user(driverId), "driver.availability", { availability });
}

async function releaseDriver(tx: Tx, ride: Ride, reason: string) {
  if (ride.status === "offered" && ride.offeredDriverId) {
    await tx
      .update(rideOffers)
      .set({ status: "cancelled", respondedAt: new Date() })
      .where(and(eq(rideOffers.rideId, ride.id), eq(rideOffers.status, "pending")));
    publish(channels.user(ride.offeredDriverId), "ride.offer.cancelled", { rideId: ride.id, reason });
  }
  if (ride.driverId) await releaseDriverAvailability(tx, ride.driverId);
}

// ───────────────────────────── ratings ─────────────────────────────

export async function rateRide(input: { actor: Actor; rideId: string; stars: number; comment?: string | null }) {
  if (!Number.isInteger(input.stars) || input.stars < 1 || input.stars > 5) throw badRequest("invalid_rating", "דירוג חייב להיות בין 1 ל-5");
  const db = await getDb();
  await db.transaction(async (tx) => {
    const ride = await lockRide(tx, input.rideId);
    if (ride.status !== "completed") throw conflict("not_completed", "ניתן לדרג רק נסיעה שהושלמה");
    const isRider = ride.riderId === input.actor.id;
    const isDriver = ride.driverId === input.actor.id;
    if (!isRider && !isDriver) throw forbidden();
    const toUserId = isRider ? ride.driverId! : ride.riderId;
    if ((isRider && ride.riderRating != null) || (isDriver && ride.driverRating != null)) throw conflict("already_rated", "כבר דירגתם נסיעה זו");
    await tx.insert(ratings).values({ rideId: ride.id, fromUserId: input.actor.id, toUserId, stars: input.stars, comment: input.comment ?? null });
    await tx
      .update(rides)
      .set(isRider ? { riderRating: input.stars } : { driverRating: input.stars })
      .where(eq(rides.id, ride.id));
    if (isRider) {
      await tx
        .update(driverProfiles)
        .set({ ratingSum: sql`${driverProfiles.ratingSum} + ${input.stars}`, ratingCount: sql`${driverProfiles.ratingCount} + 1` })
        .where(eq(driverProfiles.userId, toUserId));
    }
    await addEvent(tx, ride.id, "rated", input.actor, { stars: input.stars, by: isRider ? "rider" : "driver" });
  });
  return getRideDTO(input.rideId, input.actor);
}

// ───────────────────────────── driver presence ─────────────────────────────

export async function setDriverAvailability(input: { driver: Actor; online: boolean; location?: LatLng | null }) {
  const db = await getDb();
  const profile = await db.transaction(async (tx) => {
    const p = await lockDriver(tx, input.driver.id);
    if (input.online) {
      if (p.verificationStatus !== "approved") throw forbidden("ניתן להתחבר רק לאחר אישור הנהג");
      const loc = input.location ?? (p.lastLat != null && p.lastLng != null ? { lat: p.lastLat, lng: p.lastLng } : null);
      if (!loc) throw badRequest("location_required", "נדרש מיקום כדי לעבור למצב זמין");
      if (p.availability === "busy") return p;
      const [updated] = await tx
        .update(driverProfiles)
        .set({ availability: "online", lastLat: loc.lat, lastLng: loc.lng, lastLocationAt: new Date() })
        .where(eq(driverProfiles.userId, p.userId))
        .returning();
      return updated;
    }
    if (p.availability === "busy") throw conflict("driver_busy", "לא ניתן לצאת ממצב זמין במהלך נסיעה");
    const [updated] = await tx
      .update(driverProfiles)
      .set({ availability: "offline" })
      .where(eq(driverProfiles.userId, p.userId))
      .returning();
    return updated;
  });
  publish(channels.admin, "admin.driver", { driverId: input.driver.id, availability: profile.availability });
  publish(channels.user(input.driver.id), "driver.availability", { availability: profile.availability });
  return profile;
}

export async function updateDriverLocation(input: {
  driver: Actor;
  lat: number;
  lng: number;
  heading?: number | null;
  speedMps?: number | null;
}) {
  const db = await getDb();
  const now = new Date();
  await db
    .update(driverProfiles)
    .set({ lastLat: input.lat, lastLng: input.lng, lastHeading: input.heading ?? null, lastLocationAt: now })
    .where(eq(driverProfiles.userId, input.driver.id));
  const [active] = await db
    .select({ id: rides.id, riderId: rides.riderId, status: rides.status })
    .from(rides)
    .where(and(eq(rides.driverId, input.driver.id), inArray(rides.status, [...DRIVER_BUSY_STATUSES])))
    .limit(1);
  if (active) {
    if (active.status === "in_progress") {
      await db.insert(rideTrackPoints).values({ rideId: active.id, lat: input.lat, lng: input.lng, heading: input.heading ?? null, speedMps: input.speedMps ?? null });
    }
    const payload = { rideId: active.id, driverId: input.driver.id, lat: input.lat, lng: input.lng, heading: input.heading ?? null, at: now.toISOString() };
    publish(channels.user(active.riderId), "driver.location", payload);
    publish(channels.ride(active.id), "driver.location", payload);
  }
  publish(channels.admin, "driver.location", { driverId: input.driver.id, lat: input.lat, lng: input.lng, heading: input.heading ?? null, at: now.toISOString() });
}

// ───────────────────────────── queries ─────────────────────────────

export async function getActiveRideFor(viewer: Viewer): Promise<RideDTO | null> {
  const db = await getDb();
  let ride: Ride | undefined;
  if (viewer.role === "rider") {
    [ride] = await db
      .select()
      .from(rides)
      .where(and(eq(rides.riderId, viewer.id), inArray(rides.status, [...ACTIVE_STATUSES])))
      .orderBy(desc(rides.createdAt))
      .limit(1);
  } else if (viewer.role === "driver") {
    [ride] = await db
      .select()
      .from(rides)
      .where(and(eq(rides.driverId, viewer.id), inArray(rides.status, [...DRIVER_BUSY_STATUSES])))
      .orderBy(desc(rides.createdAt))
      .limit(1);
    if (!ride) {
      [ride] = await db
        .select()
        .from(rides)
        .where(and(eq(rides.offeredDriverId, viewer.id), eq(rides.status, "offered")))
        .orderBy(desc(rides.createdAt))
        .limit(1);
    }
  }
  if (!ride) return null;
  const ctx = await loadRideContext(db, ride);
  return serializeRide(ride, ctx, viewer);
}

export async function listRidesFor(viewer: Viewer, opts: { limit?: number; offset?: number } = {}): Promise<RideDTO[]> {
  const db = await getDb();
  const col = viewer.role === "driver" ? rides.driverId : rides.riderId;
  const rows = await db
    .select()
    .from(rides)
    .where(eq(col, viewer.id))
    .orderBy(desc(rides.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
  const out: RideDTO[] = [];
  for (const r of rows) out.push(serializeRide(r, await loadRideContext(db, r), viewer));
  return out;
}
