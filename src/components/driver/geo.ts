/** Small client-side geo helpers for the driver app. */
import type { LatLng } from "@/lib/types";

export function haversineM(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function wazeUrl(p: LatLng) {
  return `https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes`;
}

export function googleMapsUrl(p: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
}
