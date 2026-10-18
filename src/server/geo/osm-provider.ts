/**
 * Real-data provider: OpenStreetMap Nominatim (geocoding) + OSRM (routing).
 * Public demo servers are rate-limited; set NOMINATIM_URL / OSRM_URL to your
 * own instances for anything beyond a pilot. Falls back to the demo estimate
 * for routing when OSRM is unreachable (tagged as demo).
 */
import type { LatLng } from "../db/schema";
import { env } from "../env";
import { estimateRoute } from "./demo-provider";
import type { GeoProvider, Place, RouteResult } from "./types";

const UA = "HOP-ride-hailing-dev/0.1 (contact: ops@hop.local)";

type NominatimRow = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: Record<string, string>;
  class?: string;
};

function toPlace(r: NominatimRow): Place {
  const a = r.address ?? {};
  const street = [a.road, a.house_number].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
  const name = r.name || street || r.display_name.split(",")[0];
  return {
    id: `osm-${r.place_id}`,
    name,
    address: [street || name, city].filter(Boolean).join(", "),
    city,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    kind: r.class === "highway" || r.class === "place" ? "address" : "poi",
    provider: "osm",
  };
}

export class OsmGeoProvider implements GeoProvider {
  readonly name = "osm" as const;

  async search(query: string, near?: LatLng, limit = 8): Promise<Place[]> {
    const url = new URL("/search", env().NOMINATIM_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("countrycodes", "il");
    url.searchParams.set("accept-language", "he");
    url.searchParams.set("limit", String(limit));
    if (near) {
      const d = 0.4;
      url.searchParams.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    }
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`nominatim ${res.status}`);
    const rows = (await res.json()) as NominatimRow[];
    return rows.map(toPlace);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    const url = new URL("/reverse", env().NOMINATIM_URL);
    url.searchParams.set("lat", String(point.lat));
    url.searchParams.set("lon", String(point.lng));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "he");
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const row = (await res.json()) as NominatimRow & { error?: string };
    if (row.error) return null;
    return { ...toPlace(row), lat: point.lat, lng: point.lng };
  }

  async route(from: LatLng, to: LatLng): Promise<RouteResult> {
    try {
      const url = new URL(
        `/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`,
        env().OSRM_URL,
      );
      url.searchParams.set("overview", "full");
      url.searchParams.set("geometries", "geojson");
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`osrm ${res.status}`);
      const json = (await res.json()) as {
        code: string;
        routes: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
      };
      const r = json.routes?.[0];
      if (json.code !== "Ok" || !r) throw new Error("osrm no route");
      return {
        distanceM: Math.round(r.distance),
        durationS: Math.round(r.duration),
        polyline: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        provider: "osm",
      };
    } catch (err) {
      console.warn("[geo] OSRM unavailable, falling back to demo estimate:", (err as Error).message);
      return estimateRoute(from, to);
    }
  }
}
