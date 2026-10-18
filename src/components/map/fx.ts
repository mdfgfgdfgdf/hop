/**
 * Map effects shared by every HOP map: the layered route (glow, casing, line
 * and a travelling light "comet"), the car's fading trail, the top-view car
 * and radar elements, and the 3D/tint upgrade applied to real vector tiles.
 * Layer ids `hop-route-casing` and `hop-route-line` are public: callers may
 * restyle them (the driver map dashes the pickup guide).
 */
import type { ExpressionSpecification, GeoJSONSource, Map as MLMap } from "maplibre-gl";

export const BRAND = "#2457FF";

type LineFC = { type: "FeatureCollection"; features: { type: "Feature"; properties: Record<string, never>; geometry: { type: "LineString"; coordinates: number[][] } }[] };

export const lineFC = (coords: number[][] | null | undefined): LineFC => ({
  type: "FeatureCollection",
  features: coords && coords.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [],
});

/** (Re)installs route + trail sources and layers on the current style. Idempotent. */
export function installOverlays(map: MLMap, route: number[][] | null, trail: number[][] | null) {
  if (!map.getSource("hop-route")) {
    map.addSource("hop-route", { type: "geojson", data: lineFC(route), lineMetrics: true } as Parameters<MLMap["addSource"]>[1]);
  }
  if (!map.getSource("hop-trail")) {
    map.addSource("hop-trail", { type: "geojson", data: lineFC(trail), lineMetrics: true } as Parameters<MLMap["addSource"]>[1]);
  }
  const cap = { "line-cap": "round" as const, "line-join": "round" as const };
  if (!map.getLayer("hop-route-glow")) {
    map.addLayer({ id: "hop-route-glow", type: "line", source: "hop-route", layout: cap, paint: { "line-color": BRAND, "line-width": 26, "line-blur": 16, "line-opacity": 0.36 } });
  }
  if (!map.getLayer("hop-route-casing")) {
    map.addLayer({ id: "hop-route-casing", type: "line", source: "hop-route", layout: cap, paint: { "line-color": "#ffffff", "line-width": 11, "line-opacity": 0.96 } });
  }
  if (!map.getLayer("hop-route-line")) {
    map.addLayer({
      id: "hop-route-line",
      type: "line",
      source: "hop-route",
      layout: cap,
      paint: {
        "line-width": 6,
        // Deep brand at the start → bright brand at the destination.
        "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "#1a3fd6", 1, "#4f7bff"],
      },
    });
  }
  if (!map.getLayer("hop-route-flow")) {
    map.addLayer({ id: "hop-route-flow", type: "line", source: "hop-route", layout: cap, paint: { "line-width": 3.5, "line-gradient": cometGradient(-1), "line-opacity": 0.9 } });
  }
  if (!map.getLayer("hop-trail-line")) {
    map.addLayer({
      id: "hop-trail-line",
      type: "line",
      source: "hop-trail",
      layout: cap,
      paint: {
        "line-width": 7,
        "line-blur": 1.5,
        "line-gradient": ["interpolate", ["linear"], ["line-progress"], 0, "rgba(36,87,255,0)", 0.7, "rgba(36,87,255,0.28)", 1, "rgba(36,87,255,0.55)"],
      },
    });
  }
}

export function setLine(map: MLMap, id: "hop-route" | "hop-trail", coords: number[][] | null) {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  src?.setData(lineFC(coords));
}

/** A soft white highlight band centred at progress p (p < 0 → invisible). */
export function cometGradient(p: number): ExpressionSpecification {
  const head = Math.min(0.999, Math.max(0.002, p));
  const tail = Math.max(0.0005, head - 0.16);
  const after = Math.min(0.9995, head + 0.012);
  if (p < 0) return ["interpolate", ["linear"], ["line-progress"], 0, "rgba(255,255,255,0)", 1, "rgba(255,255,255,0)"] as ExpressionSpecification;
  const stops: (number | string)[] = [0, "rgba(255,255,255,0)"];
  if (tail > 0.0005) stops.push(tail, "rgba(255,255,255,0)");
  stops.push(head, "rgba(255,255,255,0.95)", after, "rgba(255,255,255,0)", 1, "rgba(255,255,255,0)");
  return ["interpolate", ["linear"], ["line-progress"], ...stops] as unknown as ExpressionSpecification;
}

// ───────────────────────── geometry helpers ─────────────────────────

const M_PER_DEG = 111_320;
export function distM(a: number[], b: number[]) {
  const k = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * M_PER_DEG * k, (a[1] - b[1]) * M_PER_DEG);
}

/** The first `t` (0..1) of a line, by length, ending on an interpolated point. */
export function sliceLine(coords: number[][], t: number) {
  if (t >= 1 || coords.length < 2) return coords;
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = distM(coords[i - 1], coords[i]);
    seg.push(d);
    total += d;
  }
  let left = total * Math.max(0, t);
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (left >= seg[i - 1]) {
      out.push(coords[i]);
      left -= seg[i - 1];
      continue;
    }
    const f = seg[i - 1] ? left / seg[i - 1] : 0;
    const a = coords[i - 1];
    const b = coords[i];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    break;
  }
  if (out.length === 1) out.push(coords[0]);
  return out;
}

/** Shortest-turn angle: keeps a rotating marker from spinning the long way round. */
export function nextAngle(prev: number, target: number) {
  const delta = ((((target - prev) % 360) + 540) % 360) - 180;
  return prev + delta;
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ───────────────────────── marker elements ─────────────────────────

/** A top-view car in HOP colours; points north at 0°. */
export const CAR_TOP_SVG = `<svg viewBox="0 0 28 48" aria-hidden="true">
  <rect x="2.5" y="2" width="23" height="44" rx="10" fill="#ffffff" stroke="#c9cfdb" stroke-width="1"/>
  <rect x="4.6" y="5" width="18.8" height="38" rx="8" fill="#f2f4f9"/>
  <path d="M6.4 14.2 Q14 10.2 21.6 14.2 L20.3 20.6 Q14 18.9 7.7 20.6 Z" fill="#2457FF"/>
  <path d="M7.4 15.4 Q10.5 13.6 13.2 13.2 L12.7 15.1 Q10 15.6 7.9 17 Z" fill="#ffffff" opacity=".55"/>
  <rect x="8.2" y="21.4" width="11.6" height="10.6" rx="3" fill="#ffffff"/>
  <path d="M7.9 33 Q14 34.6 20.1 33 L21.2 37.6 Q14 39.8 6.8 37.6 Z" fill="#1a3fd6" opacity=".9"/>
  <rect x="5.2" y="2.9" width="5.4" height="2.4" rx="1.2" fill="#fff6c9"/>
  <rect x="17.4" y="2.9" width="5.4" height="2.4" rx="1.2" fill="#fff6c9"/>
  <rect x="5.4" y="43" width="5" height="2" rx="1" fill="#ff4d5e"/>
  <rect x="17.6" y="43" width="5" height="2" rx="1" fill="#ff4d5e"/>
  <rect x="0.6" y="15.5" width="2.6" height="3.6" rx="1.2" fill="#c9cfdb"/>
  <rect x="24.8" y="15.5" width="2.6" height="3.6" rx="1.2" fill="#c9cfdb"/>
</svg>`;

export function carElement(heading: number) {
  const el = document.createElement("div");
  el.className = "hop-car";
  const halo = document.createElement("div");
  halo.className = "hop-car-halo";
  const body = document.createElement("div");
  body.className = "hop-marker-car hop-car-body";
  body.innerHTML = CAR_TOP_SVG;
  body.style.transform = `rotate(${heading}deg)`;
  body.dataset.angle = String(heading);
  el.append(halo, body);
  return el;
}

export function setCarHeading(el: HTMLElement, heading: number | null | undefined) {
  const body = el.querySelector<HTMLElement>(".hop-car-body");
  if (!body || heading == null || !Number.isFinite(heading)) return;
  const prev = Number(body.dataset.angle ?? 0);
  const next = nextAngle(prev, heading);
  if (Math.abs(next - prev) < 0.5) return;
  body.dataset.angle = String(next);
  body.style.transform = `rotate(${next}deg)`;
}

/** The searching radar: rings + a conic sweep, laid flat on the map. */
export function radarElement(size: number) {
  const el = document.createElement("div");
  el.className = "hop-radar";
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.innerHTML = `<div class="hop-radar-sweep"></div><div class="hop-radar-ring r1"></div><div class="hop-radar-ring r2"></div><div class="hop-radar-ring r3"></div><div class="hop-radar-wave"></div><div class="hop-radar-wave w2"></div>`;
  return el;
}

// ───────────────────────── real tiles upgrade ─────────────────────────

/**
 * Best-effort polish for an OpenMapTiles style (OpenFreeMap positron):
 * brand-tinted water and parks, cool paper land, and 3D buildings.
 */
export function enhanceRealTiles(map: MLMap, theme: "light" | "dark") {
  const style = map.getStyle();
  if (!style?.layers) return;
  const dark = theme === "dark";
  let firstSymbol: string | undefined;
  for (const layer of style.layers) {
    try {
      if (layer.type === "symbol" && !firstSymbol) firstSymbol = layer.id;
      if (layer.type === "background") map.setPaintProperty(layer.id, "background-color", dark ? "#141820" : "#eef1f6");
      else if (layer.type === "fill" && /water|ocean|sea/i.test(layer.id)) map.setPaintProperty(layer.id, "fill-color", dark ? "#0e1a36" : "#cddcff");
      else if (layer.type === "fill" && /park|wood|grass|forest|landcover|cemetery|pitch/i.test(layer.id)) map.setPaintProperty(layer.id, "fill-color", dark ? "#13251c" : "#d7eedd");
      else if (layer.type === "line" && /waterway|river/i.test(layer.id)) map.setPaintProperty(layer.id, "line-color", dark ? "#173064" : "#bcd0ff");
    } catch {
      /* layer without that property */
    }
  }
  const sourceId = Object.entries(style.sources ?? {}).find(([, s]) => (s as { type?: string }).type === "vector")?.[0];
  if (!sourceId || map.getLayer("hop-3d-buildings")) return;
  try {
    map.addLayer(
      {
        id: "hop-3d-buildings",
        type: "fill-extrusion",
        source: sourceId,
        "source-layer": "building",
        minzoom: 13.5,
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 8], 0, dark ? "#1d222e" : "#e4e8f0", 30, dark ? "#252c3e" : "#d3daea", 140, dark ? "#2f3f74" : "#b4c3ef"],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 14.6, ["coalesce", ["get", "render_height"], 8]],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.9,
        },
      },
      firstSymbol,
    );
    map.setLight({ anchor: "viewport", color: "#ffffff", intensity: dark ? 0.25 : 0.42, position: [1.3, 210, 35] });
  } catch {
    /* style without a building layer */
  }
}
