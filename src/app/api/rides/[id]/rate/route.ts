import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { rateRide } from "@/server/dispatch/service";

const schema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().nullable(),
});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireUser(["rider", "driver"]);
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  const ride = await rateRide({ actor: user, rideId: id, stars: input.stars, comment: input.comment ?? null });
  return ok({ ride });
});
