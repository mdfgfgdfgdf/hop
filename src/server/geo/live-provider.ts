/**
 * Live geo provider — real map data, no API keys required:
 *   search   → Photon (komoot)        built for search-as-you-type (Nominatim forbids autocomplete)
 *   reverse  → Nominatim (OSM)        accept-language=he, ≤ 1 request/second as its policy requires
 *   route    → OSRM                   real road distance, duration and geometry
 *
 * Every call has a timeout, results are cached, and a circuit breaker skips a
 * service for a while after it fails. When a live call fails the demo provider
 * answers instead and the result is tagged provider: "demo", so the UI can say
 * "estimated" honestly. Point PHOTON_URL / NOMINATIM_URL / OSRM_URL at your own
 * instances before real traffic — the public servers are for light use only.
 */
import type { LatLng } from "../db/schema";
import { env } from "../env";
import { DemoGeoProvider } from "./demo-provider";
import type { GeoProvider, Place, RouteResult } from "./types";

const ISRAEL_BBOX = { minLng: 34.2, minLat: 29.4, maxLng: 35.95, maxLat: 33.35 };
const TIMEOUT_MS = 3500;

// ───────────────────────────── small infrastructure ─────────────────────────────

class TtlCache<V> {
  private map = new Map<string, { v: V; exp: number }>();
  constructor(private ttlMs: number, private max = 2000) {}
  get(k: string): V | undefined {
    const hit = this.map.get(k);
    if (!hit) return undefined;
    if (hit.exp < Date.now()) {
      this.map.delete(k);
      return undefined;
    }
    return hit.v;
  }
  set(k: string, v: V) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value as string);
    this.map.set(k, { v, exp: Date.now() + this.ttlMs });
  }
}

/** Opens after a failure and stays open for `coolMs`; while open, calls go straight to the fallback. */
class Breaker {
  private openUntil = 0;
  constructor(private coolMs: number) {}
  get open() {
    return Date.now() < this.openUntil;
  }
  trip() {
    this.openUntil = Date.now() + this.coolMs;
  }
  reset() {
    this.openUntil = 0;
  }
}

/** Serialises calls so they are at least `gapMs` apart (Nominatim: max 1 req/s). */
class Throttle {
  private next = 0;
  constructor(private gapMs: number) {}
  async wait() {
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + this.gapMs;
    if (at > now) await new Promise((r) => setTimeout(r, at - now));
  }
}

function userAgent() {
  return `HOP/0.1 (+${env().NEXT_PUBLIC_APP_URL}; ${env().HOP_GEO_CONTACT})`;
}

async function getJson<T>(url: URL, fetchImpl: typeof fetch): Promise<T> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": userAgent(), Accept: "application/json", "Accept-Language": "he,en;q=0.5" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url.host} ${res.status}`);
  return (await res.json()) as T;
}

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

// ───────────────────────────── response shapes ─────────────────────────────

type PhotonFeature = {
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    locality?: string;
    district?: string;
    county?: string;
    countrycode?: string;
  };
};

type NominatimRow = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  category?: string;
  type?: string;
  address?: Record<string, string>;
  error?: string;
};

type OsrmResponse = {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
};

// ───────────────────────────── mappers (exported for tests) ─────────────────────────────

export function photonToPlace(f: PhotonFeature): Place | null {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const city = p.city ?? p.town ?? p.village ?? p.locality ?? p.district ?? p.county;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const name = p.name || street || city;
  if (!name) return null;
  // Named place: "street, city" underneath; plain address: just the city.
  const address = p.name ? [street, city].filter(Boolean).join(", ") || city || name : city || name;
  const transit = p.osm_key === "railway" || p.osm_value === "bus_station" || p.osm_value === "aerodrome" || p.osm_value === "station";
  return {
    id: `ph-${p.osm_type ?? "x"}${p.osm_id ?? `${round(lat)},${round(lng)}`}`,
    name,
    address,
    city,
    lat,
    lng,
    kind: transit ? "transit" : !p.name && street ? "address" : p.type === "city" ? "city" : "poi",
    provider: "osm",
  };
}

export function nominatimToPlace(r: NominatimRow, point?: LatLng): Place {
  const a = r.address ?? {};
  const street = [a.road ?? a.pedestrian ?? a.footway, a.house_number].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.suburb ?? "";
  const name = r.name || street || r.display_name.split(",")[0];
  return {
    id: `nm-${r.place_id}`,
    name,
    address: [street && street !== name ? street : "", city].filter(Boolean).join(", ") || r.display_name.split(",").slice(0, 2).join(","),
    city: city || undefined,
    lat: point?.lat ?? parseFloat(r.lat),
    lng: point?.lng ?? parseFloat(r.lon),
    kind: street && !r.name ? "address" : "poi",
    provider: "osm",
  };
}

export function osrmToRoute(json: OsrmResponse): RouteResult {
  const r = json.routes?.[0];
  if (json.code !== "Ok" || !r) throw new Error(`osrm ${json.code}`);
  return {
    distanceM: Math.round(r.distance),
    durationS: Math.round(r.duration),
    polyline: r.geometry.coordinates.map(([lng, lat]) => [round(lat, 6), round(lng, 6)] as [number, number]),
    provider: "osm",
  };
}

// ───────────────────────────── provider ─────────────────────────────

export class LiveGeoProvider implements GeoProvider {
  readonly name = "osm" as const;
  private fallback = new DemoGeoProvider();
  private searchCache = new TtlCache<Place[]>(10 * 60_000);
  private reverseCache = new TtlCache<Place | null>(60 * 60_000);
  private routeCache = new TtlCache<RouteResult>(10 * 60_000);
  private photon = new Breaker(60_000);
  private nominatim = new Breaker(60_000);
  private osrm = new Breaker(60_000);
  private nominatimGate = new Throttle(1100);

  constructor(private fetchImpl: typeof fetch = (...args) => fetch(...args)) {}

  async search(query: string, near?: LatLng, limit = 8): Promise<Place[]> {
    const q = query.trim();
    if (!q) return [];
    const key = `${q}|${near ? `${near.lat.toFixed(2)},${near.lng.toFixed(2)}` : ""}|${limit}`;
    const hit = this.searchCache.get(key);
    if (hit) return hit;
    if (!this.photon.open) {
      try {
        const url = new URL("/api/", env().PHOTON_URL);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", String(Math.min(limit * 2, 20)));
        url.searchParams.set("bbox", `${ISRAEL_BBOX.minLng},${ISRAEL_BBOX.minLat},${ISRAEL_BBOX.maxLng},${ISRAEL_BBOX.maxLat}`);
        if (near) {
          url.searchParams.set("lat", String(near.lat));
          url.searchParams.set("lon", String(near.lng));
          url.searchParams.set("location_bias_scale", "0.4");
        }
        const json = await getJson<{ features?: PhotonFeature[] }>(url, this.fetchImpl);
        const seen = new Set<string>();
        const places = (json.features ?? [])
          .filter((f) => !f.properties.countrycode || f.properties.countrycode.toUpperCase() === "IL")
          .map(photonToPlace)
          .filter((p): p is Place => !!p)
          .filter((p) => {
            const k = `${p.name}|${p.address}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .slice(0, limit);
        this.photon.reset();
        this.searchCache.set(key, places);
        return places;
      } catch (err) {
        this.photon.trip();
        console.warn("[geo] photon unavailable, using offline places:", (err as Error).message);
      }
    }
    return this.fallback.search(q, near, limit);
  }

  async reverse(point: LatLng): Promise<Place | null> {
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`;
    const hit = this.reverseCache.get(key);
    if (hit !== undefined) return hit;
    if (!this.nominatim.open) {
      try {
        await this.nominatimGate.wait();
        const url = new URL("/reverse", env().NOMINATIM_URL);
        url.searchParams.set("lat", String(point.lat));
        url.searchParams.set("lon", String(point.lng));
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("zoom", "18");
        url.searchParams.set("accept-language", "he");
        const row = await getJson<NominatimRow>(url, this.fetchImpl);
        const place = row.error ? null : nominatimToPlace(row, point);
        this.nominatim.reset();
        this.reverseCache.set(key, place);
        return place;
      } catch (err) {
        this.nominatim.trip();
        console.warn("[geo] nominatim unavailable, using offline places:", (err as Error).message);
      }
    }
    return this.fallback.reverse(point);
  }

  async route(from: LatLng, to: LatLng): Promise<RouteResult> {
    const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}>${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    const hit = this.routeCache.get(key);
    if (hit) return hit;
    if (!this.osrm.open) {
      try {
        const url = new URL(`/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}`, env().OSRM_URL);
        url.searchParams.set("overview", "full");
        url.searchParams.set("geometries", "geojson");
        url.searchParams.set("alternatives", "false");
        const route = osrmToRoute(await getJson<OsrmResponse>(url, this.fetchImpl));
        this.osrm.reset();
        this.routeCache.set(key, route);
        return route;
      } catch (err) {
        this.osrm.trip();
        console.warn("[geo] OSRM unavailable, using an estimated route:", (err as Error).message);
      }
    }
    return this.fallback.route(from, to);
  }
}
