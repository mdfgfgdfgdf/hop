import { describe, expect, it } from "vitest";
import { bearingDeg, haversineM, pointAlong, pointInRing, polylineLengthM } from "@/server/geo/haversine";
import type { Polyline } from "@/server/db/schema";
import { PLACES as TLV } from "../helpers/fixtures";

/** The seeded Gush Dan pilot polygon ([lng, lat], GeoJSON order). */
const GUSH_DAN: [number, number][] = [
  [34.7, 31.95],
  [34.7, 32.22],
  [34.95, 32.22],
  [34.95, 31.95],
  [34.7, 31.95],
];

describe("geo/haversine haversineM", () => {
  it("measures Dizengoff Center → Rabin Square at roughly 0.8 km", () => {
    const d = haversineM(TLV.dizengoff, TLV.rabin);
    expect(d).toBeGreaterThan(780);
    expect(d).toBeLessThan(820);
  });

  it("measures Dizengoff Center → Ben Gurion Airport at roughly 12 km", () => {
    const d = haversineM(TLV.dizengoff, TLV.airport);
    expect(d).toBeGreaterThan(11_500);
    expect(d).toBeLessThan(13_000);
  });

  it("is symmetric and zero for identical points", () => {
    expect(haversineM(TLV.rabin, TLV.dizengoff)).toBeCloseTo(haversineM(TLV.dizengoff, TLV.rabin), 9);
    expect(haversineM(TLV.rabin, TLV.rabin)).toBe(0);
  });

  it("matches one degree of latitude ≈ 111.2 km", () => {
    expect(haversineM({ lat: 32, lng: 34.8 }, { lat: 33, lng: 34.8 })).toBeCloseTo(111_195, -1);
  });
});

describe("geo/haversine bearingDeg", () => {
  const o = { lat: 32.08, lng: 34.78 };
  it("returns cardinal directions", () => {
    expect(bearingDeg(o, { lat: 32.09, lng: 34.78 })).toBeCloseTo(0, 3);
    expect(bearingDeg(o, { lat: 32.08, lng: 34.79 })).toBeCloseTo(90, 0);
    expect(bearingDeg(o, { lat: 32.07, lng: 34.78 })).toBeCloseTo(180, 3);
    expect(bearingDeg(o, { lat: 32.08, lng: 34.77 })).toBeCloseTo(270, 0);
  });

  it("always lies in [0, 360)", () => {
    for (const [dLat, dLng] of [[0.01, -0.0001], [-0.01, -0.01], [0.01, 0.01], [-0.0001, 0.01]]) {
      const b = bearingDeg(o, { lat: o.lat + dLat, lng: o.lng + dLng });
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    }
  });
});

describe("geo/haversine polylineLengthM", () => {
  const a: [number, number] = [32.0752, 34.7751];
  const b: [number, number] = [32.0807, 34.7805];
  const c: [number, number] = [32.0861, 34.7818];

  it("is zero for empty and single-point lines", () => {
    expect(polylineLengthM([])).toBe(0);
    expect(polylineLengthM([a])).toBe(0);
  });

  it("sums the segment lengths", () => {
    const ab = haversineM({ lat: a[0], lng: a[1] }, { lat: b[0], lng: b[1] });
    const bc = haversineM({ lat: b[0], lng: b[1] }, { lat: c[0], lng: c[1] });
    expect(polylineLengthM([a, b])).toBeCloseTo(ab, 6);
    expect(polylineLengthM([a, b, c])).toBeCloseTo(ab + bc, 6);
  });
});

describe("geo/haversine pointAlong", () => {
  const line: Polyline = [
    [32.0, 34.8],
    [32.02, 34.8],
  ];

  it("returns the endpoints at t=0 and t=1 and clamps outside [0,1]", () => {
    expect(pointAlong(line, 0)).toEqual({ lat: 32.0, lng: 34.8 });
    expect(pointAlong(line, 1)).toEqual({ lat: 32.02, lng: 34.8 });
    expect(pointAlong(line, -0.5)).toEqual({ lat: 32.0, lng: 34.8 });
    expect(pointAlong(line, 7)).toEqual({ lat: 32.02, lng: 34.8 });
  });

  it("returns the midpoint at t=0.5", () => {
    const p = pointAlong(line, 0.5);
    expect(p.lat).toBeCloseTo(32.01, 9);
    expect(p.lng).toBeCloseTo(34.8, 9);
  });

  it("walks across multiple segments by length, not by vertex count", () => {
    // First segment is 3× longer than the second; t=0.5 lands inside the first.
    const l: Polyline = [
      [32.0, 34.8],
      [32.03, 34.8],
      [32.04, 34.8],
    ];
    expect(pointAlong(l, 0.5).lat).toBeCloseTo(32.02, 6);
    expect(pointAlong(l, 0.875).lat).toBeCloseTo(32.035, 6);
  });

  it("handles degenerate inputs", () => {
    expect(pointAlong([], 0.5)).toEqual({ lat: 0, lng: 0 });
    expect(pointAlong([[32.1, 34.9]], 0.5)).toEqual({ lat: 32.1, lng: 34.9 });
    // Zero-length line (duplicate vertices) does not divide by zero.
    expect(pointAlong([[32.1, 34.9], [32.1, 34.9]], 0.5)).toEqual({ lat: 32.1, lng: 34.9 });
    // Leading duplicate vertex is skipped.
    const p = pointAlong([[32.0, 34.8], [32.0, 34.8], [32.02, 34.8]], 0.5);
    expect(p.lat).toBeCloseTo(32.01, 9);
    expect(Number.isFinite(p.lng)).toBe(true);
  });
});

describe("geo/haversine pointInRing", () => {
  it("accepts points inside the Gush Dan pilot area", () => {
    expect(pointInRing(TLV.dizengoff, GUSH_DAN)).toBe(true);
    expect(pointInRing(TLV.airport, GUSH_DAN)).toBe(true);
    expect(pointInRing({ lat: 32.1636, lng: 34.7966 }, GUSH_DAN)).toBe(true); // Herzliya marina
  });

  it("rejects points outside the area", () => {
    expect(pointInRing(TLV.jerusalem, GUSH_DAN)).toBe(false);
    expect(pointInRing({ lat: 32.8077, lng: 34.986 }, GUSH_DAN)).toBe(false); // Haifa
    expect(pointInRing({ lat: 31.2435, lng: 34.7975 }, GUSH_DAN)).toBe(false); // Beer Sheva
    expect(pointInRing({ lat: 32.08, lng: 34.6 }, GUSH_DAN)).toBe(false); // at sea
  });

  it("decides points a hair inside/outside each edge correctly", () => {
    const e = 1e-6;
    expect(pointInRing({ lat: 32.1, lng: 34.7 + e }, GUSH_DAN)).toBe(true);
    expect(pointInRing({ lat: 32.1, lng: 34.7 - e }, GUSH_DAN)).toBe(false);
    expect(pointInRing({ lat: 32.1, lng: 34.95 - e }, GUSH_DAN)).toBe(true);
    expect(pointInRing({ lat: 32.1, lng: 34.95 + e }, GUSH_DAN)).toBe(false);
    expect(pointInRing({ lat: 31.95 + e, lng: 34.8 }, GUSH_DAN)).toBe(true);
    expect(pointInRing({ lat: 31.95 - e, lng: 34.8 }, GUSH_DAN)).toBe(false);
    expect(pointInRing({ lat: 32.22 - e, lng: 34.8 }, GUSH_DAN)).toBe(true);
    expect(pointInRing({ lat: 32.22 + e, lng: 34.8 }, GUSH_DAN)).toBe(false);
  });

  it("treats points exactly on a vertical edge half-open (west edge in, east edge out)", () => {
    expect(pointInRing({ lat: 32.1, lng: 34.7 }, GUSH_DAN)).toBe(true);
    expect(pointInRing({ lat: 32.1, lng: 34.95 }, GUSH_DAN)).toBe(false);
  });

  it("handles concave polygons", () => {
    // L-shape: the top-right quadrant is cut out.
    const L: [number, number][] = [
      [0, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 2],
      [0, 2],
      [0, 0],
    ];
    expect(pointInRing({ lat: 0.5, lng: 0.5 }, L)).toBe(true);
    expect(pointInRing({ lat: 1.5, lng: 0.5 }, L)).toBe(true);
    expect(pointInRing({ lat: 0.5, lng: 1.5 }, L)).toBe(true);
    expect(pointInRing({ lat: 1.5, lng: 1.5 }, L)).toBe(false);
  });
});
