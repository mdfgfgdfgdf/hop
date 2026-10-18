import { z } from "zod";
import { created, ok, parseBody, parseQuery, route } from "@/server/api";
import { requireRider, requireUser } from "@/server/auth/guards";
import { createRide, listRidesFor } from "@/server/dispatch/service";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

const createSchema = z.object({
  quoteId: z.string().min(1),
  paymentMethod: z.enum(["cash", "card_demo"]).default("cash"),
});

export const POST = route(async (req) => {
  const rider = await requireRider();
  rateLimit(`ride-create:${rider.id}`, 10, 60_000);
  rateLimit(`ride-create-ip:${clientIp(req)}`, 30, 60_000);
  const input = await parseBody(req, createSchema);
  const ride = await createRide({ rider, quoteId: input.quoteId, paymentMethod: input.paymentMethod });
  return created({ ride });
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export const GET = route(async (req) => {
  const user = await requireUser(["rider", "driver"]);
  const q = parseQuery(req, listSchema);
  const rides = await listRidesFor(user, q);
  return ok({ rides });
});
