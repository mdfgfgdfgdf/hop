"use client";
/**
 * Night-mode map for the driver app. Wraps the shared MapView, restyles
 * vector tiles to a dark palette (the configured style is a light one), styles
 * the route as a glowing line (dashed for the straight "guide" to pickup) and
 * drives the camera imperatively so it can follow the driver or frame a ride.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { LocateFixed } from "lucide-react";
import { MapView, type MapMarker } from "@/components/map";
import type { LatLng, Polyline } from "@/lib/types";
import { cn } from "@/components/ui";

type Padding = { top: number; bottom: number; left: number; right: number };

type Props = {
  me?: (LatLng & { heading?: number | null }) | null;
  meKind?: "me" | "driver";
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  polyline?: Polyline | null;
  /** Render the polyline as a dashed straight guide (driver → pickup). */
  guide?: boolean;
  /** Points to frame. When empty/undefined the camera follows `me`. */
  frame?: LatLng[] | null;
  /** Changing this re-applies the camera (frame or follow). */
  viewKey?: string;
  padding?: Partial<Padding>;
  interactive?: boolean;
  showRecenter?: boolean;
  /** Radar pulse around the driver's own position (online & waiting). */
  pulse?: boolean;
  recenterClassName?: string;
  className?: string;
  children?: React.ReactNode;
};

const DEFAULT_CENTER = { lat: 32.0753, lng: 34.7818 };
const WORKER_URL = "/drive/map-worker";

/** Points MapLibre at a served copy of its worker before any map is created. */
let workerSetup: Promise<void> | null = null;
function ensureMapWorker() {
  workerSetup ??= import("maplibre-gl")
    .then((m) => {
      if (m.getWorkerUrl() !== WORKER_URL) m.setWorkerUrl(WORKER_URL);
    })
    .catch(() => {});
  return workerSetup;
}

/** Best-effort dark palette for a light vector style (OpenMapTiles-like ids). */
function darken(map: MLMap) {
  const layers = map.getStyle()?.layers ?? [];
  const set = (id: string, prop: Parameters<MLMap["setPaintProperty"]>[1], value: Parameters<MLMap["setPaintProperty"]>[2]) => {
    try {
      map.setPaintProperty(id, prop, value);
    } catch {
      /* property not applicable */
    }
  };
  for (const l of layers) {
    if (l.id.startsWith("hop-")) continue;
    const id = l.id.toLowerCase();
    switch (l.type) {
      case "background":
        set(l.id, "background-color", "#0f1219");
        break;
      case "fill":
        if (id.includes("water")) set(l.id, "fill-color", "#0a1626");
        else if (id.includes("park") || id.includes("wood") || id.includes("grass") || id.includes("forest")) set(l.id, "fill-color", "#111a17");
        else if (id.includes("building")) set(l.id, "fill-color", "#1b1f29");
        else set(l.id, "fill-color", "#12151d");
        set(l.id, "fill-outline-color", "rgba(255,255,255,0.04)");
        break;
      case "fill-extrusion":
        set(l.id, "fill-extrusion-color", "#1b1f29");
        set(l.id, "fill-extrusion-opacity", 0.6);
        break;
      case "line":
        if (id.includes("water")) set(l.id, "line-color", "#0d1f36");
        else if (id.includes("motorway") || id.includes("trunk") || id.includes("primary")) set(l.id, "line-color", "#3a4256");
        else if (id.includes("casing")) set(l.id, "line-color", "#0f1219");
        else if (id.includes("rail")) set(l.id, "line-color", "#262b36");
        else if (id.includes("boundary") || id.includes("admin")) set(l.id, "line-color", "#2f3542");
        else set(l.id, "line-color", "#272c38");
        break;
      case "symbol":
        set(l.id, "text-color", "#9aa1b2");
        set(l.id, "text-halo-color", "#0d0f14");
        set(l.id, "text-halo-width", 1.2);
        set(l.id, "icon-opacity", 0.55);
        break;
      default:
        break;
    }
  }
}

export function DriverMap({
  me,
  meKind = "me",
  pickup,
  dropoff,
  polyline,
  guide,
  frame,
  viewKey = "default",
  padding,
  interactive = true,
  showRecenter = true,
  pulse,
  recenterClassName,
  className,
  children,
}: Props) {
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const pad = useMemo<Padding>(() => ({ top: 90, bottom: 90, left: 40, right: 40, ...padding }), [padding]);
  const [initialCenter] = useState<LatLng>(() => me ?? pickup ?? DEFAULT_CENTER);
  const [workerReady, setWorkerReady] = useState(false);
  useEffect(() => {
    let active = true;
    void ensureMapWorker().then(() => active && setWorkerReady(true));
    return () => {
      active = false;
    };
  }, []);

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    if (pickup) out.push({ id: "pickup", kind: "pickup", lat: pickup.lat, lng: pickup.lng, label: "איסוף" });
    if (dropoff) out.push({ id: "dropoff", kind: "dropoff", lat: dropoff.lat, lng: dropoff.lng, label: "יעד" });
    if (me) out.push({ id: "me", kind: meKind, lat: me.lat, lng: me.lng, heading: me.heading ?? 0 });
    return out;
  }, [pickup, dropoff, me, meKind]);

  const frameRef = useRef(frame);
  const meRef = useRef(me);
  const padRef = useRef(pad);
  useEffect(() => {
    frameRef.current = frame;
    meRef.current = me;
    padRef.current = pad;
  });

  const pendingView = useRef(false);
  const applyView = useCallback((animate = true) => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getContainer().clientHeight || !map.getContainer().clientWidth) {
      // Not laid out yet — apply on the first resize instead.
      pendingView.current = true;
      return;
    }
    const pts = (frameRef.current ?? []).filter(Boolean);
    const raw = padRef.current;
    // Never let the padding exceed the canvas (small screens / tall sheets).
    const ch = map.getContainer().clientHeight;
    const cw = map.getContainer().clientWidth;
    const p = {
      top: Math.min(raw.top, ch * 0.3),
      bottom: Math.min(raw.bottom, Math.max(0, ch - Math.min(raw.top, ch * 0.3) - 120)),
      left: Math.min(raw.left, cw * 0.2),
      right: Math.min(raw.right, Math.max(0, cw - Math.min(raw.left, cw * 0.2) - 160)),
    };
    try {
      if (pts.length >= 2) {
        // Frame the points ourselves and use easeTo with absolute padding:
        // fitBounds would add its padding on top of the padding left by
        // previous easeTo calls and overflow the canvas.
        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
        for (const q of pts) {
          minLat = Math.min(minLat, q.lat);
          maxLat = Math.max(maxLat, q.lat);
          minLng = Math.min(minLng, q.lng);
          maxLng = Math.max(maxLng, q.lng);
        }
        const a = map.project([minLng, maxLat]);
        const b = map.project([maxLng, minLat]);
        const dx = Math.abs(b.x - a.x);
        const dy = Math.abs(b.y - a.y);
        const w = Math.max(40, cw - p.left - p.right);
        const h = Math.max(40, ch - p.top - p.bottom);
        const scale = Math.min(dx > 0 ? w / dx : Infinity, dy > 0 ? h / dy : Infinity);
        const zoom = Number.isFinite(scale) ? Math.min(16, Math.max(9, map.getZoom() + Math.log2(scale))) : 16;
        map.easeTo({ center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2], zoom, padding: p, duration: animate ? 700 : 0 });
      } else {
        const c = pts[0] ?? meRef.current;
        if (c) map.easeTo({ center: [c.lng, c.lat], zoom: Math.max(map.getZoom(), 15), padding: p, duration: animate ? 600 : 0 });
      }
    } catch {
      /* map not ready for camera moves */
    }
  }, []);

  const onReady = useCallback((map: MLMap) => {
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __hopDriverMap?: MLMap }).__hopDriverMap = map;
    darken(map);
    map.on("dragstart", () => setFollowing(false));
    map.on("resize", () => {
      if (!pendingView.current) return;
      pendingView.current = false;
      applyView(false);
    });
    setReady(true);
  }, [applyView]);

  // Re-frame when the view changes (new ride phase, layout change…).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      setFollowing(true);
      applyView(true);
    }, 0);
    return () => clearTimeout(t);
  }, [ready, viewKey, applyView, pad.bottom, pad.right, pad.left, pad.top]);

  // Follow the driver while idle (no frame) and the user hasn't panned away.
  const meLat = me ? Math.round(me.lat * 1e5) : null;
  const meLng = me ? Math.round(me.lng * 1e5) : null;
  const hasFrame = (frame?.length ?? 0) >= 2;
  useEffect(() => {
    if (!ready || !following || hasFrame || meLat == null) return;
    applyView(true);
  }, [ready, following, hasFrame, meLat, meLng, applyView]);

  // Route styling: glow for the trip, dashed light line for the pickup guide.
  useEffect(() => {
    if (!ready) return;
    let frames = 0;
    let raf = 0;
    const style = () => {
      const map = mapRef.current;
      if (!map) return;
      if (!map.getLayer("hop-route-line") || !map.getLayer("hop-route-casing")) {
        if (frames++ < 60) raf = requestAnimationFrame(style);
        return;
      }
      try {
        map.setPaintProperty("hop-route-casing", "line-color", "#2457FF");
        map.setPaintProperty("hop-route-casing", "line-opacity", guide ? 0 : 0.28);
        map.setPaintProperty("hop-route-casing", "line-width", 14);
        map.setPaintProperty("hop-route-casing", "line-blur", 6);
        map.setPaintProperty("hop-route-line", "line-color", guide ? "#9db5ff" : "#4d78ff");
        map.setPaintProperty("hop-route-line", "line-width", guide ? 4 : 5);
        map.setPaintProperty("hop-route-line", "line-dasharray", guide ? [1.2, 1.6] : [1, 0]);
      } catch {
        /* style swapped */
      }
    };
    style();
    return () => cancelAnimationFrame(raf);
  }, [ready, polyline, guide]);

  return (
    <div
      className={cn(
        "relative h-full w-full",
        // maplibre-gl.css (unlayered) forces .maplibregl-map{position:relative}, collapsing
        // MapView's absolutely-positioned container to 0px — pin it back to full size.
        "[&_.maplibregl-map]:absolute! [&_.maplibregl-map]:inset-0!",
        // Location halo on the driver's own position + legible offline grid in dark mode.
        "[&_.pin-me]:shadow-[0_0_0_7px_rgba(36,87,255,0.28),0_0_24px_6px_rgba(36,87,255,0.45)]",
        "[&_.hop-marker-car]:shadow-[0_0_0_6px_rgba(36,87,255,0.3),0_10px_24px_-8px_rgba(0,0,0,0.8)]",
        "[&_[data-map-offline]>div[aria-hidden]>div:first-child]:[background-image:linear-gradient(rgba(255,255,255,.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.2)_1px,transparent_1px)]!",
        pulse &&
          "[&_.pin-me]:relative [&_.pin-me]:after:absolute [&_.pin-me]:after:-inset-4 [&_.pin-me]:after:animate-ping [&_.pin-me]:after:rounded-full [&_.pin-me]:after:bg-brand/35 [&_.pin-me]:after:content-['']",
        className,
      )}
    >
      {workerReady ? (
        <MapView theme="dark" center={initialCenter} zoom={15} markers={markers} polyline={polyline ?? null} interactive={interactive} onReady={onReady}>
          {children}
        </MapView>
      ) : (
        <div className="h-full w-full bg-[#0f1219]" aria-label="טוען מפה" />
      )}
      {showRecenter && interactive && (
        <button
          type="button"
          onClick={() => {
            setFollowing(true);
            applyView(true);
          }}
          aria-label="מרכוז המפה"
          className={cn(
            "glass glass-pill absolute z-10 grid h-12 w-12 place-items-center text-fg transition-opacity",
            following ? "opacity-70" : "opacity-100",
            recenterClassName ?? "end-3 top-24",
          )}
        >
          <LocateFixed size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}
