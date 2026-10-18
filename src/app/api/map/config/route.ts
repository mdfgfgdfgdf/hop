import { ok, route } from "@/server/api";
import { env, trafficRouter, trafficTilesEnabled } from "@/server/env";

/** What the map can show: live traffic overlay and which router prices routes. No secrets. */
export const GET = route(async () => {
  return ok({
    trafficTiles: trafficTilesEnabled(),
    trafficRouting: trafficRouter(),
    geoProvider: env().GEO_PROVIDER === "demo" ? "demo" : "osm",
  });
});
