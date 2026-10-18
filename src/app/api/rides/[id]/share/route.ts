import { created, ok, route } from "@/server/api";
import { requireRider } from "@/server/auth/guards";
import { createShare, revokeShares } from "@/server/rides/extras";
import { rateLimit } from "@/server/security/rate-limit";

/** Creates a live trip-sharing link (rider of an active ride). */
export const POST = route<{ id: string }>(async (_req, ctx) => {
  const rider = await requireRider();
  rateLimit(`share:${rider.id}`, 10, 60_000);
  const { id } = await ctx.params;
  return created(await createShare({ rider, rideId: id }));
});

/** Stops every sharing link of the ride. */
export const DELETE = route<{ id: string }>(async (_req, ctx) => {
  const rider = await requireRider();
  const { id } = await ctx.params;
  return ok(await revokeShares({ rider, rideId: id }));
});
