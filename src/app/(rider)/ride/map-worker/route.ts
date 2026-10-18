/**
 * Serves MapLibre's web-worker bundle for the rider map.
 *
 * MapLibre 6 (ESM) resolves its worker relative to `import.meta.url`; under
 * Turbopack that points at a hashed chunk, so the worker 404s ("Worker failed
 * to load") and GeoJSON layers (the route line) never render. RiderMap calls
 * `setWorkerUrl("/ride/map-worker")` instead. Local workaround — reported
 * under "Requested backend/shared changes".
 */
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

let cached: Uint8Array | null = null;

export async function GET() {
  try {
    cached ??= new Uint8Array(await fs.readFile(path.join(process.cwd(), "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs")));
    return new Response(cached.slice(), {
      headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response("// maplibre worker unavailable", { status: 404, headers: { "Content-Type": "text/javascript" } });
  }
}
