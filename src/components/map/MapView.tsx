"use client";
/**
 * MapLibre GL wrapper. Works with real vector tiles (NEXT_PUBLIC_MAP_STYLE_URL)
 * and degrades to a flat offline canvas when no style is configured or tiles
 * fail to load — markers and routes still render, so the product remains
 * usable (and testable) without internet.
 *
 * Usage:
 *   <MapView center={{lat,lng}} zoom={14} markers={[...]} polyline={[[lat,lng],...]} onMoveEnd={...} />
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Map as MLMap, Marker, LngLatBounds, setWorkerUrl, type StyleSpecification, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// MapLibre resolves its web worker relative to the bundled chunk, which does
// not exist under Turbopack (404 → "Worker failed to load"). Point it at the
// worker emitted as a static asset instead. Module is client-only (dynamic import).
try {
  setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
} catch {
  /* keep MapLibre's default */
}
import type { LatLng, Polyline } from "@/lib/types";
import { cn } from "@/components/ui/cn";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  kind: "pickup" | "dropoff" | "driver" | "me" | "poi";
  label?: string;
  heading?: number | null;
};

type Props = {
  center?: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  polyline?: Polyline | null;
  /** Fit the viewport to these points (pickup/dropoff/driver...). */
  fit?: LatLng[] | null;
  fitPadding?: { top?: number; bottom?: number; left?: number; right?: number };
  interactive?: boolean;
  onMoveEnd?: (center: LatLng, zoom: number) => void;
  onMoveStart?: () => void;
  onReady?: (map: MLMap) => void;
  className?: string;
  theme?: "light" | "dark";
  children?: React.ReactNode;
};

const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#e7e9ee" } }],
};
const FALLBACK_STYLE_DARK: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#1a1d26" } }],
};

const CAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l5 7h-10z" fill="currentColor" stroke="none"/><rect x="7" y="10" width="10" height="11" rx="3" /></svg>`;

function markerElement(m: MapMarker) {
  const el = document.createElement("div");
  el.className = "hop-marker";
  el.dataset.kind = m.kind;
  if (m.kind === "driver") {
    const car = document.createElement("div");
    car.className = "hop-marker-car";
    car.innerHTML = CAR_SVG;
    car.style.transform = `rotate(${m.heading ?? 0}deg)`;
    el.appendChild(car);
  } else {
    const pin = document.createElement("div");
    pin.className = `hop-marker-pin pin-${m.kind}`;
    el.appendChild(pin);
  }
  if (m.label) {
    const label = document.createElement("div");
    label.className = "hop-marker-label";
    label.textContent = m.label;
    el.appendChild(label);
  }
  return el;
}

export function MapView({ center, zoom = 14, markers = [], polyline, fit, fitPadding, interactive = true, onMoveEnd, onMoveStart, onReady, className, theme = "light", children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRefs = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const [ready, setReady] = useState(false);
  const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "";
  const [offline, setOffline] = useState(!styleUrl);
  const emitMoveEnd = useEffectEvent((c: LatLng, z: number) => onMoveEnd?.(c, z));
  const emitMoveStart = useEffectEvent(() => onMoveStart?.());
  const emitReady = useEffectEvent((m: MLMap) => onReady?.(m));

  const initialCenter = useMemo(() => center ?? { lat: 32.0753, lng: 34.7818 }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const fallback = theme === "dark" ? FALLBACK_STYLE_DARK : FALLBACK_STYLE;
    const map = new MLMap({
      container: containerRef.current,
      style: styleUrl || fallback,
      center: [initialCenter.lng, initialCenter.lat],
      zoom,
      attributionControl: styleUrl ? { compact: true } : false,
      interactive,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
      maxZoom: 18,
      minZoom: 8,
      fadeDuration: 150,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    let errored = false;
    map.on("error", (e: { error?: { message?: string } }) => {
      // Style/tiles unreachable → swap to the flat fallback once.
      const msg = String(e.error?.message ?? "");
      if (!errored && (msg.includes("Failed to fetch") || msg.includes("style") || msg.includes("NetworkError") || msg.includes("Load failed"))) {
        errored = true;
        setOffline(true);
        try {
          map.setStyle(fallback);
        } catch {
          /* ignore */
        }
      }
    });
    const onLoad = () => {
      setReady(true);
      emitReady(map);
    };
    map.on("load", onLoad);
    map.on("movestart", () => emitMoveStart());
    map.on("moveend", () => {
      const c = map.getCenter();
      emitMoveEnd({ lat: c.lat, lng: c.lng }, map.getZoom());
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    const markerStore = markerRefs.current;
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerStore.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fly to center when it changes (only if caller drives the center).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - center.lat) < 1e-6 && Math.abs(c.lng - center.lng) < 1e-6) return;
    map.easeTo({ center: [center.lng, center.lat], zoom: map.getZoom() < 11 ? zoom : map.getZoom(), duration: 600 });
  }, [center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Markers (diffed by id).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const existing = markerRefs.current.get(m.id);
      if (existing) {
        existing.setLngLat([m.lng, m.lat]);
        const el = existing.getElement();
        if (m.kind === "driver") {
          const car = el.querySelector<HTMLElement>(".hop-marker-car");
          if (car) car.style.transform = `rotate(${m.heading ?? 0}deg)`;
        }
        const label = el.querySelector<HTMLElement>(".hop-marker-label");
        if (label && m.label && label.textContent !== m.label) label.textContent = m.label;
      } else {
        const mk = new Marker({ element: markerElement(m), anchor: "center" }).setLngLat([m.lng, m.lat]).addTo(map);
        markerRefs.current.set(m.id, mk);
      }
    }
    for (const [id, mk] of markerRefs.current) {
      if (!seen.has(id)) {
        mk.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [markers]);

  // Route polyline.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const apply = () => {
      const src = map.getSource("hop-route") as GeoJSONSource | undefined;
      const data = {
        type: "FeatureCollection" as const,
        features: polyline && polyline.length > 1 ? [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: polyline.map(([lat, lng]) => [lng, lat]) } }] : [],
      };
      if (src) {
        src.setData(data);
      } else {
        map.addSource("hop-route", { type: "geojson", data });
        map.addLayer({ id: "hop-route-casing", type: "line", source: "hop-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 } });
        map.addLayer({ id: "hop-route-line", type: "line", source: "hop-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#2457FF", "line-width": 5 } });
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("styledata", apply);
  }, [polyline, ready]);

  // Fit bounds.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fit || fit.length === 0) return;
    if (fit.length === 1) {
      map.easeTo({ center: [fit[0].lng, fit[0].lat], zoom: 15, duration: 500 });
      return;
    }
    const b = new LngLatBounds();
    for (const p of fit) b.extend([p.lng, p.lat]);
    map.fitBounds(b, { padding: { top: 80, bottom: 320, left: 40, right: 40, ...fitPadding }, maxZoom: 16, duration: 700 });
  }, [fit, fitPadding]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)} data-map-offline={offline || undefined}>
      <div ref={containerRef} className="hop-map-container absolute inset-0" style={{ position: "absolute", inset: 0 }} />
      {offline && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(17,19,24,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(17,19,24,.12) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="absolute bottom-2 left-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-ink-500" dir="rtl">
            מפה ללא אריחים (מצב לא מקוון)
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
