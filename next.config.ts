import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // HOP is an authenticated, almost entirely dynamic app (live rides, quotes,
  // driver positions). We keep the classic dynamic rendering model instead of
  // Cache Components so server pages read fresh data on every request.
  cacheComponents: false,
  reactStrictMode: true,
  // Dev-only: allow the dev client when the app is opened via 127.0.0.1 (e2e, LAN testing).
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // The dev badge sits over the bottom-left corner where map attributions and sheets live.
  devIndicators: false,
  poweredByHeader: false,
  // Native / WASM packages that must be required by Node at runtime rather
  // than bundled by Turbopack.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "@node-rs/argon2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "geolocation=(self), camera=(self), microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
