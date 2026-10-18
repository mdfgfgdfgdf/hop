import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Use localhost: the Next dev server only serves its dev client to allowed origins.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    // In environments with a pre-installed Chromium (e.g. CI containers), point
    // PW_CHROMIUM_PATH at the binary instead of downloading browsers.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 14"], defaultBrowserType: "chromium" } },
    { name: "tablet", use: { ...devices["iPad Mini"], defaultBrowserType: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `node scripts/dev/e2e-server.mjs`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      DATABASE_URL: "pglite://./data/e2e-db",
      DB_AUTO_MIGRATE: "true",
      DB_AUTO_SEED: "true",
      HOP_DEMO_MODE: "true",
      HOP_SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-000",
      GEO_PROVIDER: "demo",
      HOP_DATA_DIR: "./data/e2e",
      NEXT_PUBLIC_MAP_STYLE_URL: "",
      HOP_ADMIN_EMAIL: "admin@hop.local",
      HOP_ADMIN_PASSWORD: "Admin1234!",
    },
  },
});
