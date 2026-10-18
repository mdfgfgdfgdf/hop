import { z } from "zod";
import { ok, parseBody, route } from "@/server/api";
import { requireRider } from "@/server/auth/guards";
import { createQuotes } from "@/server/dispatch/service";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

const point = z.object({
  lat: z.number().min(29).max(34),
  lng: z.number().min(34).max(36),
  address: z.string().trim().min(1).max(200),
  name: z.string().trim().max(120).optional(),
  id: z.string().max(80).optional(),
  provider: z.enum(["demo", "osm"]).optional(),
});

const schema = z.object({
  pickup: point,
  dropoff: point,
  promoCode: z.string().trim().max(32).optional().nullable(),
});

export const POST = route(async (req) => {
  const rider = await requireRider();
  rateLimit(`quotes:${rider.id}`, 60, 60_000);
  rateLimit(`quotes-ip:${clientIp(req)}`, 120, 60_000);
  const input = await parseBody(req, schema);
  const result = await createQuotes({ rider, pickup: input.pickup, dropoff: input.dropoff, promoCode: input.promoCode ?? null });
  return ok(result);
});
