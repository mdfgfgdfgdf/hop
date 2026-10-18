import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireRider } from "@/server/auth/guards";
import { nearbyCars } from "@/server/dispatch/service";
import { rateLimit } from "@/server/security/rate-limit";

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** Anonymous available cars around a point (rider map). */
export const GET = route(async (req) => {
  const rider = await requireRider();
  rateLimit(`nearby:${rider.id}`, 60, 60_000);
  const at = parseQuery(req, schema);
  return ok({ cars: await nearbyCars(at) });
});
