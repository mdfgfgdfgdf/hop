import { describe, expect, it } from "vitest";
import { DemoGeoProvider, estimateRoute } from "@/server/geo/demo-provider";
import { DEMO_PLACES } from "@/server/geo/demo-places";
import { haversineM } from "@/server/geo/haversine";
import { geo } from "@/server/geo";
import { PLACES } from "../helpers/fixtures";

const provider = new DemoGeoProvider();
const names = (ps: { name: string }[]) => ps.map((p) => p.name);

describe("geo/demo-provider search", () => {
  it("finds Hebrew substrings", async () => {
    const r = await provider.search("רבין");
    expect(names(r)).toContain("כיכר רבין");
    // "יצחק רבין 53" is the Givatayim mall's street address.
    expect(names(r)).toContain("קניון גבעתיים");
    expect(r.every((p) => p.provider === "demo")).toBe(true);
  });

  it("finds the airport by part of its name", async () => {
    const r = await provider.search("נמל התעופה");
    expect(r[0]?.name).toBe("נמל התעופה בן גוריון");
  });

  it.skip("BUG: the airport's common name נתב\"ג finds nothing (demo-places.ts has no alias)", async () => {
    const r = await provider.search("נתב");
    expect(names(r)).toContain("נמל התעופה בן גוריון");
  });

  it.skip("BUG: a query matching every term of a name ranks below a one-term prefix match", async () => {
    // "בן יהודה 50" scores 3 (short term + prefix bonus) and ties the airport,
    // which matches both terms; ties fall back to array order.
    const r = await provider.search("בן גוריון");
    expect(r[0]?.name).toBe("נמל התעופה בן גוריון");
  });

  it("ignores quotes, gershayim and punctuation", async () => {
    for (const q of ['תרס"ט', "תרס״ט", "כיכר הבימה", "כיכר-הבימה", "  כיכר   הבימה  "]) {
      const r = await provider.search(q);
      expect(r[0]?.name, q).toBe("כיכר הבימה");
    }
  });

  it("ranks name-prefix matches before substring-only matches", async () => {
    const r = await provider.search("רמת");
    expect(r[0]?.name).toBe("רמת החייל");
    const malls = await provider.search("קניון");
    const prefixed = malls.map((p) => p.name.startsWith("קניון"));
    // Every prefix hit comes before any non-prefix hit.
    expect(prefixed.indexOf(false) === -1 || prefixed.lastIndexOf(true) < prefixed.indexOf(false)).toBe(true);
    expect(prefixed[0]).toBe(true);
  });

  it("breaks score ties by distance from `near`", async () => {
    const givatayim = DEMO_PLACES.find((p) => p.name === "קניון גבעתיים")!;
    const r = await provider.search("רבין", givatayim);
    expect(r[0]?.name).toBe("קניון גבעתיים");
    const r2 = await provider.search("רבין", PLACES.rabin);
    expect(r2[0]?.name).toBe("כיכר רבין");
  });

  it("respects the limit (default 8)", async () => {
    expect(await provider.search("ת")).toHaveLength(8);
    expect(await provider.search("ת", undefined, 3)).toHaveLength(3);
    expect(await provider.search("ת", undefined, 1)).toHaveLength(1);
  });

  it("returns [] for empty or punctuation-only queries and for no match", async () => {
    expect(await provider.search("")).toEqual([]);
    expect(await provider.search("   ")).toEqual([]);
    expect(await provider.search('"-,.')).toEqual([]);
    expect(await provider.search("zzzzqqq")).toEqual([]);
  });
});

describe("geo/demo-provider reverse", () => {
  it("returns the exact demo place within 120 m", async () => {
    const habima = DEMO_PLACES.find((p) => p.name === "כיכר הבימה")!;
    const p = await provider.reverse({ lat: habima.lat + 0.0005, lng: habima.lng }); // ~55 m north
    expect(p).toEqual(habima);
  });

  it("synthesizes a nearby pin with the input coordinates beyond 120 m", async () => {
    const habima = DEMO_PLACES.find((p) => p.name === "כיכר הבימה")!;
    const point = { lat: habima.lat - 0.002, lng: habima.lng + 0.0001 }; // ~220 m south
    const nearest = DEMO_PLACES.map((x) => ({ x, d: haversineM(point, x) })).sort((a, b) => a.d - b.d)[0];
    const p = await provider.reverse(point);
    expect(p).not.toBeNull();
    expect(p!.name).toBe(`נקודה ליד ${nearest.x.name}`);
    expect(p!.lat).toBe(point.lat);
    expect(p!.lng).toBe(point.lng);
    expect(p!.kind).toBe("address");
    expect(p!.provider).toBe("demo");
    expect(p!.id).toBe(`demo-pin-${point.lat.toFixed(5)}-${point.lng.toFixed(5)}`);
    expect(p!.address).toContain(`${Math.round(nearest.d)} מ'`);
  });
});

describe("geo/demo-provider route / estimateRoute", () => {
  const pairs = [
    [PLACES.dizengoff, PLACES.rabin],
    [PLACES.dizengoff, PLACES.airport],
    [PLACES.rabin, PLACES.jerusalem],
  ] as const;

  it("is at least the straight line × 1.3 road factor", () => {
    for (const [a, b] of pairs) {
      const r = estimateRoute(a, b);
      expect(r.distanceM).toBeGreaterThanOrEqual(Math.floor(haversineM(a, b) * 1.3));
      expect(Number.isInteger(r.distanceM)).toBe(true);
      expect(Number.isInteger(r.durationS)).toBe(true);
    }
  });

  it("has a duration monotonic in distance, with a fixed overhead", () => {
    const routes = pairs.map(([a, b]) => estimateRoute(a, b)).sort((x, y) => x.distanceM - y.distanceM);
    for (let i = 1; i < routes.length; i++) expect(routes[i].durationS).toBeGreaterThan(routes[i - 1].durationS);
    expect(estimateRoute(PLACES.rabin, PLACES.rabin)).toMatchObject({ distanceM: 0, durationS: 90 });
  });

  it("produces a polyline from pickup to dropoff with 9–41 vertices", () => {
    for (const [a, b] of pairs) {
      const { polyline } = estimateRoute(a, b);
      expect(polyline[0]).toEqual([+a.lat.toFixed(6), +a.lng.toFixed(6)]);
      expect(polyline[polyline.length - 1]).toEqual([+b.lat.toFixed(6), +b.lng.toFixed(6)]);
      expect(polyline.length).toBeGreaterThanOrEqual(9);
      expect(polyline.length).toBeLessThanOrEqual(41);
    }
  });

  it("is tagged provider=demo, and the provider's route() delegates to it", async () => {
    const direct = estimateRoute(PLACES.dizengoff, PLACES.rabin);
    expect(direct.provider).toBe("demo");
    expect(await provider.route(PLACES.dizengoff, PLACES.rabin)).toEqual(direct);
  });

  it("geo() returns the demo provider when GEO_PROVIDER=demo", () => {
    expect(geo().name).toBe("demo");
    expect(geo()).toBe(geo());
  });
});
