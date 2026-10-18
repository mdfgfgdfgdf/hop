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
  GEO_PROVIDER: z.enum(["demo", "osm"]).default("demo"),
  NOMINATIM_URL: z.string().url().default("https://nominatim.openstreetmap.org"),
  OSRM_URL: z.string().url().default("https://router.project-osrm.org"),
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

export const isDemoMode = () => env().HOP_DEMO_MODE === "true";
export const isProduction = () => env().NODE_ENV === "production";
