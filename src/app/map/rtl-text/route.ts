/**
 * Serves MapLibre's RTL text plugin (Hebrew/Arabic label shaping) from our own
 * origin, so maps never depend on a third-party CDN at runtime.
 */
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-static";

let cached: Uint8Array | null = null;

export async function GET() {
  try {
    cached ??= new Uint8Array(await fs.readFile(path.join(process.cwd(), "node_modules", "@mapbox", "mapbox-gl-rtl-text", "dist", "mapbox-gl-rtl-text.js")));
    return new Response(cached.slice(), {
      headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=604800, immutable" },
    });
  } catch {
    return new Response("// rtl text plugin unavailable", { status: 404, headers: { "Content-Type": "text/javascript" } });
  }
}
