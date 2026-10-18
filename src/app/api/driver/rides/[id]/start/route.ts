import { z } from "zod";
import { ok, route } from "@/server/api";
import { requireDriver } from "@/server/auth/guards";
import { startRide } from "@/server/dispatch/service";

const schema = z.object({ pin: z.string().regex(/^\d{4}$/).nullish() });

export const POST = route<{ id: string }>(async (req, ctx) => {
  const driver = await requireDriver();
  const { id } = await ctx.params;
  // The body is optional (no pickup code required by default).
  const text = await req.text();
  const { pin } = schema.parse(text ? JSON.parse(text) : {});
  const ride = await startRide({ driver, rideId: id, pin });
  return ok({ ride });
});
