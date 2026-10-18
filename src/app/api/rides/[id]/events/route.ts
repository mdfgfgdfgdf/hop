import { asc, eq } from "drizzle-orm";
import { ok, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { getDb } from "@/server/db/client";
import { rideEvents, rides } from "@/server/db/schema";
import { assertCanView } from "@/server/dispatch/service";
import { serializeRideEvent } from "@/server/dispatch/serialize";
import { notFound } from "@/server/errors";

export const GET = route<{ id: string }>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const db = await getDb();
  const [ride] = await db.select().from(rides).where(eq(rides.id, id));
  if (!ride) throw notFound();
  assertCanView(ride, user);
  const events = await db.select().from(rideEvents).where(eq(rideEvents.rideId, id)).orderBy(asc(rideEvents.createdAt));
  return ok({ events: events.map(serializeRideEvent) });
});
