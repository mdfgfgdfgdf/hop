import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { geo } from "@/server/geo";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

const schema = z.object({
  q: z.string().trim().min(1).max(120),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const GET = route(async (req) => {
  await requireUser();
  rateLimit(`geo:${clientIp(req)}`, 120, 60_000);
  const { q, lat, lng } = parseQuery(req, schema);
  const near = lat != null && lng != null ? { lat, lng } : undefined;
  const places = await geo().search(q, near, 8);
  return ok({ places, provider: geo().name });
});
