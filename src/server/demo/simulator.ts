/**
 * Demo autopilot for seeded demo drivers (users.isDemo = true, role driver).
 * Real driver accounts are never touched. Everything here produces clearly
 * labelled demo rides so a rider can experience the full flow alone.
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client";
import { driverProfiles, rides, users } from "../db/schema";
import { bearingDeg, haversineM, pointAlong } from "../geo";
import { getSetting } from "../settings";
import {
  completeRide,
  driverArrived,
  driverArriving,
  respondToOffer,
  startRide,
  updateDriverLocation,
} from "../dispatch/service";

const g = globalThis as unknown as { __hopSim?: Map<string, { phaseStart: number; progress: number }> };
const state = (g.__hopSim ??= new Map());

export async function simulateDemoDrivers() {
  const db = await getDb();
  const autopilot = await getSetting("demo.autopilot");
  if (!autopilot) return;
  const acceptDelay = await getSetting("demo.autopilotAcceptDelaySec");
  const speed = await getSetting("demo.driverSpeedMps");
  const tickS = 2.5;

  const demoDrivers = await db
    .select({ user: users, profile: driverProfiles })
    .from(users)
    .innerJoin(driverProfiles, eq(driverProfiles.userId, users.id))
    .where(and(eq(users.isDemo, true), eq(users.role, "driver"), eq(driverProfiles.verificationStatus, "approved")));
  if (demoDrivers.length === 0) return;
  const ids = demoDrivers.map((d) => d.user.id);

  // Keep demo drivers' locations fresh so they stay matchable.
  const now = new Date();
  for (const d of demoDrivers) {
    if (d.profile.availability === "online" && d.profile.lastLat != null && d.profile.lastLng != null) {
      const age = now.getTime() - (d.profile.lastLocationAt?.getTime() ?? 0);
      if (age > 60_000) {
        await db
          .update(driverProfiles)
          .set({ lastLocationAt: now })
          .where(eq(driverProfiles.userId, d.user.id));
      }
    }
  }

  // 1. Pending offers → accept after a short delay.
  const offered = await db
    .select()
    .from(rides)
    .where(and(eq(rides.status, "offered"), inArray(rides.offeredDriverId, ids)));
  for (const ride of offered) {
    const key = `offer:${ride.id}:${ride.offeredDriverId}`;
    const s = state.get(key) ?? { phaseStart: Date.now(), progress: 0 };
    state.set(key, s);
    if (Date.now() - s.phaseStart >= acceptDelay * 1000) {
      const driver = demoDrivers.find((d) => d.user.id === ride.offeredDriverId)!;
      await respondToOffer({ driver: driver.user, rideId: ride.id, accept: true }).catch(() => {});
      state.delete(key);
    }
  }

  // 2. Active rides → drive to pickup, then along the route, then complete.
  const active = await db
    .select()
    .from(rides)
    .where(and(inArray(rides.status, ["accepted", "driver_arriving", "in_progress"]), inArray(rides.driverId, ids)));
  for (const ride of active) {
    const driver = demoDrivers.find((d) => d.user.id === ride.driverId);
    if (!driver) continue;
    const p = driver.profile;
    const pos = { lat: p.lastLat ?? ride.pickupLat, lng: p.lastLng ?? ride.pickupLng };
    const key = `ride:${ride.id}`;
    const s = state.get(key) ?? { phaseStart: Date.now(), progress: 0 };
    state.set(key, s);

    if (ride.status === "accepted") {
      await driverArriving({ driver: driver.user, rideId: ride.id }).catch(() => {});
      s.phaseStart = Date.now();
      continue;
    }

    if (ride.status === "driver_arriving") {
      const pickup = { lat: ride.pickupLat, lng: ride.pickupLng };
      const dist = haversineM(pos, pickup);
      if (dist > 25) {
        const step = Math.min(dist, speed * tickS);
        const next = pointAlong([[pos.lat, pos.lng], [pickup.lat, pickup.lng]], step / dist);
        await updateDriverLocation({ driver: driver.user, lat: next.lat, lng: next.lng, heading: bearingDeg(pos, pickup), speedMps: speed });
      } else if (!ride.arrivedAt) {
        await updateDriverLocation({ driver: driver.user, lat: pickup.lat, lng: pickup.lng, heading: null, speedMps: 0 });
        await driverArrived({ driver: driver.user, rideId: ride.id }).catch(() => {});
        s.phaseStart = Date.now();
      } else if (Date.now() - s.phaseStart >= 4000) {
        await startRide({ driver: driver.user, rideId: ride.id }).catch(() => {});
        s.progress = 0;
        s.phaseStart = Date.now();
      }
      continue;
    }

    if (ride.status === "in_progress") {
      const total = Math.max(1, ride.estimatedDistanceM);
      s.progress = Math.min(1, s.progress + (speed * tickS) / total);
      const next = pointAlong(ride.polyline, s.progress);
      const heading = bearingDeg(pos, next);
      await updateDriverLocation({ driver: driver.user, lat: next.lat, lng: next.lng, heading, speedMps: speed });
      if (s.progress >= 1) {
        await completeRide({ driver: driver.user, rideId: ride.id }).catch(() => {});
        state.delete(key);
      }
    }
  }
}
