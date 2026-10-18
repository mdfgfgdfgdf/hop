/**
 * Live traffic overlay tiles (TomTom Traffic Flow, raster, "relative-delay"
 * style: only roads slower than free flow are painted). Fetched server-side
 * so the API key never reaches the browser; each tile is cached for a minute.
 */
import { env, trafficTilesEnabled } from "../env";

const TTL_MS = 60_000;
const MAX_TILES = 3000;
const cache = new Map<string, { body: ArrayBuffer; type: string; exp: number }>();

export function validTile(z: number, x: number, y: number) {
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > 22) return false;
  const n = 2 ** z;
  return x >= 0 && x < n && y >= 0 && y < n;
}

export async function trafficTile(z: number, x: number, y: number, fetchImpl: typeof fetch = fetch): Promise<{ body: ArrayBuffer; type: string } | null> {
  if (!trafficTilesEnabled() || !validTile(z, x, y)) return null;
  const key = `${z}/${x}/${y}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit;
  const url = new URL(`https://api.tomtom.com/traffic/map/4/tile/flow/relative-delay/${z}/${x}/${y}.png`);
  url.searchParams.set("key", env().TOMTOM_API_KEY!);
  url.searchParams.set("tileSize", "256");
  url.searchParams.set("thickness", "8");
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`tomtom tiles ${res.status}`);
  const tile = { body: await res.arrayBuffer(), type: res.headers.get("content-type") ?? "image/png", exp: Date.now() + TTL_MS };
  if (cache.size >= MAX_TILES) cache.delete(cache.keys().next().value as string);
  cache.set(key, tile);
  return tile;
}
