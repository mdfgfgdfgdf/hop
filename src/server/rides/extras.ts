/**
 * Ride extras around the core dispatch flow: tips after a ride, rider ↔
 * driver chat during it, and live trip-sharing links. Every function checks
 * that the actor is a party to the ride; money stays integer agorot and is
 * recorded in the ledger like any other movement.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { getDb, type Tx } from "../db/client";
import { driverProfiles, ledgerEntries, rideEvents, rideMessages, rideShares, rides, users, type Ride, type User } from "../db/schema";
import { env } from "../env";
import { badRequest, conflict, forbidden, notFound } from "../errors";
import { channels, publish } from "../realtime/bus";
import type { RideMessageDTO, SharedRideDTO } from "@/lib/types";

type Actor = Pick<User, "id" | "role" | "name">;

export const TIP_MIN_AGOROT = 100; // ₪1
export const TIP_MAX_AGOROT = 20_000; // ₪200
export const TIP_WINDOW_MS = 7 * 24 * 3600_000;
export const MESSAGE_MAX_CHARS = 500;
const CHAT_OPEN: Ride["status"][] = ["accepted", "driver_arriving", "in_progress"];
const SHARE_TTL_MS = 6 * 3600_000;
const SHARE_AFTER_END_MS = 30 * 60_000;

async function lockRide(tx: Tx, rideId: string) {
  const [ride] = await tx.select().from(rides).where(eq(rides.id, rideId)).for("update");
  if (!ride) throw notFound("הנסיעה לא נמצאה");
  return ride;
}

const announce = (ride: Pick<Ride, "id" | "riderId" | "driverId">, type: "ride.message" | "ride.tip" | "ride.updated", data: Record<string, unknown>) => {
  publish(channels.user(ride.riderId), type, { rideId: ride.id, ...data });
  if (ride.driverId) publish(channels.user(ride.driverId), type, { rideId: ride.id, ...data });
};

// ───────────────────────────── tips ─────────────────────────────

/** Adds a tip to a completed ride: once, within 7 days, 100 % to the driver. */
export async function addTip(input: { rider: Actor; rideId: string; amountAgorot: number }) {
  const amount = input.amountAgorot;
  if (!Number.isInteger(amount) || amount < TIP_MIN_AGOROT || amount > TIP_MAX_AGOROT) {
    throw badRequest("invalid_tip", `טיפ בין ₪${TIP_MIN_AGOROT / 100} ל-₪${TIP_MAX_AGOROT / 100}`);
  }
  const db = await getDb();
  const ride = await db.transaction(async (tx) => {
    const ride = await lockRide(tx, input.rideId);
    if (ride.riderId !== input.rider.id) throw forbidden();
    if (ride.status !== "completed" || !ride.driverId) throw conflict("tip_not_allowed", "אפשר להוסיף טיפ רק אחרי נסיעה שהושלמה");
    if (ride.tipAgorot > 0) throw conflict("tip_exists", "כבר הוספתם טיפ לנסיעה הזו");
    if (!ride.completedAt || Date.now() - ride.completedAt.getTime() > TIP_WINDOW_MS) throw conflict("tip_window", "עברו יותר משבעה ימים מהנסיעה");
    await tx.update(rides).set({ tipAgorot: amount }).where(eq(rides.id, ride.id));
    await tx.insert(ledgerEntries).values([
      { rideId: ride.id, userId: ride.riderId, type: "tip_charge", amountAgorot: amount, note: ride.paymentMethod === "cash" ? "טיפ (חיוב באפליקציה, הדגמה)" : "טיפ (כרטיס, הדגמה)" },
      { rideId: ride.id, userId: ride.driverId, type: "tip_payout", amountAgorot: amount, note: "100% מהטיפ לנהג" },
    ]);
    await tx.insert(rideEvents).values({ rideId: ride.id, type: "tip_added", actorUserId: input.rider.id, actorRole: input.rider.role, data: { amountAgorot: amount } });
    return { ...ride, tipAgorot: amount };
  });
  announce(ride, "ride.tip", { amountAgorot: amount });
  return { rideId: ride.id, tipAgorot: amount };
}

// ───────────────────────────── chat ─────────────────────────────

function partyRole(ride: Ride, actor: Actor): "rider" | "driver" | null {
  if (actor.id === ride.riderId) return "rider";
  if (ride.driverId && actor.id === ride.driverId) return "driver";
  return null;
}

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim();

export async function listMessages(input: { actor: Actor; rideId: string }): Promise<RideMessageDTO[]> {
  const db = await getDb();
  const [ride] = await db.select().from(rides).where(eq(rides.id, input.rideId));
  if (!ride) throw notFound("הנסיעה לא נמצאה");
  const staff = input.actor.role === "admin" || input.actor.role === "support";
  if (!partyRole(ride, input.actor) && !staff) throw forbidden();
  const rows = await db
    .select({ m: rideMessages, name: users.name })
    .from(rideMessages)
    .innerJoin(users, eq(users.id, rideMessages.senderId))
    .where(eq(rideMessages.rideId, ride.id))
    .orderBy(asc(rideMessages.createdAt))
    .limit(200);
  return rows.map(({ m, name }) => ({ id: m.id, rideId: m.rideId, senderRole: m.senderRole, senderName: name.split(" ")[0], mine: m.senderId === input.actor.id, body: m.body, createdAt: m.createdAt.toISOString() }));
}

/** Sends a chat message; only the rider and the assigned driver, only while the ride is live. */
export async function sendMessage(input: { actor: Actor; rideId: string; body: string }): Promise<RideMessageDTO> {
  const body = clean(input.body);
  if (!body) throw badRequest("empty_message", "ההודעה ריקה");
  if (body.length > MESSAGE_MAX_CHARS) throw badRequest("message_too_long", `עד ${MESSAGE_MAX_CHARS} תווים`);
  const db = await getDb();
  const [ride] = await db.select().from(rides).where(eq(rides.id, input.rideId));
  if (!ride) throw notFound("הנסיעה לא נמצאה");
  const role = partyRole(ride, input.actor);
  if (!role) throw forbidden();
  if (!CHAT_OPEN.includes(ride.status)) throw conflict("chat_closed", "הצ׳אט פתוח רק בזמן שהנסיעה פעילה");
  const [m] = await db.insert(rideMessages).values({ rideId: ride.id, senderId: input.actor.id, senderRole: role, body }).returning();
  const base = { id: m.id, rideId: ride.id, senderRole: role, senderName: input.actor.name.split(" ")[0], body, createdAt: m.createdAt.toISOString() };
  publish(channels.user(ride.riderId), "ride.message", { rideId: ride.id, message: { ...base, mine: role === "rider" } });
  if (ride.driverId) publish(channels.user(ride.driverId), "ride.message", { rideId: ride.id, message: { ...base, mine: role === "driver" } });
  return { ...base, mine: true };
}

// ───────────────────────────── trip sharing ─────────────────────────────

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Creates a live link anyone can open to follow the ride (no prices, no phone numbers). */
export async function createShare(input: { rider: Actor; rideId: string }) {
  const db = await getDb();
  const [ride] = await db.select().from(rides).where(eq(rides.id, input.rideId));
  if (!ride) throw notFound("הנסיעה לא נמצאה");
  if (ride.riderId !== input.rider.id) throw forbidden();
  if (ride.status === "completed" || ride.status === "cancelled") throw conflict("ride_ended", "הנסיעה כבר הסתיימה");
  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS);
  await db.insert(rideShares).values({ rideId: ride.id, tokenHash: hashToken(token), createdBy: input.rider.id, expiresAt });
  await db.insert(rideEvents).values({ rideId: ride.id, type: "share_created", actorUserId: input.rider.id, actorRole: input.rider.role, data: {} });
  return { token, url: `${env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/t/${token}`, expiresAt: expiresAt.toISOString() };
}

export async function revokeShares(input: { rider: Actor; rideId: string }) {
  const db = await getDb();
  const [ride] = await db.select().from(rides).where(eq(rides.id, input.rideId));
  if (!ride) throw notFound("הנסיעה לא נמצאה");
  if (ride.riderId !== input.rider.id) throw forbidden();
  const revoked = await db
    .update(rideShares)
    .set({ revokedAt: new Date() })
    .where(and(eq(rideShares.rideId, ride.id), isNull(rideShares.revokedAt)))
    .returning({ id: rideShares.id });
  return { revoked: revoked.length };
}

/** What a share link shows. Null when the link is unknown, revoked or expired. */
export async function getSharedRide(token: string): Promise<SharedRideDTO | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const db = await getDb();
  const [share] = await db
    .select()
    .from(rideShares)
    .where(and(eq(rideShares.tokenHash, hashToken(token)), isNull(rideShares.revokedAt), gte(rideShares.expiresAt, new Date())));
  if (!share) return null;
  const [ride] = await db.select().from(rides).where(eq(rides.id, share.rideId));
  if (!ride) return null;
  const endedAt = ride.completedAt ?? ride.cancelledAt;
  if (endedAt && Date.now() - endedAt.getTime() > SHARE_AFTER_END_MS) return null;
  const [rider] = await db.select({ name: users.name }).from(users).where(eq(users.id, ride.riderId));
  const driver = ride.driverId ? (await db.select({ name: users.name }).from(users).where(eq(users.id, ride.driverId)))[0] : null;
  const profile = ride.driverId ? (await db.select().from(driverProfiles).where(eq(driverProfiles.userId, ride.driverId)))[0] : null;
  const live = ride.status === "accepted" || ride.status === "driver_arriving" || ride.status === "in_progress";
  return {
    status: ride.status,
    riderFirstName: rider?.name.split(" ")[0] ?? "",
    driverFirstName: driver?.name.split(" ")[0] ?? null,
    vehicle: profile ? { make: profile.vehicleMake, model: profile.vehicleModel, color: profile.vehicleColor, plate: profile.vehiclePlate } : null,
    pickup: { lat: ride.pickupLat, lng: ride.pickupLng, address: ride.pickupAddress },
    dropoff: { lat: ride.dropoffLat, lng: ride.dropoffLng, address: ride.dropoffAddress },
    polyline: ride.polyline,
    driverLocation: live && profile?.lastLat != null && profile.lastLng != null ? { lat: profile.lastLat, lng: profile.lastLng, heading: profile.lastHeading ?? null, at: (profile.lastLocationAt ?? new Date()).toISOString() } : null,
    startedAt: ride.startedAt?.toISOString() ?? null,
    completedAt: ride.completedAt?.toISOString() ?? null,
    estimatedDurationS: ride.estimatedDurationS,
    expiresAt: share.expiresAt.toISOString(),
  };
}
