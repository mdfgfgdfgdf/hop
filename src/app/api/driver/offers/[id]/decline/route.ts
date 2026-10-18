import { ok, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { respondToOffer } from "@/server/dispatch/service";

/** [id] is the ride id. */
export const POST = route<{ id: string }>(async (_req, ctx) => {
  const driver = await requireDriver();
  const { id } = await ctx.params;
  const ride = await respondToOffer({ driver, rideId: id, accept: false });
  return ok({ ride });
});
