import { afterEach, describe, expect, it, vi } from "vitest";
import { trafficDelayMin, trafficSegments, worstLevel } from "@/lib/traffic";
import { resetEnvForTests, trafficRouter, trafficTilesEnabled } from "@/server/env";
import { LiveGeoProvider } from "@/server/geo/live-provider";
import { trafficTile, validTile } from "@/server/geo/traffic-tiles";
import type { Polyline } from "@/lib/types";

const LINE: Polyline = [
  [32.07, 34.77],
  [32.071, 34.771],
  [32.072, 34.772],
  [32.073, 34.773],
  [32.074, 34.774],
];

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
});

describe("trafficSegments", () => {
  it("cuts the polyline into coloured stretches", () => {
    expect(trafficSegments(LINE, [{ from: 1, to: 3, level: "heavy" }])).toEqual([{ level: "heavy", coords: LINE.slice(1, 4) }]);
  });
  it("only keeps what is ahead when the route is partly driven", () => {
    const spans = [
      { from: 0, to: 1, level: "moderate" as const },
      { from: 1, to: 4, level: "severe" as const },
    ];
    const head: [number, number] = [32.0725, 34.7725];
    expect(trafficSegments(LINE, spans, 3, head)).toEqual([{ level: "severe", coords: [head, LINE[3], LINE[4]] }]);
  });
  it("draws nothing without traffic data", () => {
    expect(trafficSegments(LINE, null)).toEqual([]);
    expect(trafficSegments(null, [{ from: 0, to: 1, level: "heavy" }])).toEqual([]);
  });
});

describe("delay and worst level", () => {
  it("reports extra minutes only when the provider gives a free-flow time", () => {
    expect(trafficDelayMin({ source: "google", durationNoTrafficS: 600, spans: [], at: "" }, 900)).toBe(5);
    expect(trafficDelayMin({ source: "mapbox", durationNoTrafficS: null, spans: [], at: "" }, 900)).toBeNull();
    expect(trafficDelayMin(null, 900)).toBeNull();
  });
  it("picks the worst congestion", () => {
    expect(worstLevel([{ from: 0, to: 1, level: "moderate" }, { from: 1, to: 2, level: "heavy" }])).toBe("heavy");
    expect(worstLevel([])).toBeNull();
  });
});

describe("traffic configuration", () => {
  it("auto-selects a router from the configured key and stays off without one", () => {
    vi.stubEnv("GEO_PROVIDER", "osm");
    vi.stubEnv("ROUTING_PROVIDER", "auto");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "");
    vi.stubEnv("TOMTOM_API_KEY", "");
    resetEnvForTests();
    expect(trafficRouter()).toBeNull();
    expect(trafficTilesEnabled()).toBe(false);
    vi.stubEnv("TOMTOM_API_KEY", "tt");
    resetEnvForTests();
    expect(trafficRouter()).toBe("tomtom");
    expect(trafficTilesEnabled()).toBe(true);
    vi.stubEnv("MAPBOX_ACCESS_TOKEN", "mb");
    resetEnvForTests();
    expect(trafficRouter()).toBe("mapbox");
    vi.stubEnv("ROUTING_PROVIDER", "osrm");
    resetEnvForTests();
    expect(trafficRouter()).toBeNull();
  });
  it("never uses live traffic in offline demo geo mode", () => {
    vi.stubEnv("GEO_PROVIDER", "demo");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "g");
    vi.stubEnv("TOMTOM_API_KEY", "tt");
    resetEnvForTests();
    expect(trafficRouter()).toBeNull();
    expect(trafficTilesEnabled()).toBe(false);
  });
});

describe("LiveGeoProvider with a traffic router", () => {
  const OSRM = { code: "Ok", routes: [{ distance: 800, duration: 120, geometry: { type: "LineString", coordinates: [[34.7751, 32.0752], [34.7805, 32.0807]] } }] };
  it("falls back to OSRM (no traffic claimed) when the traffic provider fails", async () => {
    vi.stubEnv("GEO_PROVIDER", "osm");
    vi.stubEnv("ROUTING_PROVIDER", "google");
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "bad-key");
    resetEnvForTests();
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(new URL(url).host);
      if (url.includes("googleapis")) return new Response("denied", { status: 403 });
      return new Response(JSON.stringify(OSRM), { status: 200 });
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const geo = new LiveGeoProvider(fetchImpl as never);
    const r = await geo.route({ lat: 32.0752, lng: 34.7751 }, { lat: 32.0807, lng: 34.7805 });
    expect(r.provider).toBe("osm");
    expect(r.traffic ?? null).toBeNull();
    expect(r.durationS).toBe(120);
    expect(calls[0]).toBe("routes.googleapis.com");
    // The breaker is open now: the next route goes straight to (cached) OSRM.
    await geo.route({ lat: 32.0752, lng: 34.7751 }, { lat: 32.0807, lng: 34.7805 });
    expect(calls.filter((h) => h === "routes.googleapis.com")).toHaveLength(1);
  });
  it("returns live traffic when the provider answers", async () => {
    vi.stubEnv("GEO_PROVIDER", "osm");
    vi.stubEnv("ROUTING_PROVIDER", "tomtom");
    vi.stubEnv("TOMTOM_API_KEY", "tt");
    resetEnvForTests();
    const body = { routes: [{ summary: { lengthInMeters: 900, travelTimeInSeconds: 300, noTrafficTravelTimeInSeconds: 200 }, legs: [{ points: [{ latitude: 32.0752, longitude: 34.7751 }, { latitude: 32.0807, longitude: 34.7805 }] }], sections: [{ sectionType: "TRAFFIC", startPointIndex: 0, endPointIndex: 1, magnitudeOfDelay: 3 }] }] };
    const geo = new LiveGeoProvider((async () => new Response(JSON.stringify(body), { status: 200 })) as never);
    const r = await geo.route({ lat: 32.0752, lng: 34.7751 }, { lat: 32.0807, lng: 34.7805 });
    expect(r.durationS).toBe(300);
    expect(r.traffic?.source).toBe("tomtom");
    expect(r.traffic?.spans).toEqual([{ from: 0, to: 1, level: "severe" }]);
  });
});

describe("traffic tiles proxy", () => {
  it("validates tile coordinates", () => {
    expect(validTile(14, 9780, 6632)).toBe(true);
    expect(validTile(2, 4, 0)).toBe(false);
    expect(validTile(23, 0, 0)).toBe(false);
    expect(validTile(1.5, 0, 0)).toBe(false);
  });
  it("fetches with the server key, caches, and is off without a key", async () => {
    vi.stubEnv("GEO_PROVIDER", "osm");
    vi.stubEnv("TOMTOM_API_KEY", "secret-tt");
    vi.stubEnv("TRAFFIC_TILES", "auto");
    resetEnvForTests();
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png" } }));
    const t1 = await trafficTile(14, 9780, 6632, fetchImpl as never);
    const t2 = await trafficTile(14, 9780, 6632, fetchImpl as never);
    expect(t1?.type).toBe("image/png");
    expect(t2).toBe(t1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = String((fetchImpl.mock.calls[0] as unknown as [URL])[0]);
    expect(url).toContain("/traffic/map/4/tile/flow/relative-delay/14/9780/6632.png");
    expect(url).toContain("key=secret-tt");
    vi.stubEnv("TOMTOM_API_KEY", "");
    resetEnvForTests();
    expect(await trafficTile(14, 1, 1, fetchImpl as never)).toBeNull();
  });
});
