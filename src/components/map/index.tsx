"use client";
import dynamic from "next/dynamic";

/** Client-only map (MapLibre needs window). Use this import in pages. */
export const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[color-mix(in_oklab,var(--fg)_6%,transparent)]" aria-label="טוען מפה" />,
});
export type { MapMarker } from "./MapView";
