/**
 * The hero map's illustrative ride: a HOP car comes up Ibn Gabirol to Rabin
 * Square, then drives Arlozorov and Dizengoff to the Tel Aviv port, on a loop.
 * Drawn on HOP City's main roads (approximate real geometry, so it also reads
 * on real tiles). Pure functions of time — these cars are illustrations and
 * exist only on the landing page.
 */
import type { MapMarker } from "@/components/map";
import type { LatLng, Polyline } from "@/lib/types";

export const PICKUP: LatLng = { lat: 32.0807, lng: 34.78138 };
export const DROPOFF: LatLng = { lat: 32.0971, lng: 34.77805 };
export const PICKUP_NAME = "כיכר רבין";
export const DROPOFF_NAME = "נמל תל אביב";

/** The driver's way in: north on Ibn Gabirol to the pickup. */
const APPROACH: Polyline = [
  [32.0712, 34.781],
  [32.073, 34.781],
  [32.0755, 34.7811],
  [32.0782, 34.78125],
  [32.0807, 34.78138],
];

/** The ride: Ibn Gabirol north → Arlozorov west → Dizengoff north to the port. */
export const TRIP: Polyline = [
  [32.0807, 34.78138],
  [32.0835, 34.78158],
  [32.0862, 34.7817],
  [32.0869, 34.78162],
  [32.087, 34.7795],
  [32.087, 34.777],
  [32.0869, 34.7748],
  [32.0874, 34.77462],
  [32.09, 34.775],
  [32.0918, 34.7759],
  [32.0935, 34.7768],
  [32.0953, 34.7776],
  [32.0971, 34.77805],
];

/** Points the hero map frames (stable reference for MapView's `fit`). */
export const FRAME: LatLng[] = [{ lat: APPROACH[0][0], lng: APPROACH[0][1] }, PICKUP, DROPOFF, { lat: 32.087, lng: 34.7735 }];

// ───────────────────────────── polyline helpers ─────────────────────────────

const M_LAT = 110_540;
const M_LNG = 111_320 * Math.cos((32.08 * Math.PI) / 180);
const segLen = (a: readonly number[], b: readonly number[]) => Math.hypot((b[0] - a[0]) * M_LAT, (b[1] - a[1]) * M_LNG);

type Path = { pts: Polyline; cum: number[]; len: number };
function path(pts: Polyline): Path {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + segLen(pts[i - 1], pts[i]));
  return { pts, cum, len: cum[cum.length - 1] };
}
const P_APPROACH = path(APPROACH);
const P_TRIP = path(TRIP);

/** Point and heading (degrees clockwise from north) at distance `d` metres along the path. */
function at(p: Path, d: number) {
  const dist = Math.min(p.len, Math.max(0, d));
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i] < dist) i++;
  const a = p.pts[i - 1];
  const b = p.pts[i];
  const span = p.cum[i] - p.cum[i - 1] || 1;
  const k = (dist - p.cum[i - 1]) / span;
  const heading = (Math.atan2((b[1] - a[1]) * M_LNG, (b[0] - a[0]) * M_LAT) * 180) / Math.PI;
  return { lat: a[0] + (b[0] - a[0]) * k, lng: a[1] + (b[1] - a[1]) * k, heading, index: i };
}

/** The rest of the path from fraction `t` to its end, starting at the car. */
function rest(p: Path, t: number): Polyline {
  const cur = at(p, t * p.len);
  return [[cur.lat, cur.lng], ...p.pts.slice(cur.index)];
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ───────────────────────────── other cars ─────────────────────────────

/** Main roads (from scripts/gen-city.mjs, [lat, lng]) that other cars cruise on. */
const ROADS: Polyline[] = [
  [[32.071, 34.7745], [32.0755, 34.7745], [32.08, 34.7735], [32.09, 34.775], [32.097, 34.7785]], // Dizengoff
  [[32.087, 34.772], [32.087, 34.781], [32.0855, 34.792], [32.0825, 34.802]], // Arlozorov
  [[32.075, 34.767], [32.085, 34.768], [32.095, 34.771]], // HaYarkon
  [[32.085, 34.789], [32.095, 34.791], [32.105, 34.793]], // Namir
];
const ROAD_PATHS = ROADS.map(path);
const CRUISERS = [
  { road: 0, speed: 26, offset: 300 },
  { road: 1, speed: 30, offset: 1600 },
  { road: 2, speed: 24, offset: 700 },
  { road: 3, speed: 32, offset: 400 },
];

function cruisers(sec: number): MapMarker[] {
  return CRUISERS.map((c, i) => {
    const p = ROAD_PATHS[c.road];
    const s = (c.offset + c.speed * sec) % (2 * p.len);
    const forward = s < p.len;
    const pos = at(p, forward ? s : 2 * p.len - s);
    return { id: `cruise-${i}`, kind: "nearby", lat: pos.lat, lng: pos.lng, heading: forward ? pos.heading : (pos.heading + 180) % 360 };
  });
}

// ───────────────────────────── the loop ─────────────────────────────

export type RideStage = "approach" | "arrived" | "ride" | "done";

export type Scene = {
  stage: RideStage;
  /** Whole minutes left in the current stage (for the Island ETA). */
  minutes: number;
  markers: MapMarker[];
  polyline: Polyline | null;
};

/** Seconds per stage; the loop is their sum. */
const STAGES: { stage: RideStage; dur: number; etaMin: number }[] = [
  { stage: "approach", dur: 12, etaMin: 4 },
  { stage: "arrived", dur: 3, etaMin: 0 },
  { stage: "ride", dur: 17, etaMin: 9 },
  { stage: "done", dur: 4, etaMin: 0 },
];
const LOOP = STAGES.reduce((a, s) => a + s.dur, 0);

const pickupPin: MapMarker = { id: "pickup", kind: "pickup", ...PICKUP, label: PICKUP_NAME };
const dropoffPin: MapMarker = { id: "dropoff", kind: "dropoff", ...DROPOFF, label: DROPOFF_NAME };

/** Everything on the hero map `sec` seconds into the page. */
export function sceneAt(sec: number): Scene {
  let t = sec % LOOP;
  let i = 0;
  while (i < STAGES.length - 1 && t >= STAGES[i].dur) {
    t -= STAGES[i].dur;
    i++;
  }
  const { stage, dur, etaMin } = STAGES[i];
  const k = Math.min(1, t / dur);
  const minutes = Math.max(1, Math.ceil(etaMin * (1 - k)));
  const others = cruisers(sec);
  if (stage === "approach") {
    const car = at(P_APPROACH, easeInOut(k) * P_APPROACH.len);
    return { stage, minutes, markers: [...others, pickupPin, dropoffPin, { id: "hop-car", kind: "driver", lat: car.lat, lng: car.lng, heading: car.heading }], polyline: TRIP };
  }
  if (stage === "arrived") {
    return { stage, minutes: 0, markers: [...others, pickupPin, dropoffPin, { id: "hop-car", kind: "driver", ...PICKUP, heading: 0 }], polyline: TRIP };
  }
  if (stage === "ride") {
    const e = easeInOut(k);
    const car = at(P_TRIP, e * P_TRIP.len);
    return { stage, minutes, markers: [...others, dropoffPin, { id: "hop-car", kind: "driver", lat: car.lat, lng: car.lng, heading: car.heading }], polyline: e < 0.985 ? rest(P_TRIP, e) : null };
  }
  const end = at(P_TRIP, P_TRIP.len);
  return { stage, minutes: 0, markers: [...others, dropoffPin, { id: "hop-car", kind: "driver", lat: end.lat, lng: end.lng, heading: end.heading }], polyline: null };
}

/** The reduced-motion picture: the driver on the way, nothing moving. */
export const STILL_SCENE: Scene = {
  stage: "approach",
  minutes: 3,
  markers: [pickupPin, dropoffPin, { id: "hop-car", kind: "driver", lat: APPROACH[2][0], lng: APPROACH[2][1], heading: 0 }],
  polyline: TRIP,
};
