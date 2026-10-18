"use client";
/**
 * MapLibre GL wrapper — the living HOP map. Real vector tiles by default
 * (NEXT_PUBLIC_MAP_STYLE_URL, OpenFreeMap "positron" if unset) upgraded with
 * brand tints and 3D buildings; when tiles are unavailable (offline, blocked
 * network, tests) it switches to "HOP City", a schematic 3D basemap served
 * from /map/hop-city.json, whose attribution says it is schematic.
 *
 * On top of either: a layered route that draws itself in and carries a
 * travelling light, gliding top-view cars with a fading trail, a searching
 * radar laid flat on the ground, pitch/bearing camera props and an optional
 * slow ambient drift.
 *
 * Usage:
 *   <MapView center={{lat,lng}} zoom={14} pitch={45} markers={[...]} polyline={[[lat,lng],...]} radar={pickup} />
 */
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Map as MLMap, Marker, LngLatBounds, setWorkerUrl, setRTLTextPlugin, getRTLTextPluginStatus, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng, Polyline } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { CITY_LABELS, cityStyle, loadCityData, type MapTheme } from "./city";
import { carElement, cometGradient, distM, easeOutCubic, enhanceRealTiles, installOverlays, radarElement, setCarHeading, setHeat, setLine, setTraffic, setTrafficTiles, sliceLine, buildingDepth } from "./fx";
import { useMapConfig } from "@/lib/map-config";
import type { TrafficSegment } from "@/lib/traffic";

// MapLibre resolves its web worker relative to the bundled chunk, which does
// not exist under Turbopack (404 → "Worker failed to load"). Point it at the
// worker emitted as a static asset instead. Module is client-only (dynamic import).
try {
  setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
} catch {
  /* keep MapLibre's default */
}

/** Hebrew/Arabic labels on vector tiles need the RTL text plugin (loaded lazily, only with real tiles). */
function ensureRtlTextPlugin() {
  try {
    if (getRTLTextPluginStatus() === "unavailable") {
      setRTLTextPlugin(new URL("/map/rtl-text", window.location.origin).href, true);
    }
  } catch {
    /* ignore — labels fall back to logical order */
  }
}

/** Clamps fit padding so it can never exceed the map's own size (MapLibre throws on NaN bounds). */
function safePadding(map: MLMap, padding: { top: number; bottom: number; left: number; right: number }) {
  const { width, height } = map.getContainer().getBoundingClientRect();
  const maxV = Math.max(0, Math.floor(height / 2) - 24);
  const maxH = Math.max(0, Math.floor(width / 2) - 24);
  return {
    top: Math.min(padding.top, maxV),
    bottom: Math.min(padding.bottom, maxV),
    left: Math.min(padding.left, maxH),
    right: Math.min(padding.right, maxH),
  };
}

/** WebGL is required by MapLibre; some locked-down or very old devices lack it. */
function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  /** `driver` is the ride's car (glides, leaves a trail); `nearby` are other cars around. */
  kind: "pickup" | "dropoff" | "driver" | "nearby" | "me" | "poi";
  label?: string;
  heading?: number | null;
};

type Props = {
  center?: LatLng;
  zoom?: number;
  /** Camera tilt in degrees (0 = top-down). Changes animate. */
  pitch?: number;
  /** Camera rotation in degrees. Changes animate. */
  bearing?: number;
  markers?: MapMarker[];
  polyline?: Polyline | null;
  /** Congested stretches drawn over the route (see trafficSegments in @/lib/traffic). */
  traffic?: TrafficSegment[] | null;
  /** Demand heat points (e.g. GET /api/driver/demand cells; weight = requests). */
  heat?: { lat: number; lng: number; weight: number }[] | null;
  /** Live traffic overlay for the whole map, when the server has a traffic provider. */
  trafficTiles?: boolean;
  /** `trip`: glowing route with a travelling light. `guide`: dashed straight hint (e.g. driver → pickup). */
  routeStyle?: "trip" | "guide";
  /** Animate a new route drawing itself from start to end. */
  drawRoute?: boolean;
  /** A searching radar laid flat on the map at this point. */
  radar?: (LatLng & { size?: number }) | null;
  /** Fading trail behind the `driver` car. */
  trail?: boolean;
  /** Slow camera rotation while nobody touches the map (hero / idle screens). */
  ambient?: boolean;
  /** Fit the viewport to these points (pickup/dropoff/driver...). */
  fit?: LatLng[] | null;
  fitPadding?: { top?: number; bottom?: number; left?: number; right?: number };
  interactive?: boolean;
  onMoveEnd?: (center: LatLng, zoom: number) => void;
  onMoveStart?: () => void;
  onReady?: (map: MLMap) => void;
  className?: string;
  theme?: MapTheme;
  children?: React.ReactNode;
};

const DEFAULT_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const CITY_DATA_PATH = "/map/hop-city.json";
/** Give real tiles this long to load before switching to HOP City. */
const STYLE_TIMEOUT_MS = 7000;

type Glide = { from: [number, number]; to: [number, number]; start: number; dur: number; last: number; cur: [number, number] };

function pinElement(m: MapMarker) {
  const el = document.createElement("div");
  el.className = "hop-marker";
  el.dataset.kind = m.kind;
  if (m.kind === "driver" || m.kind === "nearby") {
    el.appendChild(carElement(m.heading ?? 0));
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

/** Appends to the car's trail, keeping ~320 m of history. */
function pushTrail(pts: number[][], p: [number, number]) {
  const lastPt = pts[pts.length - 1];
  if (lastPt) {
    const d = distM(lastPt, p);
    if (d < 2) return;
    if (d > 400) pts.length = 0; // teleport (new ride, GPS jump) → start over
  }
  pts.push(p);
  let len = 0;
  for (let i = pts.length - 1; i > 0; i--) {
    len += distM(pts[i], pts[i - 1]);
    if (len > 320) {
      pts.splice(0, i - 1);
      break;
    }
  }
  if (pts.length > 80) pts.splice(0, pts.length - 80);
}

const zoomBand = (z: number) => (z < 11.3 ? "far" : z < 13.4 ? "mid" : z < 16.6 ? "near" : "street");

export function MapView({
  center,
  zoom = 14,
  pitch = 0,
  bearing = 0,
  markers = [],
  polyline,
  traffic,
  heat,
  trafficTiles = false,
  routeStyle = "trip",
  drawRoute = true,
  radar,
  trail = true,
  ambient = false,
  fit,
  fitPadding,
  interactive = true,
  onMoveEnd,
  onMoveStart,
  onReady,
  className,
  theme = "light",
  children,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRefs = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const labelRefs = useRef<Marker[]>([]);
  const radarRef = useRef<Marker | null>(null);
  const glides = useRef<globalThis.Map<string, Glide>>(new globalThis.Map());
  const glideRaf = useRef(0);
  const routeRef = useRef<number[][] | null>(null);
  const routeEndKey = useRef<string>("");
  const trailRef = useRef<number[][]>([]);
  const trailFlush = useRef(0);
  const cameraRef = useRef({ pitch, bearing });
  const routeStyleRef = useRef(routeStyle);
  const trafficRef = useRef<{ segments: TrafficSegment[] | null | undefined; tiles: boolean; heat: Props["heat"] }>({ segments: null, tiles: false, heat: null });
  const [ready, setReady] = useState(false);
  const mapConfig = useMapConfig();
  // Real vector tiles by default (OpenFreeMap "positron": light, no key).
  // Set NEXT_PUBLIC_MAP_STYLE_URL="" to always use HOP City.
  const styleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? DEFAULT_STYLE_URL;
  const [offline, setOffline] = useState(!styleUrl);
  // Client-only module (dynamic import, ssr: false), so reading the DOM here is safe.
  const [failed, setFailed] = useState(() => !supportsWebGL());
  const emitMoveEnd = useEffectEvent((c: LatLng, z: number) => onMoveEnd?.(c, z));
  const emitMoveStart = useEffectEvent(() => onMoveStart?.());
  const emitReady = useEffectEvent((m: MLMap) => onReady?.(m));

  const initialCenter = useMemo(() => center ?? { lat: 32.0753, lng: 34.7818 }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Traffic tiles follow real geography, so they are never laid over the schematic HOP City.
  const showTrafficTiles = trafficTiles && mapConfig.trafficTiles && !offline;
  useEffect(() => {
    cameraRef.current = { pitch, bearing };
    routeStyleRef.current = routeStyle;
    trafficRef.current = { segments: traffic, tiles: showTrafficTiles, heat };
  });

  // ── map lifecycle ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current || failed) return;
    const city = () => cityStyle(theme);
    const fillCity = () =>
      loadCityData(new URL(CITY_DATA_PATH, window.location.origin).href)
        .then((fc) => (map.getSource("city") as GeoJSONSource | undefined)?.setData(fc))
        .catch((err) => console.warn("[map] city data unavailable", err));
    let map: MLMap;
    try {
      map = new MLMap({
        container: containerRef.current,
        style: styleUrl || city(),
        center: [initialCenter.lng, initialCenter.lat],
        zoom,
        pitch,
        bearing,
        maxPitch: 70,
        attributionControl: { compact: true },
        interactive,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        maxZoom: 18.5,
        minZoom: 8,
        fadeDuration: 150,
        canvasContextAttributes: { antialias: true },
      });
    } catch (err) {
      // No WebGL context (or MapLibre refused it): keep the page usable without a map.
      console.warn("[map] could not start", err);
      const t = window.setTimeout(() => setFailed(true), 0);
      return () => window.clearTimeout(t);
    }
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __hopMap?: MLMap }).__hopMap = map;
    if (styleUrl) ensureRtlTextPlugin();

    let usingCity = !styleUrl;
    let loaded = false;
    const errorTimes: number[] = [];
    const toCity = () => {
      if (usingCity) return;
      usingCity = true;
      setOffline(true);
      try {
        map.setStyle(city(), { diff: false });
      } catch {
        /* ignore */
      }
    };
    const timer = styleUrl ? window.setTimeout(() => !map.isStyleLoaded() && toCity(), STYLE_TIMEOUT_MS) : 0;
    map.on("error", (e: { error?: { message?: string; status?: number }; sourceId?: string }) => {
      // The traffic overlay is optional: its failures never take the basemap down.
      if (usingCity || e.sourceId === "hop-traffic-tiles") return;
      const msg = String(e.error?.message ?? "");
      const network = msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed") || msg.includes("style") || (e.error?.status ?? 0) >= 400;
      if (!network) return;
      // Before the first load any failure means no basemap; afterwards only a burst of tile failures does.
      const now = Date.now();
      errorTimes.push(now);
      while (errorTimes.length && now - errorTimes[0] > 10_000) errorTimes.shift();
      if (!loaded || errorTimes.length >= 6) toCity();
    });
    map.on("style.load", () => {
      try {
        if (usingCity) void fillCity();
        else enhanceRealTiles(map, theme);
        installOverlays(map, routeRef.current, trailRef.current.length > 1 ? trailRef.current : null);
        applyRouteStyle(map, routeStyleRef.current);
        setTraffic(map, trafficRef.current.segments);
        setHeat(map, trafficRef.current.heat);
        buildingDepth(map);
        if (!usingCity) setTrafficTiles(map, trafficRef.current.tiles);
      } catch (err) {
        console.warn("[map] overlay install failed", err);
      }
    });
    map.on("load", () => {
      loaded = true;
      setReady(true);
      emitReady(map);
    });
    type Ev = { hopAmbient?: boolean; originalEvent?: unknown };
    map.on("movestart", (e: Ev) => {
      if (!e.hopAmbient) emitMoveStart();
    });
    map.on("moveend", (e: Ev) => {
      if (e.hopAmbient) return;
      const c = map.getCenter();
      emitMoveEnd({ lat: c.lat, lng: c.lng }, map.getZoom());
    });
    const setBand = () => {
      if (wrapRef.current) wrapRef.current.dataset.zb = zoomBand(map.getZoom());
    };
    setBand();
    map.on("zoom", setBand);
    let depthRaf = 0;
    map.on("pitch", () => {
      cancelAnimationFrame(depthRaf);
      depthRaf = requestAnimationFrame(() => buildingDepth(map));
    });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    const markerStore = markerRefs.current;
    const glideStore = glides.current;
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(glideRaf.current);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerStore.clear();
      glideStore.clear();
      labelRefs.current = [];
      radarRef.current = null;
    };
  }, [failed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── camera: centre ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const c = map.getCenter();
    if (Math.abs(c.lat - center.lat) < 1e-6 && Math.abs(c.lng - center.lng) < 1e-6) return;
    map.easeTo({ center: [center.lng, center.lat], zoom: map.getZoom() < 11 ? zoom : map.getZoom(), ...cameraRef.current, duration: 600 });
  }, [center?.lat, center?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── camera: pitch / bearing ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (Math.abs(map.getPitch() - pitch) < 0.5 && Math.abs(map.getBearing() - bearing) < 0.5) return;
    map.easeTo({ pitch, bearing, duration: reducedMotion() ? 0 : 1100, easing: easeOutCubic });
  }, [pitch, bearing]);

  // ── ambient drift ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ambient || !ready || reducedMotion()) return;
    let raf = 0;
    let last = performance.now();
    let pausedUntil = 0;
    const pause = () => {
      pausedUntil = performance.now() + 5000;
    };
    map.on("dragstart", pause);
    map.on("zoomstart", pause);
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (now > pausedUntil && !map.isMoving() && document.visibilityState === "visible") {
        map.setBearing(map.getBearing() + dt * 0.0016, { hopAmbient: true });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      map.off("dragstart", pause);
      map.off("zoomstart", pause);
    };
  }, [ambient, ready]);

  // ── markers (diffed by id; cars glide between updates) ──
  const runGlides = useEffectEvent(() => {
    cancelAnimationFrame(glideRaf.current);
    const step = (now: number) => {
      let active = false;
      for (const [id, g] of glides.current) {
        const mk = markerRefs.current.get(id);
        if (!mk) {
          glides.current.delete(id);
          continue;
        }
        const t = g.dur > 0 ? Math.min(1, (now - g.start) / g.dur) : 1;
        g.cur = [g.from[0] + (g.to[0] - g.from[0]) * t, g.from[1] + (g.to[1] - g.from[1]) * t];
        mk.setLngLat(g.cur);
        if (trail && mk.getElement().dataset.kind === "driver") pushTrail(trailRef.current, g.cur);
        if (t < 1) active = true;
      }
      if (now - trailFlush.current > 60 || !active) {
        trailFlush.current = now;
        const map = mapRef.current;
        const pts = trailRef.current;
        if (map?.getSource("hop-trail")) setLine(map, "hop-trail", pts.length > 1 ? pts : null);
      }
      if (active) glideRaf.current = requestAnimationFrame(step);
    };
    glideRaf.current = requestAnimationFrame(step);
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const seen = new Set<string>();
    const now = performance.now();
    let gliding = false;
    let hasDriver = false;
    for (const m of markers) {
      seen.add(m.id);
      if (m.kind === "driver") hasDriver = true;
      let existing = markerRefs.current.get(m.id);
      if (existing && existing.getElement().dataset.kind !== m.kind) {
        existing.remove();
        markerRefs.current.delete(m.id);
        glides.current.delete(m.id);
        existing = undefined;
      }
      if (existing) {
        const el = existing.getElement();
        const isCar = m.kind === "driver" || m.kind === "nearby";
        if (isCar) {
          setCarHeading(el, m.heading);
          const g = glides.current.get(m.id);
          const cur = g?.cur ?? (existing.getLngLat().toArray() as [number, number]);
          const to: [number, number] = [m.lng, m.lat];
          if (cur[0] !== to[0] || cur[1] !== to[1]) {
            // Glide over the interval between updates (capped), so 1 Hz GPS looks continuous.
            const since = g ? now - g.last : 1000;
            const dur = reducedMotion() || distM(cur, to) > 600 ? 0 : Math.min(1200, Math.max(0, since));
            glides.current.set(m.id, { from: cur, to, start: now, dur, last: now, cur });
            gliding = true;
          }
        } else {
          existing.setLngLat([m.lng, m.lat]);
        }
        const label = el.querySelector<HTMLElement>(".hop-marker-label");
        if (label && m.label && label.textContent !== m.label) label.textContent = m.label;
      } else {
        const mk = new Marker({ element: pinElement(m), anchor: "center" }).setLngLat([m.lng, m.lat]).addTo(map);
        markerRefs.current.set(m.id, mk);
        if (m.kind === "driver" || m.kind === "nearby") glides.current.set(m.id, { from: [m.lng, m.lat], to: [m.lng, m.lat], start: now, dur: 0, last: now, cur: [m.lng, m.lat] });
      }
    }
    for (const [id, mk] of markerRefs.current) {
      if (!seen.has(id)) {
        mk.remove();
        markerRefs.current.delete(id);
        glides.current.delete(id);
      }
    }
    if (!hasDriver && trailRef.current.length) {
      trailRef.current = [];
      if (map.getSource("hop-trail")) setLine(map, "hop-trail", null);
    }
    if (gliding) runGlides();
  }, [markers]);

  // ── route: data + draw-in ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const coords = polyline && polyline.length > 1 ? polyline.map(([lat, lng]) => [lng, lat]) : null;
    routeRef.current = coords;
    if (!map.getSource("hop-route")) installOverlays(map, coords, null);
    const endKey = coords ? coords[coords.length - 1].map((v) => v.toFixed(4)).join(",") : "";
    const fresh = endKey !== routeEndKey.current;
    routeEndKey.current = endKey;
    if (!coords || !fresh || !drawRoute || reducedMotion()) {
      setLine(map, "hop-route", coords);
      return;
    }
    // A new destination: the route draws itself in.
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const full = routeRef.current;
      if (!full) return;
      setLine(map, "hop-route", sliceLine(full, easeOutCubic(t)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setLine(map, "hop-route", routeRef.current);
    };
  }, [polyline, ready, drawRoute]);

  // ── traffic: congestion on the route + live overlay ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !map.getSource("hop-traffic")) return;
    setTraffic(map, traffic);
  }, [traffic, ready]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      setTrafficTiles(map, showTrafficTiles);
    } catch {
      /* style swapping */
    }
  }, [showTrafficTiles, ready]);

  // ── demand heat ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    try {
      setHeat(map, heat);
    } catch {
      /* style swapping */
    }
  }, [heat, ready]);

  // ── route: style + travelling light ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    applyRouteStyle(map, routeStyle);
    const hasRoute = !!polyline && polyline.length > 1;
    if (routeStyle !== "trip" || !hasRoute || reducedMotion()) return;
    let raf = 0;
    let lastPaint = 0;
    const PERIOD = 2800;
    const tick = (now: number) => {
      if (now - lastPaint > 33 && document.visibilityState === "visible") {
        lastPaint = now;
        // -0.15 … 1.25: the light runs the route, then pauses off-screen.
        const p = ((now % PERIOD) / PERIOD) * 1.4 - 0.15;
        try {
          if (map.getLayer("hop-route-flow")) map.setPaintProperty("hop-route-flow", "line-gradient", cometGradient(p > 1.02 ? -1 : p));
        } catch {
          /* style swapping */
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [routeStyle, ready, polyline]);

  // ── radar ──
  const radarLat = radar?.lat;
  const radarLng = radar?.lng;
  const radarSize = radar?.size ?? 280;
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (radarLat == null || radarLng == null) {
      radarRef.current?.remove();
      radarRef.current = null;
      return;
    }
    if (!radarRef.current) {
      radarRef.current = new Marker({ element: radarElement(radarSize), anchor: "center", pitchAlignment: "map", rotationAlignment: "map" }).setLngLat([radarLng, radarLat]).addTo(map);
    } else {
      radarRef.current.setLngLat([radarLng, radarLat]);
    }
  }, [radarLat, radarLng, radarSize]);
  useEffect(
    () => () => {
      radarRef.current?.remove();
      radarRef.current = null;
    },
    [],
  );

  // ── HOP City place labels ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const mk of labelRefs.current) mk.remove();
    labelRefs.current = [];
    if (!offline) return;
    for (const l of CITY_LABELS) {
      const el = document.createElement("div");
      // MapLibre sets inline opacity on marker elements, so zoom fading targets an inner span.
      el.className = "hop-city-label";
      el.dataset.tier = l.tier;
      const text = document.createElement("span");
      text.textContent = l.name;
      el.appendChild(text);
      el.setAttribute("aria-hidden", "true");
      labelRefs.current.push(new Marker({ element: el, anchor: "center" }).setLngLat([l.lng, l.lat]).addTo(map));
    }
  }, [offline]);

  // ── fit bounds (padding-aware for a single point too, so it is not hidden behind the sheet) ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fit || fit.length === 0) return;
    const padding = safePadding(map, { top: 80, bottom: 320, left: 40, right: 40, ...fitPadding });
    const cam = cameraRef.current;
    try {
      if (fit.length === 1) {
        map.easeTo({
          center: [fit[0].lng, fit[0].lat],
          zoom: Math.max(map.getZoom(), 15),
          offset: [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2],
          ...cam,
          duration: 500,
        });
        return;
      }
      const b = new LngLatBounds();
      for (const p of fit) b.extend([p.lng, p.lat]);
      map.fitBounds(b, { padding, maxZoom: 16, duration: 800, ...cam });
    } catch (err) {
      console.warn("[map] fit failed", err);
    }
  }, [fit, fitPadding]);

  return (
    <div ref={wrapRef} className={cn("hop-map relative h-full w-full overflow-hidden", className)} data-map-offline={offline || undefined} data-map-theme={theme}>
      <div ref={containerRef} className="hop-map-container absolute inset-0" style={{ position: "absolute", inset: 0 }} />
      {failed && (
        <div className="hop-map-unavailable absolute inset-0 grid place-items-center p-6 text-center" role="note">
          <p className="max-w-[260px] text-sm font-semibold text-ink-500">המפה אינה זמינה במכשיר הזה. אפשר להמשיך להזמין ולעקוב אחרי הנסיעה.</p>
        </div>
      )}
      {children}
    </div>
  );
}

/** Trip: glow + white casing + gradient line + travelling light. Guide: a dashed hint only. */
function applyRouteStyle(map: MLMap, style: "trip" | "guide") {
  if (!map.getLayer("hop-route-line")) return;
  const guide = style === "guide";
  try {
    map.setLayoutProperty("hop-route-glow", "visibility", guide ? "none" : "visible");
    map.setLayoutProperty("hop-route-flow", "visibility", guide ? "none" : "visible");
    map.setPaintProperty("hop-route-casing", "line-opacity", guide ? 0.7 : 0.95);
    map.setPaintProperty("hop-route-casing", "line-width", guide ? 7 : 11);
    map.setPaintProperty("hop-route-line", "line-width", guide ? 4 : 6);
    // line-dasharray disables line-gradient, so the guide falls back to line-color.
    map.setPaintProperty("hop-route-line", "line-color", "#2457FF");
    map.setPaintProperty("hop-route-line", "line-dasharray", guide ? [1.1, 1.7] : undefined);
  } catch {
    /* style swapping */
  }
}
