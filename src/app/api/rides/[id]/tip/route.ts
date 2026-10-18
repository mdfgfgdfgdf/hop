import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireRider } from "@/server/auth/guards";
import { addTip } from "@/server/rides/extras";

const schema = z.object({ amountAgorot: z.number().int() });

/** Tip after a completed ride (once, within 7 days, 100 % to the driver). */
export const POST = route<{ id: string }>(async (req, ctx) => {
  const rider = await requireRider();
  const { id } = await ctx.params;
  const { amountAgorot } = await parseBody(req, schema);
  return ok(await addTip({ rider, rideId: id, amountAgorot }));
});
