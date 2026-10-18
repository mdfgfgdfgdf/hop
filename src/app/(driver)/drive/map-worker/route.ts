/**
 * Serves MapLibre's web-worker bundle for the driver map.
 *
 * MapLibre 6 (ESM) resolves its worker relative to `import.meta.url`, which
 * under Turbopack points at a hashed chunk, so the worker 404s and the map
 * never loads. DriverMap calls `setWorkerUrl("/drive/map-worker")` instead.
 * (Local workaround — see the driver app report.)
 */
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

let cached: Buffer | null = null;

export async function GET() {
  try {
    cached ??= await fs.readFile(path.join(process.cwd(), "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs"));
    return new Response(new Uint8Array(cached), {
      headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response("// maplibre worker unavailable", { status: 404, headers: { "Content-Type": "text/javascript" } });
  }
}
