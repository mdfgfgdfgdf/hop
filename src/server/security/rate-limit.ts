/**
 * In-memory sliding-window rate limiter. Good for a single instance (the
 * current deployment model). Swap for Redis when running multiple instances.
 */
import { tooMany } from "../errors";

type Bucket = { hits: number[] };
const g = globalThis as unknown as { __hopRate?: Map<string, Bucket> };
const buckets = (g.__hopRate ??= new Map());

/** HOP_RATE_LIMIT=off is for automated end-to-end test servers only — never set it on a real deployment. */
const disabled = () => process.env.HOP_RATE_LIMIT === "off";

export function rateLimit(key: string, limit: number, windowMs: number) {
  if (disabled()) return;
  const now = Date.now();
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t: number) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    throw tooMany();
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.hits.every((t: number) => now - t > windowMs)) buckets.delete(k);
  }
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local"
  );
}
