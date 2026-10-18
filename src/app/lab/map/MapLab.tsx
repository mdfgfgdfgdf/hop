"use client";
/**
 * /lab/map — development playground for MapView: ?s=home | search | ride.
 * Cars here are synthetic and exist only on this page.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapView, type MapMarker } from "@/components/map";
import type { Polyline } from "@/lib/types";

const PICKUP = { lat: 32.0752, lng: 34.7751 };
const ROUTE: Polyline = [
  [32.0752, 34.7751], [32.0768, 34.7757], [32.0786, 34.7762], [32.0804, 34.7768], [32.0821, 34.7774],
  [32.0838, 34.778], [32.0849, 34.7801], [32.0858, 34.7826], [32.0866, 34.785], [32.0874, 34.7875],
];

function along(t: number): { lat: number; lng: number; heading: number } {
  const n = ROUTE.length - 1;
  const f = Math.min(0.9999, Math.max(0, t)) * n;
  const i = Math.floor(f);
  const k = f - i;
  const [a0, b0] = ROUTE[i];
  const [a1, b1] = ROUTE[i + 1];
  const heading = (Math.atan2((b1 - b0) * Math.cos((a0 * Math.PI) / 180), a1 - a0) * 180) / Math.PI;
  return { lat: a0 + (a1 - a0) * k, lng: b0 + (b1 - b0) * k, heading };
}

export function MapLab() {
  const s = useSearchParams().get("s") ?? "home";
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const markers = useMemo<MapMarker[]>(() => {
    if (s === "ride") {
      const car = along(((tick % 40) / 40) * 0.95);
      return [
        { id: "car", kind: "driver", ...car },
        { id: "dropoff", kind: "dropoff", lat: ROUTE[ROUTE.length - 1][0], lng: ROUTE[ROUTE.length - 1][1], label: "יעד" },
      ];
    }
    const list: MapMarker[] = [{ id: "me", kind: s === "search" ? "pickup" : "me", ...PICKUP }];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + tick * 0.05;
      const r = 0.0035 + (i % 3) * 0.0016;
      list.push({ id: `n${i}`, kind: "nearby", lat: PICKUP.lat + Math.sin(a) * r, lng: PICKUP.lng + Math.cos(a) * r * 1.2, heading: ((-a * 180) / Math.PI + 360) % 360 });
    }
    return list;
  }, [s, tick]);

  const polyline = useMemo(() => {
    if (s !== "ride") return null;
    const car = along(((tick % 40) / 40) * 0.95);
    const n = ROUTE.length - 1;
    const i = Math.ceil(((tick % 40) / 40) * 0.95 * n);
    return [[car.lat, car.lng], ...ROUTE.slice(i)] as Polyline;
  }, [s, tick]);

  return (
    <div className="h-dvh w-full">
      <MapView
        center={s === "ride" ? { lat: 32.0805, lng: 34.779 } : PICKUP}
        zoom={s === "ride" ? 15.4 : 15.2}
        pitch={s === "home" ? 48 : s === "ride" ? 56 : 30}
        bearing={s === "ride" ? -18 : 0}
        markers={markers}
        polyline={polyline}
        radar={s === "search" ? PICKUP : null}
        ambient={s === "home"}
      />
    </div>
  );
}
