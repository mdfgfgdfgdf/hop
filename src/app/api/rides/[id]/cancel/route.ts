import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { cancelRide } from "@/server/dispatch/service";
import { clientIp } from "@/server/security/rate-limit";

const schema = z.object({ reason: z.string().trim().max(300).optional().nullable() }).default({});

export const POST = route<{ id: string }>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await req.text();
  const input = schema.parse(body ? JSON.parse(body) : {});
  const ride = await cancelRide({ actor: user, rideId: id, reason: input.reason ?? null, ip: clientIp(req) });
  return ok({ ride });
});

// keep parseBody import pattern consistent for other routes
void parseBody;
