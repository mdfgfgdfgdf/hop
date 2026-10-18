import { eq } from "drizzle-orm";
import type { LatLng } from "../db/schema";
import { getDb } from "../db/client";
import { serviceAreas } from "../db/schema";
import { env } from "../env";
import { DemoGeoProvider } from "./demo-provider";
import { pointInRing } from "./haversine";
import { OsmGeoProvider } from "./osm-provider";
import type { GeoProvider } from "./types";

let provider: GeoProvider | null = null;

export function geo(): GeoProvider {
  if (!provider) provider = env().GEO_PROVIDER === "osm" ? new OsmGeoProvider() : new DemoGeoProvider();
  return provider;
}

/** True when the point lies inside at least one active service area. */
export async function isInServiceArea(point: LatLng): Promise<boolean> {
  const db = await getDb();
  const areas = await db.select().from(serviceAreas).where(eq(serviceAreas.active, true));
  if (areas.length === 0) return true; // no areas configured → unrestricted (dev)
  return areas.some((a) => a.polygon.coordinates.some((ring) => pointInRing(point, ring)));
}

export * from "./types";
export { haversineM, bearingDeg, pointAlong, polylineLengthM } from "./haversine";
