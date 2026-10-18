import { route, type Ctx } from "@/server/api";
import { requireUser } from "@/server/auth/guards";
import { notFound } from "@/server/errors";
import { trafficTile } from "@/server/geo/traffic-tiles";
import { rateLimit } from "@/server/security/rate-limit";

/** Live traffic overlay tile, proxied so the provider key stays on the server. */
export const GET = route(async (_req, ctx: Ctx<{ z: string; x: string; y: string }>) => {
  const user = await requireUser();
  rateLimit(`traffic-tiles:${user.id}`, 1200, 60_000);
  const p = await ctx.params;
  const tile = await trafficTile(Number(p.z), Number(p.x), Number(p.y.replace(/\.png$/, "")));
  if (!tile) throw notFound("אין שכבת תנועה");
  return new Response(tile.body, { status: 200, headers: { "Content-Type": tile.type, "Cache-Control": "private, max-age=60" } });
});
