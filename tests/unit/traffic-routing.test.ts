import { describe, expect, it, vi } from "vitest";
import { decodePolyline, googleToRoute, mapboxToRoute, normaliseSpans, tomtomToRoute, trafficRoute } from "@/server/geo/traffic-routing";

const FROM = { lat: 32.0752, lng: 34.7751 };
const TO = { lat: 32.0807, lng: 34.7805 };

describe("decodePolyline", () => {
  it("decodes Google's documented example", () => {
    const pts = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(pts).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });
});

describe("normaliseSpans", () => {
  it("merges touching spans of one level, clamps and drops empty ones", () => {
    expect(
      normaliseSpans(
        [
          { from: 3, to: 4, level: "heavy" },
          { from: 1, to: 2, level: "heavy" },
          { from: 2, to: 3, level: "heavy" },
          { from: 5, to: 5, level: "moderate" },
          { from: 6, to: 99, level: "severe" },
        ],
        8,
      ),
    ).toEqual([
      { from: 1, to: 4, level: "heavy" },
      { from: 6, to: 7, level: "severe" },
    ]);
  });
});

describe("googleToRoute (Routes API computeRoutes)", () => {
  // Shape per routes.googleapis.com/directions/v2:computeRoutes with
  // extraComputations=TRAFFIC_ON_POLYLINE (proto3 JSON omits zero indices).
  const RES = {
    routes: [
      {
        distanceMeters: 1840,
        duration: "540s",
        staticDuration: "380s",
        polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC_mqNvxq`@" },
        travelAdvisory: {
          speedReadingIntervals: [
            { endPolylinePointIndex: 1, speed: "NORMAL" },
            { startPolylinePointIndex: 1, endPolylinePointIndex: 2, speed: "TRAFFIC_JAM" },
          ],
        },
      },
    ],
  };
  it("maps duration with traffic, static duration and congested stretches", () => {
    const r = googleToRoute(RES as never, new Date("2026-10-18T12:00:00Z"));
    expect(r.distanceM).toBe(1840);
    expect(r.durationS).toBe(540);
    expect(r.polyline).toHaveLength(3);
    expect(r.traffic).toEqual({ source: "google", durationNoTrafficS: 380, spans: [{ from: 1, to: 2, level: "heavy" }], at: "2026-10-18T12:00:00.000Z" });
  });
  it("treats SLOW as moderate and a missing start index as 0", () => {
    const r = googleToRoute({ routes: [{ ...RES.routes[0], travelAdvisory: { speedReadingIntervals: [{ endPolylinePointIndex: 2, speed: "SLOW" }] } }] } as never);
    expect(r.traffic?.spans).toEqual([{ from: 0, to: 2, level: "moderate" }]);
  });
  it("rejects an empty response", () => {
    expect(() => googleToRoute({})).toThrow();
  });
});

describe("mapboxToRoute (Directions driving-traffic)", () => {
  const RES = {
    code: "Ok",
    routes: [
      {
        distance: 1902.4,
        duration: 512.7,
        duration_typical: 401.2,
        geometry: { type: "LineString" as const, coordinates: [[34.7751, 32.0752], [34.7762, 32.0768], [34.7781, 32.0786], [34.7805, 32.0807]] as [number, number][] },
        legs: [{ annotation: { congestion: ["low" as const, "heavy" as const, "severe" as const] } }],
      },
    ],
  };
  it("flips coordinates to [lat,lng] and turns per-segment congestion into spans", () => {
    const r = mapboxToRoute(RES);
    expect(r.polyline[0]).toEqual([32.0752, 34.7751]);
    expect(r.durationS).toBe(513);
    expect(r.traffic?.durationNoTrafficS).toBe(401);
    expect(r.traffic?.spans).toEqual([
      { from: 1, to: 2, level: "heavy" },
      { from: 2, to: 3, level: "severe" },
    ]);
  });
  it("throws on a non-Ok code", () => {
    expect(() => mapboxToRoute({ code: "NoRoute", routes: [] })).toThrow(/NoRoute/);
  });
});

describe("tomtomToRoute (Routing calculateRoute, sectionType=traffic)", () => {
  const RES = {
    routes: [
      {
        summary: { lengthInMeters: 1950, travelTimeInSeconds: 600, noTrafficTravelTimeInSeconds: 420, trafficDelayInSeconds: 180 },
        legs: [{ points: [{ latitude: 32.0752, longitude: 34.7751 }, { latitude: 32.0768, longitude: 34.7762 }, { latitude: 32.0786, longitude: 34.7781 }, { latitude: 32.0807, longitude: 34.7805 }] }],
        sections: [
          { sectionType: "TRAVEL_MODE", startPointIndex: 0, endPointIndex: 3 },
          { sectionType: "TRAFFIC", startPointIndex: 1, endPointIndex: 2, simpleCategory: "JAM", magnitudeOfDelay: 2 },
          { sectionType: "TRAFFIC", startPointIndex: 2, endPointIndex: 3, simpleCategory: "ROAD_CLOSURE", magnitudeOfDelay: 4 },
        ],
      },
    ],
  };
  it("maps travel time with traffic and traffic sections", () => {
    const r = tomtomToRoute(RES);
    expect(r.durationS).toBe(600);
    expect(r.traffic?.durationNoTrafficS).toBe(420);
    expect(r.traffic?.spans).toEqual([
      { from: 1, to: 2, level: "heavy" },
      { from: 2, to: 3, level: "severe" },
    ]);
  });
});

describe("trafficRoute requests", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  it("google: POSTs with the key in a header and asks for traffic on the polyline", async () => {
    const fetchImpl = vi.fn(async () => ok({ routes: [{ distanceMeters: 10, duration: "5s", polyline: { encodedPolyline: "_p~iF~ps|U_ulLnnqC" } }] }));
    await trafficRoute("google", "G-KEY", FROM, TO, fetchImpl as never);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("G-KEY");
    const body = JSON.parse(String(init.body));
    expect(body.routingPreference).toBe("TRAFFIC_AWARE_OPTIMAL");
    expect(body.extraComputations).toEqual(["TRAFFIC_ON_POLYLINE"]);
  });
  it("mapbox: uses the driving-traffic profile with congestion annotations", async () => {
    const fetchImpl = vi.fn(async () => ok({ code: "Ok", routes: [{ distance: 1, duration: 1, geometry: { type: "LineString", coordinates: [[34.77, 32.07], [34.78, 32.08]] } }] }));
    await trafficRoute("mapbox", "MB-TOKEN", FROM, TO, fetchImpl as never);
    const url = String((fetchImpl.mock.calls[0] as unknown as [URL])[0]);
    expect(url).toContain("/directions/v5/mapbox/driving-traffic/34.7751,32.0752;34.7805,32.0807");
    expect(url).toContain("annotations=congestion");
  });
  it("tomtom: asks for live traffic and traffic sections", async () => {
    const fetchImpl = vi.fn(async () => ok({ routes: [{ summary: { travelTimeInSeconds: 1 }, legs: [{ points: [{ latitude: 1, longitude: 1 }, { latitude: 2, longitude: 2 }] }] }] }));
    await trafficRoute("tomtom", "TT-KEY", FROM, TO, fetchImpl as never);
    const url = String((fetchImpl.mock.calls[0] as unknown as [URL])[0]);
    expect(url).toContain("/routing/1/calculateRoute/32.0752,34.7751:32.0807,34.7805/json");
    expect(url).toContain("traffic=true");
    expect(url).toContain("sectionType=traffic");
  });
  it("surfaces HTTP errors so the caller can fall back to OSRM", async () => {
    const fetchImpl = vi.fn(async () => new Response("denied", { status: 403 }));
    await expect(trafficRoute("google", "bad", FROM, TO, fetchImpl as never)).rejects.toThrow(/403/);
  });
});
