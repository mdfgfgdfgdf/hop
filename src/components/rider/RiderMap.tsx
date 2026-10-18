"use client";
/**
 * Client-only MapView for the rider app, with two local workarounds for the
 * shared map (reported under "Requested backend/shared changes"):
 *  1. MapLibre 6 resolves its worker relative to the bundled chunk, which 404s
 *     under Turbopack — we serve it from /ride/map-worker and point MapLibre there.
 *  2. maplibre-gl.css is unlayered, so `.maplibregl-map { position: relative }`
 *     beats MapView's `absolute inset-0` and the map collapses to 300px tall —
 *     we re-assert the absolute fill with important utilities.
 */
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { cn } from "@/components/ui/cn";
import type { MapView as SharedMapView } from "@/components/map/MapView";

const WORKER_URL = "/ride/map-worker";
const FILL_FIX = "[&_.maplibregl-map]:absolute! [&_.maplibregl-map]:inset-0!";

export const RiderMap = dynamic(
  async () => {
    const [ml, mv] = await Promise.all([import("maplibre-gl"), import("@/components/map/MapView")]);
    try {
      if (ml.getWorkerUrl() !== WORKER_URL) ml.setWorkerUrl(WORKER_URL);
    } catch {
      /* keep MapLibre's default */
    }
    const Inner = mv.MapView;
    function RiderMapInner(props: ComponentProps<typeof SharedMapView>) {
      return <Inner {...props} className={cn(FILL_FIX, props.className)} />;
    }
    return RiderMapInner;
  },
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]" aria-label="טוען מפה" />,
  },
);
export type { MapMarker } from "@/components/map/MapView";
