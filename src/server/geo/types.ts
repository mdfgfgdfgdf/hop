import type { LatLng, Polyline, RouteTraffic } from "../db/schema";

export type { RouteTraffic, TrafficLevel, TrafficSpan } from "../db/schema";

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
  /** With live traffic when `traffic` is set. */
  durationS: number;
  polyline: Polyline; // [lat, lng]
  /** "demo" = estimated offline; "osm" = a live road route (OSRM or a traffic-aware provider). */
  provider: "demo" | "osm";
  traffic?: RouteTraffic | null;
};

export interface GeoProvider {
  readonly name: "demo" | "osm";
  search(query: string, near?: LatLng, limit?: number): Promise<Place[]>;
  reverse(point: LatLng): Promise<Place | null>;
  route(from: LatLng, to: LatLng): Promise<RouteResult>;
}
