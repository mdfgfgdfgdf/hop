/**
 * Launches the Next dev server for Playwright on a clean embedded database.
 * (Playwright starts web servers before globalSetup, so the reset lives here.)
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const port = process.env.PORT || "3100";
const dbUrl = process.env.DATABASE_URL || "pglite://./data/e2e-db";
if (dbUrl.startsWith("pglite://") && !process.env.PW_REUSE_DB) {
  fs.rmSync(path.resolve(process.cwd(), dbUrl.replace(/^pglite:\/\//, "")), { recursive: true, force: true });
}
const child = spawn("pnpm", ["exec", "next", "dev", "-p", port], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
