/**
 * In-memory sliding-window rate limiter. Good for a single instance (the
 * current deployment model). Swap for Redis when running multiple instances.
 */
import { tooMany } from "../errors";

type Bucket = { hits: number[] };
const g = globalThis as unknown as { __hopRate?: Map<string, Bucket> };
const buckets = (g.__hopRate ??= new Map());

export function rateLimit(key: string, limit: number, windowMs: number) {
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
