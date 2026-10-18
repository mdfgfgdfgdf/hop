/** Small client-side geometry helpers (display only — never used for pricing). */
import type { LatLng, Polyline } from "@/lib/types";

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceM(a: LatLng, b: LatLng) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Average urban speed used for rider-facing "estimated" times. */
export const EST_SPEED_MPS = 8;

export function etaSeconds(meters: number) {
  return meters / EST_SPEED_MPS;
}

/** The part of a route still ahead of `pos` (closest vertex onwards). */
export function remainingRoute(polyline: Polyline, pos: LatLng): Polyline {
  if (polyline.length < 2) return polyline;
  let best = 0;
  let bestD = Infinity;
  polyline.forEach(([lat, lng], i) => {
    const d = distanceM(pos, { lat, lng });
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  const rest = polyline.slice(Math.min(best + 1, polyline.length - 1));
  return [[pos.lat, pos.lng], ...rest];
}

export function polylineLength(polyline: Polyline) {
  let total = 0;
  for (let i = 1; i < polyline.length; i++) {
    total += distanceM({ lat: polyline[i - 1][0], lng: polyline[i - 1][1] }, { lat: polyline[i][0], lng: polyline[i][1] });
  }
  return total;
}

export const TEL_AVIV_CENTER: LatLng = { lat: 32.0753, lng: 34.7818 };

export function samePoint(a: LatLng | null | undefined, b: LatLng | null | undefined, toleranceM = 15) {
  if (!a || !b) return false;
  return distanceM(a, b) <= toleranceM;
}
