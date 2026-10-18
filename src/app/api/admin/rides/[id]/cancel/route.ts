import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireStaff } from "@/server/auth/guards";
import { cancelRide } from "@/server/dispatch/service";
import { clientIp } from "@/server/security/rate-limit";

const schema = z.object({ reason: z.string().trim().min(2).max(300) });

export const POST = route<{ id: string }>(async (req, ctx) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  const input = await parseBody(req, schema);
  return ok({ ride: await cancelRide({ actor: staff, rideId: id, reason: input.reason, ip: clientIp(req) }) });
});
