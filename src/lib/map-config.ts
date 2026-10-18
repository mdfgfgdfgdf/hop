"use client";
/** What the server's map stack offers (live traffic overlay / traffic-aware routing). Fetched once per page. */
import { useSyncExternalStore } from "react";

export type MapConfig = { trafficTiles: boolean; trafficRouting: "google" | "mapbox" | "tomtom" | null; geoProvider: "demo" | "osm" };

const OFF: MapConfig = { trafficTiles: false, trafficRouting: null, geoProvider: "osm" };
let value: MapConfig = OFF;
let started = false;
const listeners = new Set<() => void>();

function load() {
  if (started) return;
  started = true;
  fetch("/api/map/config", { credentials: "same-origin" })
    .then((r) => (r.ok ? (r.json() as Promise<MapConfig>) : OFF))
    .then((cfg) => {
      value = { ...OFF, ...cfg };
      for (const l of listeners) l();
    })
    .catch(() => {
      started = false; // retry on the next subscriber
    });
}

export function useMapConfig(): MapConfig {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      load();
      return () => listeners.delete(cb);
    },
    () => value,
    () => OFF,
  );
}
