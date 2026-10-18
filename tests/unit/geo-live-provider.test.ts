import { describe, expect, it, vi } from "vitest";
import { LiveGeoProvider, nominatimToPlace, osrmToRoute, photonToPlace } from "@/server/geo/live-provider";

// Response shapes as returned by the public Photon, Nominatim and OSRM APIs.
const PHOTON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [34.7805, 32.0807] },
      properties: { osm_id: 1, osm_type: "N", osm_key: "place", osm_value: "square", type: "house", name: "כיכר רבין", street: "אבן גבירול", housenumber: "69", city: "תל אביב-יפו", countrycode: "IL" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [34.7751, 32.0752] },
      properties: { osm_id: 2, osm_type: "W", osm_key: "building", osm_value: "yes", type: "house", street: "דיזנגוף", housenumber: "50", city: "תל אביב-יפו", countrycode: "IL" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [34.8706, 32.0004] },
      properties: { osm_id: 3, osm_type: "W", osm_key: "aeroway", osm_value: "aerodrome", type: "house", name: "נמל התעופה בן גוריון", city: "לוד", countrycode: "IL" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [35.5, 33.9] },
      properties: { osm_id: 4, osm_type: "N", name: "Beirut place", countrycode: "LB" },
    },
  ],
};

const NOMINATIM = {
  place_id: 9001,
  lat: "32.07521",
  lon: "34.77513",
  display_name: "דיזנגוף סנטר, 50, דיזנגוף, הצפון הישן, תל אביב-יפו, ישראל",
  name: "דיזנגוף סנטר",
  category: "shop",
  type: "mall",
  address: { shop: "דיזנגוף סנטר", house_number: "50", road: "דיזנגוף", city: "תל אביב-יפו", country: "ישראל", country_code: "il" },
};

const OSRM = {
  code: "Ok",
  routes: [{ distance: 1043.6, duration: 212.4, geometry: { type: "LineString", coordinates: [[34.7751, 32.0752], [34.778, 32.078], [34.7805, 32.0807]] } }],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function mockFetch(handler: (url: URL) => Response | Promise<Response>) {
  return vi.fn(async (input: string | URL | Request) => handler(new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url))) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("geo/live-provider mappers", () => {
  it("maps Photon features: named places keep street + city, addresses show the city, transit is detected", () => {
    const [square, address, airport] = PHOTON.features.map((f) => photonToPlace(f as never)!);
    expect(square).toMatchObject({ name: "כיכר רבין", address: "אבן גבירול 69, תל אביב-יפו", lat: 32.0807, lng: 34.7805, kind: "poi", provider: "osm" });
    expect(address).toMatchObject({ name: "דיזנגוף 50", address: "תל אביב-יפו", kind: "address" });
    expect(airport).toMatchObject({ name: "נמל התעופה בן גוריון", kind: "transit" });
  });

  it("maps a Nominatim reverse result in Hebrew and keeps the exact pin coordinates", () => {
    const p = nominatimToPlace(NOMINATIM as never, { lat: 32.0752, lng: 34.7751 });
    expect(p).toMatchObject({ name: "דיזנגוף סנטר", address: "דיזנגוף 50, תל אביב-יפו", lat: 32.0752, lng: 34.7751, provider: "osm" });
  });

  it("maps an OSRM route to metres/seconds and [lat, lng] polyline", () => {
    const r = osrmToRoute(OSRM as never);
    expect(r).toMatchObject({ distanceM: 1044, durationS: 212, provider: "osm" });
    expect(r.polyline[0]).toEqual([32.0752, 34.7751]);
    expect(r.polyline.at(-1)).toEqual([32.0807, 34.7805]);
    expect(() => osrmToRoute({ code: "NoRoute" } as never)).toThrow();
  });
});

describe("geo/live-provider requests", () => {
  it("search calls Photon with an Israel bbox and location bias, filters other countries and caches", async () => {
    const f = mockFetch(() => jsonResponse(PHOTON));
    const geo = new LiveGeoProvider(f);
    const places = await geo.search("רבין", { lat: 32.07, lng: 34.78 }, 8);
    expect(places.map((p) => p.name)).toEqual(["כיכר רבין", "דיזנגוף 50", "נמל התעופה בן גוריון"]);
    const url = new URL((f.mock.calls[0][0] as URL).href);
    expect(url.host).toBe("photon.komoot.io");
    expect(url.searchParams.get("q")).toBe("רבין");
    expect(url.searchParams.get("bbox")).toBe("34.2,29.4,35.95,33.35");
    expect(url.searchParams.get("lat")).toBe("32.07");
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/^HOP\//);
    await geo.search("רבין", { lat: 32.07, lng: 34.78 }, 8);
    expect(f).toHaveBeenCalledTimes(1); // cached
  });

  it("reverse calls Nominatim in Hebrew; route calls OSRM with lng,lat order", async () => {
    const f = mockFetch((url) => (url.host.includes("nominatim") ? jsonResponse(NOMINATIM) : jsonResponse(OSRM)));
    const geo = new LiveGeoProvider(f);
    const place = await geo.reverse({ lat: 32.0752, lng: 34.7751 });
    expect(place?.name).toBe("דיזנגוף סנטר");
    const nUrl = f.mock.calls[0][0] as URL;
    expect(nUrl.pathname).toBe("/reverse");
    expect(nUrl.searchParams.get("accept-language")).toBe("he");
    const route = await geo.route({ lat: 32.0752, lng: 34.7751 }, { lat: 32.0807, lng: 34.7805 });
    expect(route.provider).toBe("osm");
    expect((f.mock.calls[1][0] as URL).pathname).toBe("/route/v1/driving/34.7751,32.0752;34.7805,32.0807");
  });

  it("falls back to the offline estimate (tagged demo) when a service fails, and stops calling it for a while", async () => {
    const f = mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    const geo = new LiveGeoProvider(f);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const route = await geo.route({ lat: 32.0752, lng: 34.7751 }, { lat: 32.0807, lng: 34.7805 });
    expect(route.provider).toBe("demo");
    expect(route.distanceM).toBeGreaterThan(600);
    await geo.route({ lat: 32.0752, lng: 34.7751 }, { lat: 32.09, lng: 34.79 });
    expect(f).toHaveBeenCalledTimes(1); // breaker open: second call skipped the network

    const places = await geo.search("רבין");
    expect(places[0]).toMatchObject({ name: "כיכר רבין", provider: "demo" });
    const rev = await geo.reverse({ lat: 32.0807, lng: 34.7805 });
    expect(rev?.provider).toBe("demo");
    warn.mockRestore();
  });

  it("treats HTTP errors as failures and Nominatim 'Unable to geocode' as no result", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const busy = new LiveGeoProvider(mockFetch(() => jsonResponse({ message: "busy" }, 503)));
    expect((await busy.route({ lat: 32.0752, lng: 34.7751 }, { lat: 32.0807, lng: 34.7805 })).provider).toBe("demo");
    const sea = new LiveGeoProvider(mockFetch(() => jsonResponse({ error: "Unable to geocode" })));
    expect(await sea.reverse({ lat: 32.1, lng: 34.6 })).toBeNull();
    warn.mockRestore();
  });
});
