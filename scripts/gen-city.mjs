/**
 * Generates /public/map/hop-city.json — a stylised, illustrative map of Gush Dan
 * used whenever real vector tiles are unavailable (offline, blocked networks,
 * tests). Not survey data: coastline and main roads are approximate, the street
 * grid and buildings are procedural (seeded, deterministic).
 *
 *   node scripts/gen-city.mjs
 */
import fs from "node:fs";
import path from "node:path";

// ── deterministic PRNG ──
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261018);
const r5 = (n) => Math.round(n * 1e5) / 1e5;

// ── geometry helpers ──
const C = { lat: 32.075, lng: 34.785 };
const M_LAT = 110540;
const M_LNG = 111320 * Math.cos((C.lat * Math.PI) / 180);
const toXY = (lat, lng) => [(lng - C.lng) * M_LNG, (lat - C.lat) * M_LAT];
const toLL = (x, y) => [r5(C.lng + x / M_LNG), r5(C.lat + y / M_LAT)]; // [lng, lat]
const TH = (18 * Math.PI) / 180; // Tel Aviv grid runs roughly NNE
const rot = (u, v) => [u * Math.cos(TH) + v * Math.sin(TH), -u * Math.sin(TH) + v * Math.cos(TH)];
const llFromUV = (u, v) => {
  const [x, y] = rot(u, v);
  return toLL(x, y);
};

// Coastline (south → north), [lat, lng]
const COAST = [
  [31.94, 34.716], [31.97, 34.725], [32.0, 34.733], [32.015, 34.738], [32.03, 34.742], [32.045, 34.748],
  [32.054, 34.751], [32.062, 34.759], [32.07, 34.763], [32.082, 34.767], [32.09, 34.769], [32.098, 34.772],
  [32.105, 34.777], [32.122, 34.785], [32.14, 34.79], [32.163, 34.795], [32.18, 34.8], [32.23, 34.812],
];
function coastLng(lat) {
  if (lat <= COAST[0][0]) return COAST[0][1];
  for (let i = 1; i < COAST.length; i++) {
    const [la, lo] = COAST[i];
    const [pla, plo] = COAST[i - 1];
    if (lat <= la) return plo + ((lat - pla) / (la - pla)) * (lo - plo);
  }
  return COAST[COAST.length - 1][1];
}
const onLand = (lng, lat) => lng > coastLng(lat) + 0.0012;

function pointInPoly([lng, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

// ── parks & water ──
const PARKS = {
  "פארק הירקון": [[34.792, 32.1025], [34.799, 32.109], [34.81, 32.1125], [34.826, 32.111], [34.836, 32.1055], [34.828, 32.0995], [34.813, 32.1005], [34.8, 32.0975], [34.792, 32.1025]],
  "גן העצמאות": [[34.7685, 32.0878], [34.7712, 32.0915], [34.7752, 32.0902], [34.7722, 32.0868], [34.7685, 32.0878]],
  "הפארק הלאומי": [[34.818, 32.0445], [34.82, 32.0525], [34.8315, 32.0535], [34.8335, 32.046], [34.826, 32.0425], [34.818, 32.0445]],
  "שרונה": [[34.7845, 32.0702], [34.7852, 32.0728], [34.7885, 32.0726], [34.7878, 32.0699], [34.7845, 32.0702]],
  "גן מאיר": [[34.7722, 32.0705], [34.7726, 32.0722], [34.775, 32.0721], [34.7746, 32.0704], [34.7722, 32.0705]],
  "פארק החורשות": [[34.8, 32.118], [34.802, 32.124], [34.812, 32.125], [34.813, 32.119], [34.8, 32.118]],
};
const RIVER = [[34.7745, 32.1005], [34.785, 32.1025], [34.797, 32.1045], [34.808, 32.1065], [34.818, 32.1055], [34.829, 32.1035], [34.84, 32.1005], [34.855, 32.0985], [34.875, 32.0975], [34.9, 32.098]];
const inPark = (ll) => Object.values(PARKS).some((ring) => pointInPoly(ll, ring));
function nearRiver([lng, lat], m = 60) {
  for (let i = 1; i < RIVER.length; i++) {
    const [ax, ay] = toXY(RIVER[i - 1][1], RIVER[i - 1][0]);
    const [bx, by] = toXY(RIVER[i][1], RIVER[i][0]);
    const [px, py] = toXY(lat, lng);
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < m) return true;
  }
  return false;
}

// ── main roads (approximate real geometry), [lng, lat] ──
const ROADS = {
  highway: {
    "נתיבי איילון": [[34.775, 32.02], [34.785, 32.04], [34.788, 32.055], [34.791, 32.066], [34.793, 32.074], [34.797, 32.084], [34.8, 32.094], [34.804, 32.104], [34.81, 32.118], [34.818, 32.135], [34.823, 32.15], [34.83, 32.17]],
    "כביש 2": [[34.795, 32.105], [34.8, 32.12], [34.808, 32.14], [34.815, 32.16], [34.82, 32.18], [34.826, 32.2]],
    "כביש 1": [[34.791, 32.062], [34.805, 32.055], [34.825, 32.045], [34.845, 32.035], [34.865, 32.015], [34.87, 32.0], [34.89, 31.99]],
  },
  major: {
    "דרך נמיר": [[34.789, 32.085], [34.791, 32.095], [34.793, 32.105], [34.796, 32.115], [34.8, 32.125]],
    "אבן גבירול": [[34.781, 32.064], [34.781, 32.073], [34.7815, 32.081], [34.782, 32.09], [34.785, 32.1]],
    "דיזנגוף": [[34.7745, 32.071], [34.7745, 32.0755], [34.7735, 32.08], [34.775, 32.09], [34.7785, 32.097]],
    "אלנבי": [[34.7685, 32.0615], [34.77, 32.066], [34.7695, 32.072], [34.7665, 32.075]],
    "שדרות רוטשילד": [[34.7705, 32.062], [34.773, 32.065], [34.776, 32.067], [34.779, 32.068]],
    "דרך בגין": [[34.787, 32.058], [34.789, 32.066], [34.792, 32.074], [34.795, 32.081]],
    "ארלוזורוב": [[34.772, 32.087], [34.781, 32.087], [34.792, 32.0855], [34.802, 32.0825]],
    "ז'בוטינסקי": [[34.802, 32.085], [34.82, 32.087], [34.84, 32.089], [34.86, 32.09], [34.88, 32.091]],
    "הירקון": [[34.767, 32.075], [34.768, 32.085], [34.771, 32.095]],
    "שדרות ירושלים": [[34.769, 32.06], [34.765, 32.05], [34.76, 32.04], [34.756, 32.03]],
    "קיבוץ גלויות": [[34.76, 32.05], [34.78, 32.048], [34.795, 32.05], [34.81, 32.052]],
    "איינשטיין": [[34.788, 32.112], [34.8, 32.114], [34.81, 32.116]],
    "ראול ולנברג": [[34.806, 32.105], [34.82, 32.107], [34.84, 32.11]],
    "דרך השלום": [[34.793, 32.0735], [34.805, 32.0705], [34.82, 32.067], [34.835, 32.064]],
    "קפלן": [[34.7815, 32.0738], [34.786, 32.0742], [34.791, 32.0748]],
  },
};

const features = [];
const add = (kind, geometry, props = {}) => features.push({ type: "Feature", properties: { kind, ...props }, geometry });

// sea: from coastline westwards
const seaRing = [[34.5, 31.9], ...COAST.map(([la, lo]) => [lo, la]), [34.5, 32.25], [34.5, 31.9]];
add("sea", { type: "Polygon", coordinates: [seaRing] });
for (const [name, ring] of Object.entries(PARKS)) add("park", { type: "Polygon", coordinates: [ring] }, { name });
add("river", { type: "LineString", coordinates: RIVER }, { name: "הירקון" });

// beach strip
const beach = [...COAST.slice(2, 16).map(([la, lo]) => [lo, la]), ...COAST.slice(2, 16).reverse().map(([la, lo]) => [lo + 0.0018, la])];
beach.push(beach[0]);
add("beach", { type: "Polygon", coordinates: [beach] });

// ── procedural street grid (straight lines clipped to land; only run endpoints are stored) ──
const ZONE = { minLat: 31.985, maxLat: 32.165, maxLng: 34.875 };
const inZone = ([lng, lat]) => lat > ZONE.minLat && lat < ZONE.maxLat && lng < ZONE.maxLng;
// Irregular street spacing (real blocks are not a perfect lattice).
const linesBetween = (from, to) => {
  const out = [];
  for (let x = from; x <= to; x += 95 + rand() * 80) out.push(Math.round(x));
  return out;
};
const US = linesBetween(-7800, 7800);
const VS = linesBetween(-11200, 11200);
const keep = (ll) => inZone(ll) && onLand(ll[0], ll[1]) && !inPark(ll) && !nearRiver(ll, 35);
let roadCount = 0;
function gridLine(fixed, alongU, cls) {
  let run = [];
  const flush = () => {
    if (run.length >= 2) {
      add("road", { type: "LineString", coordinates: [run[0], run[run.length - 1]] }, { class: cls });
      roadCount++;
    }
    run = [];
  };
  let gap = 0;
  for (let s = -11000; s <= 11000; s += 45) {
    const ll = alongU ? llFromUV(s, fixed) : llFromUV(fixed, s);
    // Minor streets sometimes stop for a block or two (T-junctions, plazas).
    if (gap <= 0 && cls === "minor" && rand() < 0.014) gap = 3 + Math.floor(rand() * 4);
    if (gap > 0) {
      gap--;
      flush();
      continue;
    }
    if (keep(ll)) run.push(ll);
    else flush();
  }
  flush();
}
US.forEach((u, i) => gridLine(u, false, i % 6 === 0 ? "medium" : "minor"));
VS.forEach((v, j) => gridLine(v, true, j % 6 === 0 ? "medium" : "minor"));

for (const [cls, roads] of Object.entries(ROADS)) for (const [name, coords] of Object.entries(roads)) add("road", { type: "LineString", coordinates: coords }, { class: cls, name });

// ── buildings ──
// Stored compactly as flat [lng, lat, width m, depth m, height m] tuples, all
// aligned to the street grid; the client expands them into rotated footprints.
const HOTSPOTS = [
  { lat: 32.0745, lng: 34.792, r: 900, min: 70, max: 230 }, // Azrieli / Sarona towers
  { lat: 32.084, lng: 34.803, r: 700, min: 60, max: 170 }, // Ramat Gan diamond district
  { lat: 32.064, lng: 34.775, r: 500, min: 40, max: 120 }, // Rothschild
  { lat: 32.11, lng: 34.84, r: 700, min: 40, max: 120 }, // Ramat HaHayal
];
const LOW = [{ lat: 32.053, lng: 34.753, r: 650 }]; // old Jaffa
const BZONE = { minLat: 32.0, maxLat: 32.135, maxLng: 34.86 };
const B = [];
const okSpot = (ll) => onLand(ll[0], ll[1]) && onLand(ll[0] - 0.0006, ll[1]) && !inPark(ll) && !nearRiver(ll, 70) && ll[1] > BZONE.minLat && ll[1] < BZONE.maxLat && ll[0] < BZONE.maxLng;
function hotspotAt(cx, cy) {
  let best = null;
  for (const hs of HOTSPOTS) {
    const [hx, hy] = toXY(hs.lat, hs.lng);
    const d = Math.hypot(cx - hx, cy - hy);
    if (d < hs.r && (!best || d / hs.r < best.f)) best = { hs, f: d / hs.r };
  }
  return best;
}
const inLow = (cx, cy) => LOW.some((lw) => { const [lx, ly] = toXY(lw.lat, lw.lng); return Math.hypot(cx - lx, cy - ly) < lw.r; });
function put(u, v, w, d, h) {
  const ll = llFromUV(u, v);
  if (!okSpot(ll)) return;
  B.push(ll[0], ll[1], Math.round(w), Math.round(d), Math.round(h));
}
const ROAD_HALF = 11; // street + sidewalk, from the block edge
for (let i = 0; i + 1 < US.length; i++) {
  for (let j = 0; j + 1 < VS.length; j++) {
    const cu = (US[i] + US[i + 1]) / 2;
    const cv = (VS[j] + VS[j + 1]) / 2;
    const sideU = US[i + 1] - US[i] - ROAD_HALF * 2;
    const sideV = VS[j + 1] - VS[j] - ROAD_HALF * 2;
    const c = llFromUV(cu, cv);
    if (!okSpot(c)) continue;
    const [cx, cy] = toXY(c[1], c[0]);
    const dist = Math.hypot(cx - 0, cy - 0);
    const hot = hotspotAt(cx, cy);
    const low = inLow(cx, cy);
    if (hot && rand() < 0.75 - hot.f * 0.4) {
      // A tower block: one to three tall footprints, plaza around them.
      const n = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const w = 26 + rand() * 20;
        const d = 24 + rand() * 18;
        const ou = n === 1 ? (rand() - 0.5) * 20 : (k - (n - 1) / 2) * 42;
        const ov = (rand() - 0.5) * 36;
        const h = hot.hs.min + rand() * (hot.hs.max - hot.hs.min) * (1 - hot.f * 0.7);
        put(cu + ou, cv + ov, w, d, h);
      }
      continue;
    }
    // Perimeter block: buildings line the four streets around a courtyard.
    const keepP = dist < 3200 ? 0.85 : dist < 6000 ? 0.3 : 0.07;
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      // Sides 0/2 run along u (length sideU), sides 1/3 along v.
      const len = sIdx % 2 === 0 ? sideU : sideV;
      const across = sIdx % 2 === 0 ? sideV : sideU;
      let t = -len / 2 + 2;
      while (t < len / 2 - 12) {
        const w = 13 + rand() * 11;
        const d = Math.min(13 + rand() * 9, across / 2 - 4);
        if (t + w > len / 2 || d < 8) break;
        if (rand() < keepP) {
          const along = t + w / 2;
          const inward = across / 2 - d / 2 - 1.5;
          let u = 0, v = 0, bw = w, bd = d;
          if (sIdx === 0) { u = along; v = -inward; }
          else if (sIdx === 1) { u = inward; v = along; bw = d; bd = w; }
          else if (sIdx === 2) { u = -along; v = inward; }
          else { u = -inward; v = -along; bw = d; bd = w; }
          let h = low ? 6 + rand() * 8 : 11 + rand() * 15;
          if (!low && rand() < 0.07) h = 30 + rand() * 22;
          if (hot) h = Math.max(h, hot.hs.min * 0.4 * (1 - hot.f) + rand() * 20);
          put(cu + u, cv + v, bw, bd, h);
        }
        t += w + 3 + rand() * 5;
      }
    }
  }
}
const bCount = B.length / 5;

const out = { type: "FeatureCollection", features, hop: { gridAngle: 18, buildings: B } };
const file = path.resolve(process.cwd(), "public/map/hop-city.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log(`roads ${roadCount}+${Object.values(ROADS).reduce((a, r) => a + Object.keys(r).length, 0)}, buildings ${bCount}, ${(fs.statSync(file).size / 1024).toFixed(0)} KB → ${file}`);
