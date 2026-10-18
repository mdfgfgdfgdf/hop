/**
 * Offline demo provider. Distances are great-circle × a road factor,
 * durations assume city driving. Routes are gently curved lines. Everything
 * it returns is tagged provider: "demo" so the UI can label it honestly.
 */
import type { LatLng, Polyline } from "../db/schema";
import { DEMO_PLACES } from "./demo-places";
import { haversineM } from "./haversine";
import type { GeoProvider, Place, RouteResult } from "./types";

const ROAD_FACTOR = 1.3;
const AVG_SPEED_MPS = 7.5; // ≈ 27 km/h city average incl. lights
const BASE_OVERHEAD_S = 90;

function normalize(s: string) {
  return s.replace(/["'״׳\-–,.]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

export function estimateRoute(from: LatLng, to: LatLng): RouteResult {
  const straight = haversineM(from, to);
  const distanceM = Math.round(straight * ROAD_FACTOR);
  const durationS = Math.round(BASE_OVERHEAD_S + distanceM / AVG_SPEED_MPS);
  // Quadratic bezier with a control point offset perpendicular to the segment.
  const mid = { lat: (from.lat + to.lat) / 2, lng: (from.lng + to.lng) / 2 };
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const ctrl = { lat: mid.lat - dx * 0.18, lng: mid.lng + dy * 0.18 };
  const polyline: Polyline = [];
  const steps = Math.max(8, Math.min(40, Math.round(distanceM / 250)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) ** 2 * from.lat + 2 * (1 - t) * t * ctrl.lat + t ** 2 * to.lat;
    const lng = (1 - t) ** 2 * from.lng + 2 * (1 - t) * t * ctrl.lng + t ** 2 * to.lng;
    polyline.push([+lat.toFixed(6), +lng.toFixed(6)]);
  }
  return { distanceM, durationS, polyline, provider: "demo" };
}

export class DemoGeoProvider implements GeoProvider {
  readonly name = "demo" as const;

  async search(query: string, near?: LatLng, limit = 8): Promise<Place[]> {
    const q = normalize(query);
    if (!q) return [];
    const terms = q.split(" ");
    const scored = DEMO_PLACES.map((p) => {
      const hay = normalize(`${p.name} ${p.address} ${p.city ?? ""}`);
      let score = 0;
      for (const t of terms) {
        if (hay.includes(t)) score += t.length >= 3 ? 2 : 1;
        if (normalize(p.name).startsWith(t)) score += 2;
      }
      const dist = near ? haversineM(near, p) : 0;
      return { p, score, dist };
    })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.dist - b.dist)
      .slice(0, limit)
      .map((s) => s.p);
    return scored;
  }

  async reverse(point: LatLng): Promise<Place | null> {
    let best: Place | null = null;
    let bestD = Infinity;
    for (const p of DEMO_PLACES) {
      const d = haversineM(point, p);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) return null;
    if (bestD < 120) return best;
    return {
      id: `demo-pin-${point.lat.toFixed(5)}-${point.lng.toFixed(5)}`,
      name: `נקודה ליד ${best.name}`,
      address: `${Math.round(bestD)} מ' מ${best.name}, ${best.city ?? ""}`.trim(),
      city: best.city,
      lat: point.lat,
      lng: point.lng,
      kind: "address",
      provider: "demo",
    };
  }

  async route(from: LatLng, to: LatLng): Promise<RouteResult> {
    return estimateRoute(from, to);
  }
}
