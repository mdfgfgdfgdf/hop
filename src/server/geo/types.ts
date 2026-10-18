import type { LatLng, Polyline } from "../db/schema";

export type Place = {
  id: string;
  name: string; // Hebrew display name
  address: string; // full address line
  city?: string;
  lat: number;
  lng: number;
  kind?: "poi" | "address" | "transit" | "city";
  provider: "demo" | "osm";
};

export type RouteResult = {
  distanceM: number;
  durationS: number;
  polyline: Polyline; // [lat, lng]
  provider: "demo" | "osm";
};

export interface GeoProvider {
  readonly name: "demo" | "osm";
  search(query: string, near?: LatLng, limit?: number): Promise<Place[]>;
  reverse(point: LatLng): Promise<Place | null>;
  route(from: LatLng, to: LatLng): Promise<RouteResult>;
}
