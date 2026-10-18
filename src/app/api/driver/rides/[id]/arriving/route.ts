import { ok, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { driverArriving } from "@/server/dispatch/service";

export const POST = route<{ id: string }>(async (_req, ctx) => {
  const driver = await requireDriver();
  const { id } = await ctx.params;
  const ride = await driverArriving({ driver, rideId: id });
  return ok({ ride });
});
