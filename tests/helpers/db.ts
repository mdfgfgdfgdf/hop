/**
 * Test helpers: fresh in-memory PGlite database per test file, factories for
 * users/drivers, and direct calls into the service layer (no HTTP).
 */
import { eq } from "drizzle-orm";
import { closeDb, getDb, type Db } from "@/server/db/client";
import { driverProfiles, users, type User, type VehicleClass } from "@/server/db/schema";
import { seedBaseline } from "@/server/db/seed";
import { hashPassword } from "@/server/auth/password";

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
      passwordHash: await hashPassword("Password1!"),
      ...rest,
    })
    .returning();
  return u;
}

export async function makeDriver(
  db: Db,
  opts: { lat?: number; lng?: number; vehicleClass?: VehicleClass; approved?: boolean; online?: boolean; name?: string } = {},
) {
  const user = await makeUser(db, "driver", { name: opts.name });
  await db.insert(driverProfiles).values({
    userId: user.id,
    verificationStatus: opts.approved === false ? "under_review" : "approved",
    availability: opts.online === false ? "offline" : "online",
    vehicleClass: opts.vehicleClass ?? "standard",
    vehicleMake: "Toyota",
    vehicleModel: "Corolla",
    vehicleColor: "white",
    vehiclePlate: `12-345-${counter}`,
    lastLat: opts.lat ?? 32.075,
    lastLng: opts.lng ?? 34.775,
    lastLocationAt: new Date(),
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
