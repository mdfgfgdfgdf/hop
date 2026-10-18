/**
 * Launches the app for Playwright on a clean embedded database.
 *  - locally: `next dev` (fast iteration, reused by Playwright when already running)
 *  - in CI (CI=1): `next build` + `next start` — pages are precompiled, so the suite
 *    runs in minutes instead of compiling every route on first visit.
 * (Playwright starts web servers before globalSetup, so the DB reset lives here.)
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port = process.env.PORT || "3100";
const dbUrl = process.env.DATABASE_URL || "pglite://./data/e2e-db";
if (dbUrl.startsWith("pglite://") && !process.env.PW_REUSE_DB) {
  fs.rmSync(path.resolve(process.cwd(), dbUrl.replace(/^pglite:\/\//, "")), { recursive: true, force: true });
}

const production = Boolean(process.env.CI) || process.env.E2E_MODE === "production";
if (production) {
  const build = spawnSync("pnpm", ["exec", "next", "build"], { stdio: "inherit", env: process.env });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const args = production ? ["exec", "next", "start", "-p", port] : ["exec", "next", "dev", "-p", port];
const child = spawn("pnpm", args, { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
