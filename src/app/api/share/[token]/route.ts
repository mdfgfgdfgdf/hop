import { ok, route } from "@/server/api";
import { notFound } from "@/server/errors";
import { getSharedRide } from "@/server/rides/extras";
import { clientIp, rateLimit } from "@/server/security/rate-limit";

/** Public: what a trip-sharing link shows (no prices, no phone numbers). */
export const GET = route<{ token: string }>(async (req, ctx) => {
  rateLimit(`share-view:${clientIp(req)}`, 120, 60_000);
  const { token } = await ctx.params;
  const ride = await getSharedRide(token);
  if (!ride) throw notFound("הקישור אינו בתוקף");
  return ok({ ride }, { headers: { "Cache-Control": "no-store" } });
});
