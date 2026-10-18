import { asc, eq } from "drizzle-orm";
import { ok, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { ledgerEntries, rideEvents, rideOffers, rideTrackPoints, users } from "@/server/db/schema";
import { getRideDTO } from "@/server/dispatch/service";
import { serializeRideEvent } from "@/server/dispatch/serialize";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  const db = await getDb();
  const [ride, events, offers, ledger, track] = await Promise.all([
    getRideDTO(id, staff),
    db.select().from(rideEvents).where(eq(rideEvents.rideId, id)).orderBy(asc(rideEvents.createdAt)),
    db.select({ o: rideOffers, driverName: users.name }).from(rideOffers).leftJoin(users, eq(users.id, rideOffers.driverId)).where(eq(rideOffers.rideId, id)).orderBy(asc(rideOffers.createdAt)),
    db.select().from(ledgerEntries).where(eq(ledgerEntries.rideId, id)).orderBy(asc(ledgerEntries.createdAt)),
    db.select({ lat: rideTrackPoints.lat, lng: rideTrackPoints.lng, at: rideTrackPoints.recordedAt }).from(rideTrackPoints).where(eq(rideTrackPoints.rideId, id)).orderBy(asc(rideTrackPoints.recordedAt)),
  ]);
  return ok({
    ride,
    events: events.map(serializeRideEvent),
    offers: offers.map(({ o, driverName }) => ({ ...o, driverName, expiresAt: o.expiresAt.toISOString(), respondedAt: o.respondedAt?.toISOString() ?? null, createdAt: o.createdAt.toISOString() })),
    ledger: ledger.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    track: track.map((t) => ({ lat: t.lat, lng: t.lng, at: t.at.toISOString() })),
  });
});
