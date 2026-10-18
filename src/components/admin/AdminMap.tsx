"use client";
/**
 * Admin wrapper around the shared MapView.
 *
 * Workaround: MapLibre 6 resolves its web worker relative to the bundled
 * chunk (`import.meta.url`), which under Turbopack points at a file that does
 * not exist (404 → "Worker failed to load", the map never finishes loading).
 * We point MapLibre at the worker emitted as a static asset before the shared
 * MapView module is evaluated. (Reported under "Requested shared changes".)
 */
import dynamic from "next/dynamic";

export const AdminMap = dynamic(
  async () => {
    const [ml, mv] = await Promise.all([import("maplibre-gl"), import("@/components/map/MapView")]);
    try {
      ml.setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
    } catch {
      /* keep MapLibre's default */
    }
    return mv.MapView;
  },
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]" aria-label="טוען מפה" />,
  },
);
export type { MapMarker } from "@/components/map/MapView";
