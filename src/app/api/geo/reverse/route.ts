import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { geo } from "@/server/geo";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

const schema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const GET = route(async (req) => {
  await requireUser();
  rateLimit(`geo:${clientIp(req)}`, 120, 60_000);
  const point = parseQuery(req, schema);
  const place = await geo().reverse(point);
  return ok({ place, provider: geo().name });
});
