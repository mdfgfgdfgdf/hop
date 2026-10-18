import type { LatLng, Polyline } from "../db/schema";

const R = 6_371_000; // metres

export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function polylineLengthM(line: Polyline): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    total += haversineM({ lat: line[i - 1][0], lng: line[i - 1][1] }, { lat: line[i][0], lng: line[i][1] });
  }
  return total;
}

/** Point on a polyline at fraction t ∈ [0,1] of its length. */
export function pointAlong(line: Polyline, t: number): LatLng {
  if (line.length === 0) return { lat: 0, lng: 0 };
  if (line.length === 1 || t <= 0) return { lat: line[0][0], lng: line[0][1] };
  if (t >= 1) return { lat: line[line.length - 1][0], lng: line[line.length - 1][1] };
  const total = polylineLengthM(line);
  let target = total * t;
  for (let i = 1; i < line.length; i++) {
    const a = { lat: line[i - 1][0], lng: line[i - 1][1] };
    const b = { lat: line[i][0], lng: line[i][1] };
    const seg = haversineM(a, b);
    if (target <= seg) {
      const f = seg === 0 ? 0 : target / seg;
      return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
    }
    target -= seg;
  }
  return { lat: line[line.length - 1][0], lng: line[line.length - 1][1] };
}

/** Ray-casting point-in-polygon on a GeoJSON ring ([lng, lat] pairs). */
export function pointInRing(point: LatLng, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
