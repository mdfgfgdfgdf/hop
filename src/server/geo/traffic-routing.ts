/**
 * Traffic-aware routing adapters. Each turns one provider's response into a
 * RouteResult whose duration includes live traffic and whose `traffic` field
 * lists congested stretches of the polyline (free flow is omitted):
 *
 *   google  → Routes API computeRoutes, TRAFFIC_AWARE_OPTIMAL + TRAFFIC_ON_POLYLINE
 *   mapbox  → Directions API, driving-traffic profile + congestion annotations
 *   tomtom  → Routing API calculateRoute, traffic=true + sectionType=traffic
 *
 * Keys come from the server environment only. The mappers are pure and unit
 * tested against the documented response shapes.
 */
import type { LatLng } from "../db/schema";
import type { RouteResult, RouteTraffic, TrafficLevel, TrafficSpan } from "./types";

const TIMEOUT_MS = 4000;

export type TrafficRouterName = RouteTraffic["source"];

/** Google encoded polyline (precision 5) → [lat, lng][]. */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const out: [number, number][] = [];
  let lat = 0;
  let lng = 0;
  let i = 0;
  while (i < encoded.length) {
    for (const axis of [0, 1]) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20); // past the end charCodeAt is NaN, which ends the loop
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

/** Merges touching spans of the same level and drops empty ones. */
export function normaliseSpans(spans: TrafficSpan[], points: number): TrafficSpan[] {
  const sorted = spans
    .map((s) => ({ ...s, from: Math.max(0, s.from), to: Math.min(points - 1, s.to) }))
    .filter((s) => s.to > s.from)
    .sort((a, b) => a.from - b.from);
  const out: TrafficSpan[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && last.level === s.level && s.from <= last.to) last.to = Math.max(last.to, s.to);
    else out.push({ ...s });
  }
  return out;
}

const seconds = (v: string | number | undefined) => (typeof v === "number" ? v : v ? Number.parseFloat(v) : NaN);

// ───────────────────────────── Google Routes API ─────────────────────────────

export type GoogleRoutesResponse = {
  routes?: {
    distanceMeters?: number;
    duration?: string; // "1234s"
    staticDuration?: string;
    polyline?: { encodedPolyline?: string };
    travelAdvisory?: { speedReadingIntervals?: { startPolylinePointIndex?: number; endPolylinePointIndex?: number; speed?: "SPEED_UNSPECIFIED" | "NORMAL" | "SLOW" | "TRAFFIC_JAM" }[] };
  }[];
};

const GOOGLE_SPEED: Record<string, TrafficLevel | null> = { NORMAL: null, SPEED_UNSPECIFIED: null, SLOW: "moderate", TRAFFIC_JAM: "heavy" };

export function googleToRoute(json: GoogleRoutesResponse, at = new Date()): RouteResult {
  const r = json.routes?.[0];
  const encoded = r?.polyline?.encodedPolyline;
  if (!r || !encoded) throw new Error("google: no route");
  const polyline = decodePolyline(encoded);
  const spans: TrafficSpan[] = [];
  for (const iv of r.travelAdvisory?.speedReadingIntervals ?? []) {
    const level = GOOGLE_SPEED[iv.speed ?? "NORMAL"];
    // proto3 JSON omits zero, so a missing start index means 0.
    if (level) spans.push({ from: iv.startPolylinePointIndex ?? 0, to: iv.endPolylinePointIndex ?? 0, level });
  }
  const durationS = Math.round(seconds(r.duration));
  const staticS = Math.round(seconds(r.staticDuration));
  if (!Number.isFinite(durationS)) throw new Error("google: no duration");
  return {
    distanceM: Math.round(r.distanceMeters ?? 0),
    durationS,
    polyline,
    provider: "osm",
    traffic: { source: "google", durationNoTrafficS: Number.isFinite(staticS) ? staticS : null, spans: normaliseSpans(spans, polyline.length), at: at.toISOString() },
  };
}

async function googleRoute(from: LatLng, to: LatLng, key: string, fetchImpl: typeof fetch): Promise<RouteResult> {
  const res = await fetchImpl("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline,routes.travelAdvisory.speedReadingIntervals",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE_OPTIMAL",
      extraComputations: ["TRAFFIC_ON_POLYLINE"],
      languageCode: "he",
      regionCode: "IL",
      units: "METRIC",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`google ${res.status}`);
  return googleToRoute((await res.json()) as GoogleRoutesResponse);
}

// ───────────────────────────── Mapbox Directions ─────────────────────────────

export type MapboxDirectionsResponse = {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    duration_typical?: number;
    geometry?: { type: "LineString"; coordinates: [number, number][] };
    legs?: { annotation?: { congestion?: ("unknown" | "low" | "moderate" | "heavy" | "severe")[] } }[];
  }[];
};

const MAPBOX_LEVEL: Record<string, TrafficLevel | null> = { unknown: null, low: null, moderate: "moderate", heavy: "heavy", severe: "severe" };

export function mapboxToRoute(json: MapboxDirectionsResponse, at = new Date()): RouteResult {
  const r = json.routes?.[0];
  if (json.code && json.code !== "Ok") throw new Error(`mapbox: ${json.code}`);
  if (!r?.geometry?.coordinates?.length || r.duration == null) throw new Error("mapbox: no route");
  const polyline = r.geometry.coordinates.map(([lng, lat]) => [lat, lng] as [number, number]);
  // One congestion value per segment (point i → i+1), legs concatenated.
  const congestion = (r.legs ?? []).flatMap((l) => l.annotation?.congestion ?? []);
  const spans: TrafficSpan[] = [];
  congestion.forEach((c, i) => {
    const level = MAPBOX_LEVEL[c];
    if (level) spans.push({ from: i, to: i + 1, level });
  });
  return {
    distanceM: Math.round(r.distance ?? 0),
    durationS: Math.round(r.duration),
    polyline,
    provider: "osm",
    traffic: { source: "mapbox", durationNoTrafficS: r.duration_typical != null ? Math.round(r.duration_typical) : null, spans: normaliseSpans(spans, polyline.length), at: at.toISOString() },
  };
}

async function mapboxRoute(from: LatLng, to: LatLng, token: string, fetchImpl: typeof fetch): Promise<RouteResult> {
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${from.lng},${from.lat};${to.lng},${to.lat}`);
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("annotations", "congestion");
  url.searchParams.set("language", "he");
  url.searchParams.set("access_token", token);
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`mapbox ${res.status}`);
  return mapboxToRoute((await res.json()) as MapboxDirectionsResponse);
}

// ───────────────────────────── TomTom Routing ─────────────────────────────

export type TomTomRouteResponse = {
  routes?: {
    summary?: { lengthInMeters?: number; travelTimeInSeconds?: number; noTrafficTravelTimeInSeconds?: number; trafficDelayInSeconds?: number };
    legs?: { points?: { latitude: number; longitude: number }[] }[];
    sections?: { sectionType?: string; startPointIndex?: number; endPointIndex?: number; simpleCategory?: string; magnitudeOfDelay?: number }[];
  }[];
};

function tomtomLevel(s: { simpleCategory?: string; magnitudeOfDelay?: number }): TrafficLevel {
  if (s.simpleCategory === "ROAD_CLOSURE") return "severe";
  switch (s.magnitudeOfDelay) {
    case 2:
      return "heavy";
    case 3:
    case 4:
      return "severe";
    default:
      return "moderate"; // 0 unknown, 1 minor
  }
}

export function tomtomToRoute(json: TomTomRouteResponse, at = new Date()): RouteResult {
  const r = json.routes?.[0];
  const points = (r?.legs ?? []).flatMap((l) => l.points ?? []);
  if (!r?.summary || points.length < 2 || r.summary.travelTimeInSeconds == null) throw new Error("tomtom: no route");
  const polyline = points.map((p) => [p.latitude, p.longitude] as [number, number]);
  const spans: TrafficSpan[] = (r.sections ?? [])
    .filter((s) => s.sectionType === "TRAFFIC" && s.startPointIndex != null && s.endPointIndex != null)
    .map((s) => ({ from: s.startPointIndex!, to: s.endPointIndex!, level: tomtomLevel(s) }));
  return {
    distanceM: Math.round(r.summary.lengthInMeters ?? 0),
    durationS: Math.round(r.summary.travelTimeInSeconds),
    polyline,
    provider: "osm",
    traffic: { source: "tomtom", durationNoTrafficS: r.summary.noTrafficTravelTimeInSeconds ?? null, spans: normaliseSpans(spans, polyline.length), at: at.toISOString() },
  };
}

async function tomtomRoute(from: LatLng, to: LatLng, key: string, fetchImpl: typeof fetch): Promise<RouteResult> {
  const url = new URL(`https://api.tomtom.com/routing/1/calculateRoute/${from.lat},${from.lng}:${to.lat},${to.lng}/json`);
  url.searchParams.set("key", key);
  url.searchParams.set("traffic", "true");
  url.searchParams.set("travelMode", "car");
  url.searchParams.set("routeType", "fastest");
  url.searchParams.set("sectionType", "traffic");
  url.searchParams.set("computeTravelTimeFor", "all");
  url.searchParams.set("language", "he-IL");
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`tomtom ${res.status}`);
  return tomtomToRoute((await res.json()) as TomTomRouteResponse);
}

export function trafficRoute(name: TrafficRouterName, key: string, from: LatLng, to: LatLng, fetchImpl: typeof fetch = fetch): Promise<RouteResult> {
  if (name === "google") return googleRoute(from, to, key, fetchImpl);
  if (name === "mapbox") return mapboxRoute(from, to, key, fetchImpl);
  return tomtomRoute(from, to, key, fetchImpl);
}
