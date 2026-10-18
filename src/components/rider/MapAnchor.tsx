"use client";
import { useEffect, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";

/** Positions children over a lat/lng on the map, following pans and zooms. */
export function MapAnchor({ map, lat, lng, children }: { map: MLMap | null; lat: number; lng: number; children: React.ReactNode }) {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!map) return;
    const update = () => {
      const p = map.project([lng, lat]);
      setPt({ x: p.x, y: p.y });
    };
    const raf = requestAnimationFrame(update);
    map.on("move", update);
    map.on("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      map.off("move", update);
      map.off("resize", update);
    };
  }, [map, lat, lng]);
  if (!pt) return null;
  return (
    <div className="pointer-events-none absolute top-0 left-0 z-[1]" style={{ transform: `translate(${pt.x}px, ${pt.y}px)` }} aria-hidden>
      <div className="-translate-x-1/2 -translate-y-1/2">{children}</div>
    </div>
  );
}

/** Pulsing "searching" halo around the pickup point. */
export function PulseHalo() {
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      <div className="ring-pulse absolute inset-0 rounded-full bg-brand/10" />
      <div className="ring-pulse absolute inset-5 rounded-full" />
    </div>
  );
}
