import { eq } from "drizzle-orm";
import { ok, parseBody, route } from "@/server/api";
import { getCurrentUser, requestMeta } from "@/server/auth/session";
import { publicUser, requireUser } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { driverProfiles, users } from "@/server/db/schema";
import { serializeDriverProfile } from "@/server/dispatch/serialize";
import { isDemoMode } from "@/server/env";
import { z } from "zod";
import { audit } from "@/server/audit";

export const GET = route(async () => {
  const user = await getCurrentUser();
  if (!user) return ok({ user: null, demoMode: isDemoMode() });
  let driverProfile = null;
  if (user.role === "driver") {
    const db = await getDb();
    const [p] = await db.select().from(driverProfiles).where(eq(driverProfiles.userId, user.id));
    driverProfile = p ? serializeDriverProfile(p) : null;
  }
  return ok({ user: publicUser(user), driverProfile, demoMode: isDemoMode() });
});

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().min(9).max(16).optional(),
  locale: z.enum(["he", "en"]).optional(),
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, patchSchema);
  const db = await getDb();
  const [updated] = await db.update(users).set(input).where(eq(users.id, user.id)).returning();
  await audit({ actorId: user.id, actorRole: user.role, action: "user.update_profile", targetType: "user", targetId: user.id, data: { fields: Object.keys(input) }, ip: (await requestMeta()).ip });
  return ok({ user: publicUser(updated) });
});
