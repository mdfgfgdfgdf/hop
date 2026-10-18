import { z } from "zod";
import { ok, parseQuery, route } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { geo } from "@/server/geo";
import { rateLimit } from "@/server/security/rate-limit";

const coord = z.coerce.number();
const schema = z.object({
  fromLat: coord.min(29).max(34),
  fromLng: coord.min(34).max(36),
  toLat: coord.min(29).max(34),
  toLng: coord.min(34).max(36),
});

/**
 * A road route between two points in Israel (with live traffic when a
 * traffic-aware router is configured). Used for driver navigation to the
 * pickup and for live ETAs; prices are never computed from it.
 */
export const GET = route(async (req) => {
  const user = await requireUser(["rider", "driver"]);
  rateLimit(`route:${user.id}`, 30, 60_000);
  const q = parseQuery(req, schema);
  const r = await geo().route({ lat: q.fromLat, lng: q.fromLng }, { lat: q.toLat, lng: q.toLng });
  return ok({ route: { distanceM: r.distanceM, durationS: r.durationS, polyline: r.polyline, provider: r.provider, traffic: r.traffic ?? null } });
});
