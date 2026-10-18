import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Integration tests share an in-memory PGlite instance per file.
    fileParallelism: true,
    env: {
      DATABASE_URL: "memory://",
      DB_AUTO_MIGRATE: "true",
      DB_AUTO_SEED: "false",
      HOP_DEMO_MODE: "true",
      HOP_SESSION_SECRET: "test-secret-test-secret-test-secret-00",
      GEO_PROVIDER: "demo",
      HOP_DATA_DIR: "./data/test",
      NODE_ENV: "test",
    },
  },
});
