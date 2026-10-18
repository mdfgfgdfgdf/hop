"use client";
/**
 * Driver map. Wraps the shared MapView (light style, or the flat offline
 * HOP City when tiles are unavailable), shows the route as a trip line or a
 * dashed straight "guide" to pickup, and drives the camera
 * imperatively so it can follow the driver or frame a ride.
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
  recenterClassName?: string;
  className?: string;
  children?: React.ReactNode;
};

const DEFAULT_CENTER = { lat: 32.0753, lng: 34.7818 };
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
  recenterClassName,
  className,
  children,
}: Props) {
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(true);
  const pad = useMemo<Padding>(() => ({ top: 90, bottom: 90, left: 40, right: 40, ...padding }), [padding]);
  const [initialCenter] = useState<LatLng>(() => me ?? pickup ?? DEFAULT_CENTER);

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

  return (
    <div
      className={cn(
        "relative h-full w-full",
        // Soft location halo on the driver's own position / car.
        "[&_.pin-me]:shadow-[0_0_0_8px_rgba(36,87,255,0.16),0_6px_14px_-4px_rgba(36,87,255,0.55)]",
        className,
      )}
    >
      <MapView theme="light" center={initialCenter} zoom={15} markers={markers} polyline={polyline ?? null} routeStyle={guide ? "guide" : "trip"} interactive={interactive} onReady={onReady}>
        {children}
      </MapView>
      {showRecenter && interactive && (
        <button
          type="button"
          onClick={() => {
            setFollowing(true);
            applyView(true);
          }}
          aria-label="מרכוז המפה"
          className={cn(
            "glass glass-strong glass-pill absolute z-10 grid h-12 w-12 place-items-center transition-colors",
            following ? "text-fg-muted" : "text-brand",
            recenterClassName ?? "end-3 top-24",
          )}
        >
          <LocateFixed size={20} aria-hidden />
        </button>
      )}
    </div>
  );
}
