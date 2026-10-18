import type { PlaceDTO } from "@/lib/types";

/** A chosen point (pickup or dropoff) as sent to /api/quotes. */
export type SelectedPlace = {
  lat: number;
  lng: number;
  address: string;
  name?: string;
  id?: string;
  provider?: "demo" | "osm";
  kind?: PlaceDTO["kind"];
};

export type Stage =
  | { kind: "home" }
  | { kind: "search" }
  | { kind: "pin"; target: "pickup" | "dropoff"; returnTo: "home" | "quote" | "search" }
  | { kind: "quote" };

export function placeLabel(p: SelectedPlace | null | undefined) {
  if (!p) return "";
  return p.name && !p.name.startsWith("נקודה ליד") ? p.name : p.address;
}

export function fromPlace(p: PlaceDTO | { lat: number; lng: number; address: string; name?: string; id?: string; provider?: "demo" | "osm"; kind?: PlaceDTO["kind"] }): SelectedPlace {
  return { lat: p.lat, lng: p.lng, address: p.address, name: p.name, id: p.id, provider: p.provider, kind: p.kind };
}

export function toQuotePoint(p: SelectedPlace) {
  return {
    lat: p.lat,
    lng: p.lng,
    address: p.address.slice(0, 200) || "נקודה על המפה",
    ...(p.name ? { name: p.name.slice(0, 120) } : {}),
    ...(p.id ? { id: p.id.slice(0, 80) } : {}),
    ...(p.provider ? { provider: p.provider } : {}),
  };
}
