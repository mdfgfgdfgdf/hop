/**
 * Typed, validated server environment. Secrets never leave this module;
 * nothing here is sent to the client.
 */
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("pglite://./data/hop"),
  DB_AUTO_MIGRATE: z.enum(["true", "false"]).default("true"),
  DB_AUTO_SEED: z.enum(["true", "false"]).default("true"),
  HOP_DEMO_MODE: z.enum(["true", "false"]).default("false"),
  HOP_SESSION_SECRET: z.string().min(16).default("dev-only-change-me-0000000000000000000000000000"),
  HOP_ADMIN_EMAIL: z.string().email().default("admin@hop.local"),
  HOP_ADMIN_PASSWORD: z.string().min(8).default("Admin1234!"),
  // "osm" = live map data (Photon + Nominatim + OSRM) with automatic offline fallback; "demo" = offline only.
  GEO_PROVIDER: z.enum(["demo", "osm", "live"]).default("osm"),
  PHOTON_URL: z.string().url().default("https://photon.komoot.io"),
  NOMINATIM_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  OSRM_URL: z.string().url().default("https://router.project-osrm.org"),
  // Traffic-aware routing and live traffic. Keys stay on the server (tiles are proxied).
  //   ROUTING_PROVIDER=auto picks the first configured key: Google → Mapbox → TomTom → OSRM (no traffic).
  ROUTING_PROVIDER: z.enum(["auto", "osrm", "google", "mapbox", "tomtom"]).default("auto"),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
  TOMTOM_API_KEY: z.string().optional(),
  //   TRAFFIC_TILES=auto shows the live traffic overlay when TOMTOM_API_KEY is set.
  TRAFFIC_TILES: z.enum(["auto", "tomtom", "off"]).default("auto"),
  // Contact address sent in the User-Agent (OSM services require a way to reach you).
  HOP_GEO_CONTACT: z.string().default("ops@hop.local"),
  HOP_DATA_DIR: z.string().default("./data"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  cached = parsed.data;
  if (
    cached.NODE_ENV === "production" &&
    cached.HOP_SESSION_SECRET.startsWith("dev-only")
  ) {
    throw new Error("HOP_SESSION_SECRET must be set to a strong secret in production");
  }
  return cached;
}

/** Tests only: re-read process.env on the next env() call. */
export function resetEnvForTests() {
  cached = null;
}

export const isDemoMode = () => env().HOP_DEMO_MODE === "true";

/** Which traffic-aware router is in use, or null for OSRM / estimates (no live traffic). */
export function trafficRouter(): "google" | "mapbox" | "tomtom" | null {
  const e = env();
  if (e.GEO_PROVIDER === "demo") return null;
  const has = { google: !!e.GOOGLE_MAPS_API_KEY, mapbox: !!e.MAPBOX_ACCESS_TOKEN, tomtom: !!e.TOMTOM_API_KEY };
  if (e.ROUTING_PROVIDER === "osrm") return null;
  if (e.ROUTING_PROVIDER !== "auto") return has[e.ROUTING_PROVIDER] ? e.ROUTING_PROVIDER : null;
  return has.google ? "google" : has.mapbox ? "mapbox" : has.tomtom ? "tomtom" : null;
}

/** True when the live traffic overlay can be served. */
export const trafficTilesEnabled = () => {
  const e = env();
  return e.TRAFFIC_TILES !== "off" && !!e.TOMTOM_API_KEY && e.GEO_PROVIDER !== "demo";
};
export const isProduction = () => env().NODE_ENV === "production";
