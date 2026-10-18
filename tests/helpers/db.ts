/**
 * Test helpers: fresh in-memory PGlite database per test file, factories for
 * users/drivers, and direct calls into the service layer (no HTTP).
 */
import { eq, inArray } from "drizzle-orm";
import { closeDb, getDb, type Db } from "@/server/db/client";
import {
  driverProfiles,
  rides,
  users,
  type DriverProfile,
  type Ride,
  type User,
  type VehicleClass,
  type VerificationStatus,
} from "@/server/db/schema";
import { seedBaseline } from "@/server/db/seed";
import { hashPassword } from "@/server/auth/password";
import { ACTIVE_STATUSES } from "@/server/dispatch/states";

/** Password every factory-made user gets (see `makeUser`). */
export const TEST_PASSWORD = "Password1!";

// Argon2 is deliberately slow; hash the shared test password once per file.
let passwordHash: Promise<string> | null = null;
const testPasswordHash = () => (passwordHash ??= hashPassword(TEST_PASSWORD));

export async function freshDb(): Promise<Db> {
  await closeDb();
  process.env.DATABASE_URL = "memory://";
  process.env.DB_AUTO_MIGRATE = "true";
  process.env.DB_AUTO_SEED = "false";
  process.env.HOP_DEMO_MODE = "false";
  const db = await getDb();
  await seedBaseline(db);
  return db;
}

let counter = 0;

export async function makeUser(db: Db, role: User["role"], overrides: Partial<typeof users.$inferInsert> = {}): Promise<User> {
  counter += 1;
  const { name, email, phone, ...rest } = overrides;
  const [u] = await db
    .insert(users)
    .values({
      role,
      name: name ?? `${role} ${counter}`,
      email: email ?? `${role}${counter}-${Date.now()}@test.local`,
      phone: phone ?? `05000${String(counter).padStart(5, "0")}`,
      passwordHash: await testPasswordHash(),
      ...rest,
    })
    .returning();
  return u;
}

export async function makeDriver(
  db: Db,
  opts: {
    lat?: number;
    lng?: number;
    vehicleClass?: VehicleClass;
    approved?: boolean;
    online?: boolean;
    name?: string;
    isDemo?: boolean;
    verificationStatus?: VerificationStatus;
    lastLocationAt?: Date | null;
  } = {},
) {
  const user = await makeUser(db, "driver", { name: opts.name, isDemo: opts.isDemo ?? false });
  await db.insert(driverProfiles).values({
    userId: user.id,
    verificationStatus: opts.verificationStatus ?? (opts.approved === false ? "under_review" : "approved"),
    availability: opts.online === false ? "offline" : "online",
    vehicleClass: opts.vehicleClass ?? "standard",
    vehicleMake: "Toyota",
    vehicleModel: "Corolla",
    vehicleColor: "white",
    vehiclePlate: `12-345-${counter}`,
    lastLat: opts.lat ?? 32.075,
    lastLng: opts.lng ?? 34.775,
    lastLocationAt: opts.lastLocationAt === undefined ? new Date() : opts.lastLocationAt,
  });
  const [profile] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, user.id));
  return { user, profile };
}

export const TLV = {
  dizengoff: { lat: 32.0752, lng: 34.7751, address: "דיזנגוף סנטר, תל אביב" },
  rabin: { lat: 32.0807, lng: 34.7805, address: "כיכר רבין, תל אביב" },
  airport: { lat: 32.0004, lng: 34.8706, address: "נתב\"ג" },
  jerusalem: { lat: 31.7892, lng: 35.2031, address: "ירושלים" },
};

/** Current database row of a ride. */
export async function rideRow(db: Db, rideId: string): Promise<Ride> {
  const [row] = await db.select().from(rides).where(eq(rides.id, rideId));
  if (!row) throw new Error(`ride ${rideId} not found`);
  return row;
}

/** Current database row of a driver profile. */
export async function profileRow(db: Db, userId: string): Promise<DriverProfile> {
  const [row] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, userId));
  if (!row) throw new Error(`driver profile ${userId} not found`);
  return row;
}

/**
 * Isolation for dispatch tests that share one database: closes every active
 * ride left behind by earlier tests and takes every driver offline, so the
 * next test only sees the drivers it creates itself.
 */
export async function resetDispatch(db: Db) {
  await db
    .update(rides)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelledBy: "system", cancelReason: "test_reset", offeredDriverId: null, offerExpiresAt: null })
    .where(inArray(rides.status, [...ACTIVE_STATUSES]));
  await db.update(driverProfiles).set({ availability: "offline" });
}
