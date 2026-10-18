import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "pglite://./data/hop";
if (!url.startsWith("pglite://")) {
  console.error("db:reset only supports the embedded PGlite database. Drop your Postgres DB manually.");
  process.exit(1);
}
const dir = path.resolve(process.cwd(), url.replace(/^pglite:\/\//, ""));
fs.rmSync(dir, { recursive: true, force: true });
console.log(`✓ removed ${dir}`);
